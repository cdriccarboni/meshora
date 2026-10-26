package org.meshora.app

import android.app.Application
import android.net.ConnectivityManager
import android.net.Network
import android.os.Build
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
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
    lateinit var tor: org.meshora.app.transport.TorManager
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
            alias = displayAlias(),
            prekeys = org.meshora.app.storage.PrekeyStore.forApp(this)
        )
        transportManager.groupRoom = settings.current.room
        transportManager.gatewayEnabled = settings.current.gatewayEnabled
        bleMesh = org.meshora.app.transport.ble.BleMesh(
            context = this,
            router = transportManager.meshRouter,
            onLinksChanged = { transportManager.onMeshLinksChanged() }
        )

        rememberConversationPartners()

        tor = org.meshora.app.transport.TorManager(this)
        tor.onReady = { transportManager.webSocketTransport.reconnectNow() }
        transportManager.webSocketTransport.proxyProvider = { tor.proxy() }
        applyTorSetting()

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

    /**
     * Toute personne avec qui un message a été échangé, vue connectée dans le groupe, est enregistrée comme
     * contact (NON vérifié, sauf si elle l'était déjà par invitation) : son nom reste affiché quand elle se déconnecte.
     */
    private fun rememberConversationPartners() {
        applicationScope.launch {
            kotlinx.coroutines.flow.combine(outboxRepository.messagesFlow, outboxRepository.peersFlow) { msgs, peers -> msgs to peers }
                .collect { (msgs, peers) ->
                    val myFp = transportManager.identity.fingerprint
                    val partners = msgs.mapTo(HashSet()) { if (it.senderFingerprint == myFp) it.recipientPublicKeyHex else it.senderPublicKeyHex }
                    for (p in peers) {
                        if (p.publicKeyHex in partners && contacts.get(p.publicKeyHex) == null) {
                            contacts.upsert(p.publicKeyHex, p.displayName.substringBeforeLast(" · "), verified = false)
                        }
                    }
                }
        }
    }

    /** Mode Tor (expérimental) : démarre ou arrête Tor et impose (ou non) le passage par Tor. */
    fun applyTorSetting() {
        val on = settings.current.torEnabled
        transportManager.webSocketTransport.requireProxy = on
        if (on) tor.start() else tor.stop()
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
