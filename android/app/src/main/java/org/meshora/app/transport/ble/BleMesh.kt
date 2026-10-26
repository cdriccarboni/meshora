package org.meshora.app.transport.ble

import android.Manifest
import android.annotation.SuppressLint
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothGatt
import android.bluetooth.BluetoothGattCallback
import android.bluetooth.BluetoothGattCharacteristic
import android.bluetooth.BluetoothGattDescriptor
import android.bluetooth.BluetoothGattServer
import android.bluetooth.BluetoothGattServerCallback
import android.bluetooth.BluetoothGattService
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothProfile
import android.bluetooth.BluetoothStatusCodes
import android.bluetooth.le.AdvertiseCallback
import android.bluetooth.le.AdvertiseData
import android.bluetooth.le.AdvertiseSettings
import android.bluetooth.le.ScanCallback
import android.bluetooth.le.ScanFilter
import android.bluetooth.le.ScanResult
import android.bluetooth.le.ScanSettings
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.os.ParcelUuid
import androidx.core.content.ContextCompat
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import org.meshora.app.mesh.MeshIds
import org.meshora.app.mesh.MeshLink
import org.meshora.app.mesh.MeshRouter
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.ConcurrentLinkedQueue
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Liaison Bluetooth LE réelle du maillage MESHORA (docs/MESH-NATIF-V0.3.md).
 *
 * Chaque appareil est à la fois :
 *  - périphérique : serveur GATT (service [MeshIds.SERVICE]) + annonce connectable ;
 *    le voisin ÉCRIT des trames dans RX, nous lui NOTIFIONS des trames via TX ;
 *  - central : balayage filtré sur le service, connexion GATT, MTU 517 demandée,
 *    abonnement aux notifications TX, écriture dans RX.
 * Chaque connexion prête devient un [MeshLink] confié au [MeshRouter]. Les opérations GATT
 * étant strictement séquentielles sur Android, chaque lien possède sa file d'envoi.
 *
 * Limites de cette version : application au premier plan (aucun service de premier plan),
 * identifiant d'annonce non tournant, deux liens possibles entre deux mêmes appareils (sans effet : déduplication).
 */
@SuppressLint("MissingPermission") // vérifié par hasPermissions() avant toute opération
class BleMesh(
    private val context: Context,
    private val router: MeshRouter,
    private val onLinksChanged: () -> Unit = {}
) {
    private val manager = context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
    private val adapter get() = manager?.adapter

    private val _status = MutableStateFlow("Bluetooth MESHORA arrêté.")
    val status: StateFlow<String> = _status.asStateFlow()
    private val _running = MutableStateFlow(false)
    val running: StateFlow<Boolean> = _running.asStateFlow()
    private val _linkCount = MutableStateFlow(0)
    val linkCount: StateFlow<Int> = _linkCount.asStateFlow()
    private val _advertising = MutableStateFlow(false)
    val advertising: StateFlow<Boolean> = _advertising.asStateFlow()

    private var gattServer: BluetoothGattServer? = null
    private var txCharacteristic: BluetoothGattCharacteristic? = null
    private val centralLinks = ConcurrentHashMap<String, CentralLink>()
    private val peripheralLinks = ConcurrentHashMap<String, PeripheralLink>()
    private val serverMtu = ConcurrentHashMap<String, Int>()
    /** Écritures longues (« prepared writes ») en cours, par appareil : certains centraux (ordinateurs) les utilisent. */
    private val preparedWrites = ConcurrentHashMap<String, java.io.ByteArrayOutputStream>()
    private val connecting = ConcurrentHashMap<String, Long>()
    private val lastAttempt = ConcurrentHashMap<String, Long>()

    fun isSupported(): Boolean =
        adapter != null && context.packageManager.hasSystemFeature(PackageManager.FEATURE_BLUETOOTH_LE)

    fun requiredPermissions(): Array<String> =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            arrayOf(Manifest.permission.BLUETOOTH_SCAN, Manifest.permission.BLUETOOTH_ADVERTISE, Manifest.permission.BLUETOOTH_CONNECT)
        } else {
            arrayOf(Manifest.permission.ACCESS_FINE_LOCATION)
        }

    fun hasPermissions(): Boolean = requiredPermissions().all {
        ContextCompat.checkSelfPermission(context, it) == PackageManager.PERMISSION_GRANTED
    }

    /** Démarre annonce + serveur GATT + balayage. Renvoie false (avec un statut explicite) en cas d'impossibilité. */
    @Synchronized
    fun start(): Boolean {
        if (_running.value) return true
        if (!isSupported()) return fail("Bluetooth LE indisponible sur cet appareil.")
        if (!hasPermissions()) return fail("Autorisations Bluetooth refusées : à accorder dans les réglages de l'application.")
        val bt = adapter ?: return fail("Bluetooth indisponible.")
        if (!bt.isEnabled) return fail("Bluetooth désactivé : activez-le puis réessayez.")

        if (!openGattServer()) return fail("Impossible d'ouvrir le serveur GATT.")
        _running.value = true
        startAdvertising()
        startScan()
        updateStatus()
        return true
    }

    @Synchronized
    fun stop() {
        if (!_running.value) return
        _running.value = false
        try { adapter?.bluetoothLeScanner?.stopScan(scanCallback) } catch (_: Exception) {}
        try { adapter?.bluetoothLeAdvertiser?.stopAdvertising(advertiseCallback) } catch (_: Exception) {}
        _advertising.value = false
        centralLinks.values.forEach { it.close() }
        centralLinks.clear()
        peripheralLinks.keys.forEach { router.removeLink(it) }
        peripheralLinks.clear()
        try { gattServer?.close() } catch (_: Exception) {}
        gattServer = null
        connecting.clear()
        refreshLinks()
        _status.value = "Bluetooth MESHORA arrêté."
    }

    private fun fail(message: String): Boolean {
        _status.value = message
        return false
    }

    private fun updateStatus() {
        if (!_running.value) return
        val adv = if (_advertising.value) "annonce active" else "annonce indisponible"
        _status.value = "Bluetooth MESHORA actif : $adv, recherche en cours, ${_linkCount.value} lien(s) direct(s)."
    }

    private fun refreshLinks() {
        _linkCount.value = centralLinks.values.count { it.ready } + peripheralLinks.size
        updateStatus()
        onLinksChanged()
    }

    // ------------------------------------------------------------------ périphérique

    private fun openGattServer(): Boolean {
        val server = manager?.openGattServer(context, serverCallback) ?: return false
        val service = BluetoothGattService(MeshIds.SERVICE, BluetoothGattService.SERVICE_TYPE_PRIMARY)
        val rx = BluetoothGattCharacteristic(
            MeshIds.CHAR_RX,
            BluetoothGattCharacteristic.PROPERTY_WRITE or BluetoothGattCharacteristic.PROPERTY_WRITE_NO_RESPONSE,
            BluetoothGattCharacteristic.PERMISSION_WRITE
        )
        val tx = BluetoothGattCharacteristic(
            MeshIds.CHAR_TX,
            BluetoothGattCharacteristic.PROPERTY_NOTIFY,
            BluetoothGattCharacteristic.PERMISSION_READ
        )
        tx.addDescriptor(
            BluetoothGattDescriptor(CCCD, BluetoothGattDescriptor.PERMISSION_READ or BluetoothGattDescriptor.PERMISSION_WRITE)
        )
        service.addCharacteristic(rx)
        service.addCharacteristic(tx)
        if (!server.addService(service)) {
            server.close()
            return false
        }
        gattServer = server
        txCharacteristic = tx
        return true
    }

    private val serverCallback = object : BluetoothGattServerCallback() {
        override fun onConnectionStateChange(device: BluetoothDevice, status: Int, newState: Int) {
            if (newState == BluetoothProfile.STATE_DISCONNECTED) {
                val id = "p:" + device.address
                if (peripheralLinks.remove(id) != null) router.removeLink(id)
                serverMtu.remove(device.address)
                refreshLinks()
            }
        }

        override fun onMtuChanged(device: BluetoothDevice, mtu: Int) {
            serverMtu[device.address] = mtu
        }

        override fun onDescriptorWriteRequest(
            device: BluetoothDevice, requestId: Int, descriptor: BluetoothGattDescriptor,
            preparedWrite: Boolean, responseNeeded: Boolean, offset: Int, value: ByteArray?
        ) {
            val ok = descriptor.uuid == CCCD && descriptor.characteristic.uuid == MeshIds.CHAR_TX && !preparedWrite && offset == 0
            if (responseNeeded) {
                gattServer?.sendResponse(device, requestId, if (ok) BluetoothGatt.GATT_SUCCESS else BluetoothGatt.GATT_FAILURE, 0, null)
            }
            if (!ok) return
            val id = "p:" + device.address
            if (value != null && value.contentEquals(BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE)) {
                val link = PeripheralLink(device)
                peripheralLinks[id] = link
                router.addLink(link)
            } else {
                peripheralLinks.remove(id)
                router.removeLink(id)
            }
            refreshLinks()
        }

        override fun onCharacteristicWriteRequest(
            device: BluetoothDevice, requestId: Int, characteristic: BluetoothGattCharacteristic,
            preparedWrite: Boolean, responseNeeded: Boolean, offset: Int, value: ByteArray?
        ) {
            if (characteristic.uuid != MeshIds.CHAR_RX || value == null) {
                if (responseNeeded) gattServer?.sendResponse(device, requestId, BluetoothGatt.GATT_FAILURE, 0, null)
                return
            }
            if (preparedWrite) {
                val buf = preparedWrites.getOrPut(device.address) { java.io.ByteArrayOutputStream() }
                val ok = offset == buf.size() && buf.size() + value.size <= MAX_LONG_WRITE
                if (ok) buf.write(value) else preparedWrites.remove(device.address)
                if (responseNeeded) {
                    gattServer?.sendResponse(device, requestId, if (ok) BluetoothGatt.GATT_SUCCESS else BluetoothGatt.GATT_INVALID_OFFSET, offset, value)
                }
                return
            }
            val ok = offset == 0
            if (responseNeeded) {
                gattServer?.sendResponse(device, requestId, if (ok) BluetoothGatt.GATT_SUCCESS else BluetoothGatt.GATT_INVALID_OFFSET, 0, null)
            }
            if (ok) router.onFrameReceived("p:" + device.address, value)
        }

        override fun onExecuteWrite(device: BluetoothDevice, requestId: Int, execute: Boolean) {
            val buf = preparedWrites.remove(device.address)
            gattServer?.sendResponse(device, requestId, BluetoothGatt.GATT_SUCCESS, 0, null)
            if (execute && buf != null && buf.size() > 0) router.onFrameReceived("p:" + device.address, buf.toByteArray())
        }

        override fun onNotificationSent(device: BluetoothDevice, status: Int) {
            peripheralLinks["p:" + device.address]?.onSent()
        }
    }

    private inner class PeripheralLink(private val device: BluetoothDevice) : MeshLink {
        override val id = "p:" + device.address
        override val maxFrameSize: Int get() = (serverMtu[device.address] ?: DEFAULT_MTU) - 3
        private val queue = ConcurrentLinkedQueue<ByteArray>()
        private val busy = AtomicBoolean(false)

        override fun send(frame: ByteArray): Boolean {
            if (queue.size > MAX_QUEUE) return false
            queue.add(frame)
            pump()
            return true
        }

        fun onSent() {
            busy.set(false)
            pump()
        }

        private fun pump() {
            if (!busy.compareAndSet(false, true)) return
            val next = queue.poll() ?: run { busy.set(false); return }
            val server = gattServer
            val tx = txCharacteristic
            val started = if (server == null || tx == null) false else try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    server.notifyCharacteristicChanged(device, tx, false, next) == BluetoothStatusCodes.SUCCESS
                } else {
                    @Suppress("DEPRECATION")
                    tx.value = next
                    @Suppress("DEPRECATION")
                    server.notifyCharacteristicChanged(device, tx, false)
                }
            } catch (_: Exception) {
                false
            }
            if (!started) {
                busy.set(false)
                queue.clear()
            }
        }
    }

    private val advertiseCallback = object : AdvertiseCallback() {
        override fun onStartSuccess(settingsInEffect: AdvertiseSettings?) {
            _advertising.value = true
            updateStatus()
        }

        override fun onStartFailure(errorCode: Int) {
            _advertising.value = false
            _status.value = "Annonce Bluetooth refusée par le système (code $errorCode) ; la recherche continue."
        }
    }

    private fun startAdvertising() {
        val advertiser = adapter?.bluetoothLeAdvertiser ?: run {
            _status.value = "Cet appareil ne peut pas annoncer en Bluetooth LE ; la recherche continue."
            return
        }
        val settings = AdvertiseSettings.Builder()
            .setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_LOW_LATENCY)
            .setTxPowerLevel(AdvertiseSettings.ADVERTISE_TX_POWER_MEDIUM)
            .setConnectable(true)
            .build()
        val data = AdvertiseData.Builder()
            .setIncludeDeviceName(false)
            .addServiceUuid(ParcelUuid(MeshIds.SERVICE))
            .build()
        try {
            advertiser.startAdvertising(settings, data, advertiseCallback)
        } catch (e: Exception) {
            _status.value = "Annonce Bluetooth impossible : ${e.javaClass.simpleName}"
        }
    }

    // ------------------------------------------------------------------ central

    private val scanCallback = object : ScanCallback() {
        override fun onScanResult(callbackType: Int, result: ScanResult) {
            onFound(result.device)
        }

        override fun onBatchScanResults(results: MutableList<ScanResult>) {
            results.forEach { onFound(it.device) }
        }

        override fun onScanFailed(errorCode: Int) {
            _status.value = "Recherche Bluetooth refusée par le système (code $errorCode)."
        }
    }

    private fun startScan() {
        val scanner = adapter?.bluetoothLeScanner ?: return
        val filter = ScanFilter.Builder().setServiceUuid(ParcelUuid(MeshIds.SERVICE)).build()
        val settings = ScanSettings.Builder().setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY).build()
        try {
            scanner.startScan(listOf(filter), settings, scanCallback)
        } catch (e: Exception) {
            _status.value = "Recherche Bluetooth impossible : ${e.javaClass.simpleName}"
        }
    }

    private fun onFound(device: BluetoothDevice) {
        if (!_running.value) return
        val address = device.address
        val id = "c:$address"
        val now = System.currentTimeMillis()
        if (centralLinks.containsKey(id) || connecting.containsKey(address)) return
        if ((lastAttempt[address] ?: 0L) > now - RETRY_COOLDOWN_MS) return
        if (centralLinks.size + connecting.size >= MAX_CENTRAL_LINKS) return
        lastAttempt[address] = now
        connecting[address] = now
        val link = CentralLink(device)
        centralLinks[id] = link
        link.connect()
    }

    private inner class CentralLink(private val device: BluetoothDevice) : MeshLink {
        override val id = "c:" + device.address
        @Volatile private var mtu = DEFAULT_MTU
        override val maxFrameSize: Int get() = mtu - 3
        @Volatile var ready = false
        private var gatt: BluetoothGatt? = null
        private var rx: BluetoothGattCharacteristic? = null
        private val queue = ConcurrentLinkedQueue<ByteArray>()
        private val busy = AtomicBoolean(false)

        fun connect() {
            gatt = try {
                device.connectGatt(context, false, callback, BluetoothDevice.TRANSPORT_LE)
            } catch (_: Exception) {
                null
            }
            if (gatt == null) drop()
        }

        fun close() {
            ready = false
            try { gatt?.disconnect() } catch (_: Exception) {}
            try { gatt?.close() } catch (_: Exception) {}
            gatt = null
        }

        private fun drop() {
            close()
            connecting.remove(device.address)
            if (centralLinks.remove(id) != null) router.removeLink(id)
            refreshLinks()
        }

        override fun send(frame: ByteArray): Boolean {
            if (!ready || queue.size > MAX_QUEUE) return false
            queue.add(frame)
            pump()
            return true
        }

        private fun pump() {
            if (!busy.compareAndSet(false, true)) return
            val next = queue.poll() ?: run { busy.set(false); return }
            val g = gatt
            val c = rx
            val started = if (g == null || c == null) false else try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    g.writeCharacteristic(c, next, BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT) == BluetoothStatusCodes.SUCCESS
                } else {
                    @Suppress("DEPRECATION")
                    c.writeType = BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT
                    @Suppress("DEPRECATION")
                    c.value = next
                    @Suppress("DEPRECATION")
                    g.writeCharacteristic(c)
                }
            } catch (_: Exception) {
                false
            }
            if (!started) {
                busy.set(false)
                queue.clear()
            }
        }

        private val callback = object : BluetoothGattCallback() {
            override fun onConnectionStateChange(g: BluetoothGatt, status: Int, newState: Int) {
                if (newState == BluetoothProfile.STATE_CONNECTED && status == BluetoothGatt.GATT_SUCCESS) {
                    if (!g.requestMtu(TARGET_MTU)) g.discoverServices()
                } else {
                    drop()
                }
            }

            override fun onMtuChanged(g: BluetoothGatt, newMtu: Int, status: Int) {
                if (status == BluetoothGatt.GATT_SUCCESS) mtu = newMtu
                g.discoverServices()
            }

            override fun onServicesDiscovered(g: BluetoothGatt, status: Int) {
                val service = g.getService(MeshIds.SERVICE)
                val rxChar = service?.getCharacteristic(MeshIds.CHAR_RX)
                val txChar = service?.getCharacteristic(MeshIds.CHAR_TX)
                val cccd = txChar?.getDescriptor(CCCD)
                if (status != BluetoothGatt.GATT_SUCCESS || rxChar == null || txChar == null || cccd == null) return drop()
                rx = rxChar
                g.setCharacteristicNotification(txChar, true)
                val ok = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    g.writeDescriptor(cccd, BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE) == BluetoothStatusCodes.SUCCESS
                } else {
                    @Suppress("DEPRECATION")
                    cccd.value = BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE
                    @Suppress("DEPRECATION")
                    g.writeDescriptor(cccd)
                }
                if (!ok) drop()
            }

            override fun onDescriptorWrite(g: BluetoothGatt, descriptor: BluetoothGattDescriptor, status: Int) {
                if (descriptor.uuid != CCCD) return
                if (status != BluetoothGatt.GATT_SUCCESS) return drop()
                ready = true
                connecting.remove(device.address)
                router.addLink(this@CentralLink)
                refreshLinks()
            }

            override fun onCharacteristicWrite(g: BluetoothGatt, characteristic: BluetoothGattCharacteristic, status: Int) {
                busy.set(false)
                pump()
            }

            override fun onCharacteristicChanged(g: BluetoothGatt, characteristic: BluetoothGattCharacteristic, value: ByteArray) {
                if (characteristic.uuid == MeshIds.CHAR_TX) router.onFrameReceived(id, value)
            }

            @Deprecated("API < 33")
            @Suppress("DEPRECATION")
            override fun onCharacteristicChanged(g: BluetoothGatt, characteristic: BluetoothGattCharacteristic) {
                if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU && characteristic.uuid == MeshIds.CHAR_TX) {
                    characteristic.value?.let { router.onFrameReceived(id, it) }
                }
            }
        }
    }

    companion object {
        val CCCD: UUID = UUID.fromString("00002902-0000-1000-8000-00805f9b34fb")
        const val DEFAULT_MTU = 23
        const val TARGET_MTU = 517
        const val MAX_CENTRAL_LINKS = 6
        const val MAX_QUEUE = 512
        const val RETRY_COOLDOWN_MS = 10_000L
        const val MAX_LONG_WRITE = 512
    }
}
