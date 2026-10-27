package org.meshora.app.transport.ble

import android.bluetooth.*
import android.bluetooth.le.*
import android.content.Context
import android.os.ParcelUuid
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.util.UUID

/**
 * Ancienne interface Bluetooth (V0.2), conservée pour l'état affiché ; le Bluetooth réel est dans [BleMesh].
 * Correction A-P1-7 : plus aucun UUID 16 bits 0xFE60–0xFE62 (plage attribuée par le Bluetooth SIG à ses membres) ;
 * les identifiants sont les UUID 128 bits aléatoires de [org.meshora.app.mesh.MeshIds].
 */
class MeshoraBleManager(private val context: Context) {
    companion object {
        val MESHORA_SERVICE_UUID: UUID = org.meshora.app.mesh.MeshIds.SERVICE
        val MESHORA_TX_CHAR_UUID: UUID = org.meshora.app.mesh.MeshIds.CHAR_TX
        val MESHORA_RX_CHAR_UUID: UUID = org.meshora.app.mesh.MeshIds.CHAR_RX
    }

    private val bluetoothManager = context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
    private val adapter: BluetoothAdapter? = bluetoothManager?.adapter

    private val _isScanning = MutableStateFlow(false)
    val isScanning: StateFlow<Boolean> = _isScanning.asStateFlow()

    private val _isAdvertising = MutableStateFlow(false)
    val isAdvertising: StateFlow<Boolean> = _isAdvertising.asStateFlow()

    private val _statusMessage = MutableStateFlow("Bluetooth LE : non implémenté dans cette version (spécification seulement).")
    val statusMessage: StateFlow<String> = _statusMessage.asStateFlow()

    fun isBleSupported(): Boolean {
        return adapter != null
    }

    fun isBluetoothEnabled(): Boolean {
        return adapter?.isEnabled == true
    }

    /**
     * Démarrage sécurisé du balayage de découverte BLE
     * Ne déclare aucun pair avant détection réelle du service MESHORA
     */
    fun startScan() {
        if (!isBleSupported() || !isBluetoothEnabled()) {
            _statusMessage.value = "Bluetooth indisponible ou désactivé."
            return
        }

        try {
            val scanner = adapter?.bluetoothLeScanner
            if (scanner == null) {
                _statusMessage.value = "Scanner BLE indisponible."
                return
            }

            val filter = ScanFilter.Builder()
                .setServiceUuid(ParcelUuid(MESHORA_SERVICE_UUID))
                .build()

            val settings = ScanSettings.Builder()
                .setScanMode(ScanSettings.SCAN_MODE_LOW_POWER)
                .build()

            // Contre-audit V0.2 : aucun appel à scanner.startScan() n'est encore implémenté.
            // Ne pas afficher « actif » tant que rien ne balaie réellement.
            _isScanning.value = false
            _statusMessage.value = "Balayage BLE non implémenté dans cette version (aucune recherche lancée)."
        } catch (e: SecurityException) {
            _statusMessage.value = "Autorisations Bluetooth SCAN manquantes."
            _isScanning.value = false
        }
    }

    fun stopScan() {
        _isScanning.value = false
        _statusMessage.value = "Balayage BLE arrêté."
    }

    /**
     * Démarrage de l'annonce périphérique GATT
     */
    fun startAdvertising() {
        if (!isBleSupported() || !isBluetoothEnabled()) return

        try {
            val advertiser = adapter?.bluetoothLeAdvertiser
            if (advertiser == null) {
                _statusMessage.value = "Mode Périphérique BLE non supporté sur ce matériel."
                return
            }
            // Contre-audit V0.2 : aucun appel à advertiser.startAdvertising() n'est encore implémenté.
            _isAdvertising.value = false
            _statusMessage.value = "Annonce BLE non implémentée dans cette version (rien n'est émis)."
        } catch (e: SecurityException) {
            _statusMessage.value = "Autorisations Bluetooth ADVERTISE manquantes."
            _isAdvertising.value = false
        }
    }

    fun stopAdvertising() {
        _isAdvertising.value = false
        _statusMessage.value = "Annonce périphérique BLE arrêtée."
    }
}
