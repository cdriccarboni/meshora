package org.meshora.app

import android.app.Application
import android.net.ConnectivityManager
import android.net.Network
import android.os.Build
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import org.meshora.app.storage.ContactStore
import org.meshora.app.storage.IdentityStorage
import org.meshora.app.storage.OutboxRepository
import org.meshora.app.storage.Settings
import org.meshora.app.transport.TransportManager
import org.meshora.app.transport.ble.MeshoraBleManager

class MeshoraApp : Application() {
    val applicationScope = CoroutineScope(SupervisorJob() + Dispatchers.Main)

    lateinit var identityStorage: IdentityStorage
        private set
    lateinit var outboxRepository: OutboxRepository
        private set
    lateinit var bleManager: MeshoraBleManager
        private set
    lateinit var transportManager: TransportManager
        private set
    lateinit var bleMesh: org.meshora.app.transport.ble.BleMesh
        private set
    lateinit var settings: Settings
        private set
    lateinit var contacts: ContactStore
        private set

    override fun onCreate() {
        super.onCreate()
        instance = this

        identityStorage = IdentityStorage(this)
        outboxRepository = OutboxRepository(this)
        settings = Settings(this)
        contacts = ContactStore(this)
        bleManager = MeshoraBleManager(this)
        transportManager = TransportManager(
            scope = applicationScope,
            identity = identityStorage.getOrCreateIdentity(),
            outboxRepository = outboxRepository,
            bleManager = bleManager,
            alias = displayAlias()
        )
        transportManager.groupRoom = settings.current.room
        bleMesh = org.meshora.app.transport.ble.BleMesh(
            context = this,
            router = transportManager.meshRouter,
            onLinksChanged = { transportManager.onMeshLinksChanged() }
        )

        watchNetwork()
        // V0.3 : connexion automatique au relais de référence (ou au relais choisi dans Réseau → Avancé).
        if (settings.current.autoConnect) connectRelay()
    }

    /** Nom affiché : celui choisi par l'utilisateur, sinon le modèle de l'appareil. */
    fun displayAlias(): String = settings.current.alias.ifBlank { Build.MODEL.take(40).ifBlank { "Android" } }

    /** (Re)connexion avec les réglages actuels. @return false si l'adresse du relais est invalide. */
    fun connectRelay(): Boolean {
        transportManager.alias = displayAlias()
        val s = settings.current
        transportManager.groupRoom = s.room // clé de scellement des trames Bluetooth
        return transportManager.connectWebSocket(s.relayUrl, s.room)
    }

    private fun watchNetwork() {
        val cm = getSystemService(ConnectivityManager::class.java) ?: return
        transportManager.webSocketTransport.networkAvailable = cm.activeNetwork != null
        try {
            cm.registerDefaultNetworkCallback(object : ConnectivityManager.NetworkCallback() {
                override fun onAvailable(network: Network) {
                    transportManager.webSocketTransport.networkAvailable = true
                    transportManager.webSocketTransport.reconnectNow()
                }

                override fun onLost(network: Network) {
                    transportManager.webSocketTransport.networkAvailable = cm.activeNetwork != null
                }
            })
        } catch (_: Exception) {
            // Sans rappel réseau, la reconnexion progressive (2 s → 60 s) reste active.
        }
    }

    companion object {
        lateinit var instance: MeshoraApp
            private set
    }
}
