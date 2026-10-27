package org.meshora.app.transport

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import org.meshora.app.crypto.CryptoEngine
import org.meshora.app.crypto.EncryptedEnvelope
import org.meshora.app.crypto.KeyIdentity
import org.meshora.app.crypto.SignedAck
import org.meshora.app.crypto.SignedPrekey
import org.meshora.app.storage.PrekeyStore
import org.meshora.app.model.Message
import org.meshora.app.model.MessageStatus
import org.meshora.app.model.Peer
import org.meshora.app.storage.OutboxRepository
import org.meshora.app.transport.ble.MeshoraBleManager
import org.meshora.app.mesh.GroupSeal
import org.meshora.app.mesh.MeshFrame
import org.meshora.app.mesh.MeshRouter
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.nio.charset.StandardCharsets
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

/**
 * Orchestration des envois (Outbox), réceptions et accusés.
 * Contre-audit V0.2 :
 *  - « Délivré » exige un accusé v2 signé par le destinataire, portant notre clé d'expéditeur
 *    et l'empreinte d'une enveloppe que nous avons réellement émise pour ce message ;
 *  - un message reçu est identifié par (expéditeur, identifiant) : un tiers ne peut pas le faire écarter ;
 *  - renvois avec attente progressive par message (15 s → 10 min) et au plus [MAX_PER_PASS] par passe ;
 *  - réémission d'accusé limitée à une par message et par [ACK_REEMIT_MS].
 */
class TransportManager(
    private val scope: CoroutineScope,
    val identity: KeyIdentity,
    val outboxRepository: OutboxRepository,
    val bleManager: MeshoraBleManager? = null,
    alias: String = "Android",
    private val clock: () -> Long = System::currentTimeMillis,
    /** V0.4 étape A : prékeys de réception (en mémoire par défaut ; magasin chiffré dans l'application). */
    val prekeys: PrekeyStore = PrekeyStore(clock = clock)
) {
    /** Nom affiché aux autres (modifiable dans Réseau ; pris en compte à la prochaine connexion). */
    @Volatile var alias: String = alias

    private val myPrivateKey = CryptoEngine.importPrivateKey(identity.privateKeyPkcs8Hex)
    private val flushMutex = Mutex()

    /** messageId → (empreinte d'enveloppe → clé du destinataire), pour valider les accusés. */
    private val sentEnvelopes = ConcurrentHashMap<String, MutableMap<String, String>>()
    private data class Retry(val attempts: Int, val nextAt: Long)
    private val retryState = ConcurrentHashMap<String, Retry>()
    private val lastAckAt = ConcurrentHashMap<String, Long>()

    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }

    /** Pairs vus par le relais Internet et par le maillage radio, publiés ensemble. */
    @Volatile private var relayPeers: List<Peer> = emptyList()
    private val meshPeers = ConcurrentHashMap<String, Peer>()

    private fun publishPeers() {
        val now = clock()
        meshPeers.entries.removeIf { now - it.value.lastSeen > MESH_PEER_TTL_MS }
        val merged = LinkedHashMap<String, Peer>()
        relayPeers.forEach { merged[it.publicKeyHex] = it }
        meshPeers.values.forEach { p ->
            val existing = merged[p.publicKeyHex]
            merged[p.publicKeyHex] = if (existing == null) p else existing.copy(transport = existing.transport + " + Bluetooth")
        }
        outboxRepository.updatePeers(merged.values.toList())
    }

    val webSocketTransport = WebSocketTransport(
        scope = scope,
        onEnvelopeReceived = { env -> onRelayEnvelope(env) },
        onAckReceived = { ack -> onRelayAck(ack) },
        onPeersUpdated = { peers ->
            relayPeers = peers
            publishPeers()
            flushOutbox(force = true)
        },
        onAuthenticated = { flushOutbox(force = true); resendDelegations() },
        prekeyProvider = { myPrekey().also { announcedPrekeyId = it.id } },
        onPeerPrekey = { pub, p -> prekeys.rememberPeer(pub, p) }
    )

    // ------------------------------------------------------------------ prékeys (V0.4 étape A)

    @Volatile private var announcedPrekeyId: String? = null
    /** Nombre d'enveloppes v3 déchiffrées (observabilité des essais ; aucune donnée de contenu). */
    internal val receivedV3 = java.util.concurrent.atomic.AtomicInteger(0)
    private fun myPrekey(): SignedPrekey = prekeys.current(myPrivateKey, identity.publicKeyHex)

    /** Rotation hebdomadaire pendant une longue connexion : annonce la nouvelle prékey sans se reconnecter. */
    internal fun refreshPrekey() {
        if (!webSocketTransport.isConnected()) return
        val p = runCatching { myPrekey() }.getOrNull() ?: return
        if (p.id != announcedPrekeyId && webSocketTransport.sendPrekey(p)) announcedPrekeyId = p.id
    }

    /** Routeur du maillage radio (Bluetooth LE aujourd'hui), alimenté par BleMesh. */
    val meshRouter = MeshRouter(onMessage = { type, payload, _, _ -> handleMeshMessage(type, payload) })

    private fun meshAvailable() = meshRouter.linkCount() > 0
    private fun anyTransport() = webSocketTransport.isConnected() || meshAvailable()

    /** À appeler quand des liens radio apparaissent ou disparaissent. */
    fun onMeshLinksChanged() {
        if (meshAvailable()) {
            announceOnMesh()
            flushOutbox(force = true)
        }
    }

    init {
        scope.launch(Dispatchers.Default) {
            while (isActive) {
                delay(RETRY_MS)
                flushOutbox()
            }
        }
        scope.launch(Dispatchers.Default) {
            while (isActive) {
                delay(PREKEY_CHECK_MS)
                refreshPrekey()
                prekeys.purge()
            }
        }
        scope.launch(Dispatchers.Default) {
            while (isActive) {
                delay(ANNOUNCE_MS)
                if (meshAvailable()) announceOnMesh()
                publishPeers()
            }
        }
    }

    // ------------------------------------------------------------------ maillage radio

    /** Annonce signée : clé publique, pseudonyme, horodatage (relayée sur 2 sauts). */
    @Serializable
    data class MeshAnnounce(
        val publicKey: String, val alias: String, val timestamp: Long, val signature: String, val gateway: Boolean = false,
        /** V0.4 étape A : prékey signée par l'identité (vérifiée séparément), jointe une annonce sur [PREKEY_ANNOUNCE_EVERY]. */
        val prekey: SignedPrekey? = null
    )
    private var announceCount = 0

    /** « v1g » : l'annonce signée déclare une passerelle Internet (option activée ET relais authentifié). */
    private fun announcePayload(pub: String, al: String, ts: Long, gateway: Boolean = false) =
        "MESHORA-ANNOUNCE|${if (gateway) "v1g" else "v1"}|$pub|$al|$ts"

    /**
     * Code du groupe (salon) : sert de secret pour sceller les trames Bluetooth ([GroupSeal]).
     * Sans groupe, rien n'est émis par Bluetooth (jamais de nom ni de clé publique en clair).
     */
    @Volatile var groupRoom: String? = null

    /** Émet une charge utile scellée pour le groupe. @return nombre de liens qui l'ont acceptée. */
    private fun broadcastSealed(inner: MeshFrame.Type, bytes: ByteArray, ttl: Int, idLabel: String?): Int {
        val room = groupRoom ?: return 0
        val day = GroupSeal.dayOf(clock())
        val sealed = GroupSeal.seal(room, day, inner, bytes)
        val id = idLabel?.let { GroupSeal.frameId(room, day, it) } ?: MeshFrame.newMessageId()
        return meshRouter.broadcast(MeshFrame.Type.SEALED, sealed, ttl = ttl, messageId = id)
    }

    fun announceOnMesh() {
        val ts = clock()
        val gw = isGatewayActive()
        val sig = CryptoEngine.signData(myPrivateKey, announcePayload(identity.publicKeyHex, alias, ts, gw))
        val withPrekey = (announceCount++ % PREKEY_ANNOUNCE_EVERY) == 0
        val pk = if (withPrekey) runCatching { myPrekey() }.getOrNull() else null
        val bytes = json.encodeToString(MeshAnnounce(identity.publicKeyHex, alias, ts, sig, gw, pk)).toByteArray(StandardCharsets.UTF_8)
        broadcastSealed(MeshFrame.Type.ANNOUNCE, bytes, ANNOUNCE_TTL, idLabel = null)
        if (!webSocketTransport.isConnected()) sendDelegations()
    }

    // ------------------------------------------------------------------ passerelle Internet par les voisins (V0.4)

    /** Option « servir de passerelle pour mon groupe » (désactivée par défaut). */
    @Volatile var gatewayEnabled: Boolean = false
    fun isGatewayActive() = gatewayEnabled && webSocketTransport.isConnected() && groupRoom != null

    /** Côté passerelle : clés servies (délégations reçues) → expiration. */
    private val served = ConcurrentHashMap<String, Long>()
    private data class Delegation(val publicKey: String, val gateway: String, val alias: String, val timestamp: Long, val signature: String, val prekey: SignedPrekey? = null)
    private val lastDelegation = ConcurrentHashMap<String, Delegation>()
    private val lastServeSent = ConcurrentHashMap<String, Long>()
    /** Côté membre sans Internet : passerelles vues (annonces « v1g ») → dernière vue. */
    private val gateways = ConcurrentHashMap<String, Long>()
    /** Déduplication des éléments portés vers le relais. */
    private val forwarded = ConcurrentHashMap<String, Long>()

    @Serializable
    data class MeshDelegation(val publicKey: String, val gateway: String, val alias: String, val timestamp: Long, val signature: String, val prekey: SignedPrekey? = null)

    private fun delegationPayload(room: String, pub: String, gw: String, ts: Long) = "MESHORA-DELEGATE|v1|$room|$pub|$gw|$ts"

    fun isServing(key: String) = (served[key] ?: 0L) > clock()

    /** Membre sans Internet : délègue sa réception aux passerelles du groupe vues récemment. */
    private fun sendDelegations() {
        val room = groupRoom ?: return
        val now = clock()
        gateways.entries.removeIf { now - it.value > MESH_PEER_TTL_MS }
        for (gw in gateways.keys) {
            val sig = CryptoEngine.signData(myPrivateKey, delegationPayload(room, identity.publicKeyHex, gw, now))
            val pk = runCatching { myPrekey() }.getOrNull()
            val bytes = json.encodeToString(MeshDelegation(identity.publicKeyHex, gw, alias, now, sig, pk)).toByteArray(StandardCharsets.UTF_8)
            broadcastSealed(MeshFrame.Type.DELEGATE, bytes, ANNOUNCE_TTL, idLabel = null)
        }
    }

    private fun onDelegation(d: MeshDelegation) {
        val room = groupRoom ?: return
        if (d.gateway != identity.publicKeyHex || !isGatewayActive()) return
        val now = clock()
        if (kotlin.math.abs(now - d.timestamp) > DELEGATION_MAX_AGE_MS) return
        if (CryptoEngine.normalizePublicKeyHex(d.publicKey) != d.publicKey) return
        if (!CryptoEngine.verifySignature(d.publicKey, d.signature, delegationPayload(room, d.publicKey, d.gateway, d.timestamp))) return
        served[d.publicKey] = now + SERVED_TTL_MS
        val pk = d.prekey?.takeIf { CryptoEngine.verifyPrekey(d.publicKey, it, now) }
        lastDelegation[d.publicKey] = Delegation(d.publicKey, d.gateway, d.alias, d.timestamp, d.signature, pk)
        if (now - (lastServeSent[d.publicKey] ?: 0L) >= SERVE_REFRESH_MS) {
            lastServeSent[d.publicKey] = now
            webSocketTransport.sendServe(d.publicKey, d.gateway, d.alias, d.timestamp, d.signature, pk)
        }
    }

    /** Après une reconnexion au relais : représente les délégations encore fraîches. */
    private fun resendDelegations() {
        val now = clock()
        lastDelegation.values.filter { now - it.timestamp <= DELEGATION_MAX_AGE_MS && isServing(it.publicKey) }.forEach {
            lastServeSent[it.publicKey] = now
            webSocketTransport.sendServe(it.publicKey, it.gateway, it.alias, it.timestamp, it.signature, it.prekey)
        }
    }

    private fun firstTime(key: String): Boolean {
        val now = clock()
        forwarded.entries.removeIf { now - it.value > 10 * 60_000L }
        return forwarded.putIfAbsent(key, now) == null
    }

    /** Relais → nous : pour nous, ou pour un voisin servi (renvoyé par Bluetooth, toujours chiffré pour lui). */
    private fun onRelayEnvelope(env: EncryptedEnvelope) {
        if (env.recipientPublicKeyHex == identity.publicKeyHex) return handleIncomingEnvelope(env)
        if (isServing(env.recipientPublicKeyHex) && meshAvailable() && firstTime("re|" + env.signatureHex)) {
            broadcastSealed(MeshFrame.Type.ENVELOPE, json.encodeToString(env).toByteArray(StandardCharsets.UTF_8), MeshFrame.MAX_TTL,
                idLabel = "env|" + CryptoEngine.envelopeHash(env))
        }
    }

    private fun onRelayAck(ack: SignedAck) {
        if (ack.senderPublicKeyHex == identity.publicKeyHex) return handleIncomingAck(ack)
        if (isServing(ack.senderPublicKeyHex) && meshAvailable() && firstTime("ra|" + ack.signatureHex)) {
            val digest = CryptoEngine.bytesToHex(java.security.MessageDigest.getInstance("SHA-256").digest(ack.signatureHex.toByteArray(StandardCharsets.UTF_8)))
            broadcastSealed(MeshFrame.Type.ACK, json.encodeToString(ack).toByteArray(StandardCharsets.UTF_8), MeshFrame.MAX_TTL, idLabel = "ack|$digest")
        }
    }

    private fun meshKeys(): Set<String> = meshPeers.keys.toSet()

    private fun handleMeshMessage(outerType: MeshFrame.Type, sealedPayload: ByteArray) {
        // V0.3 : seules les trames scellées par NOTRE groupe sont lues ; les autres sont seulement relayées (par le routeur).
        if (outerType != MeshFrame.Type.SEALED) return
        val room = groupRoom ?: return
        val (type, payload) = GroupSeal.open(room, sealedPayload, clock()) ?: return
        val text = String(payload, StandardCharsets.UTF_8)
        try {
            when (type) {
                MeshFrame.Type.ENVELOPE -> {
                    val env = json.decodeFromString<EncryptedEnvelope>(text)
                    if (env.recipientPublicKeyHex == identity.publicKeyHex) handleIncomingEnvelope(env, via = "Bluetooth")
                    // Passerelle : destinataire hors du maillage → porté au relais (qui vérifie la signature de l'auteur).
                    else if (isGatewayActive() && env.recipientPublicKeyHex !in meshKeys() && firstTime("fe|" + env.signatureHex)) webSocketTransport.sendForwardEnvelope(env)
                }
                MeshFrame.Type.ACK -> {
                    val ack = json.decodeFromString<SignedAck>(text)
                    if (ack.senderPublicKeyHex == identity.publicKeyHex) handleIncomingAck(ack)
                    else if (isGatewayActive() && ack.senderPublicKeyHex !in meshKeys() && firstTime("fa|" + ack.signatureHex)) webSocketTransport.sendForwardAck(ack)
                }
                MeshFrame.Type.DELEGATE -> onDelegation(json.decodeFromString<MeshDelegation>(text))
                MeshFrame.Type.ANNOUNCE -> {
                    val a = json.decodeFromString<MeshAnnounce>(text)
                    val now = clock()
                    if (a.publicKey == identity.publicKeyHex) return
                    if (kotlin.math.abs(now - a.timestamp) > ANNOUNCE_MAX_AGE_MS) return
                    if (CryptoEngine.normalizePublicKeyHex(a.publicKey) != a.publicKey) return
                    if (!CryptoEngine.verifySignature(a.publicKey, a.signature, announcePayload(a.publicKey, a.alias, a.timestamp, a.gateway))) return
                    if (a.gateway) gateways[a.publicKey] = now else gateways.remove(a.publicKey)
                    if (a.prekey != null) prekeys.rememberPeer(a.publicKey, a.prekey)
                    val fp = CryptoEngine.computeFingerprint(a.publicKey)
                    val isNew = !meshPeers.containsKey(a.publicKey)
                    meshPeers[a.publicKey] = Peer(a.publicKey, fp, "${a.alias.take(64)} · ${fp.take(9)}", now, "Bluetooth", true)
                    publishPeers()
                    if (isNew) flushOutbox(force = true)
                }
                MeshFrame.Type.SEALED -> Unit
            }
        } catch (_: Exception) {
            // charge utile invalide : ignorée
        }
    }

    private fun sendAckEverywhere(ack: SignedAck) {
        webSocketTransport.sendAck(ack)
        if (meshAvailable()) {
            val bytes = json.encodeToString(ack).toByteArray(StandardCharsets.UTF_8)
            val digest = CryptoEngine.bytesToHex(java.security.MessageDigest.getInstance("SHA-256").digest(ack.signatureHex.toByteArray(StandardCharsets.UTF_8)))
            broadcastSealed(MeshFrame.Type.ACK, bytes, MeshFrame.MAX_TTL, idLabel = "ack|$digest")
        }
    }

    fun connectWebSocket(url: String, room: String): Boolean =
        webSocketTransport.connect(url, room, identity, alias)

    fun disconnectWebSocket() {
        webSocketTransport.disconnect()
    }

    /**
     * @return l'identifiant du message, ou null si la clé du destinataire est invalide (rien n'est enregistré).
     */
    fun sendMessage(recipientPublicKeyHex: String, plaintext: String): String? {
        val recipient = CryptoEngine.normalizePublicKeyHex(recipientPublicKeyHex) ?: return null
        if (plaintext.isBlank()) return null
        val messageId = "msg-" + UUID.randomUUID().toString()
        val recipientFingerprint = CryptoEngine.computeFingerprint(recipient)

        val message = Message(
            id = messageId,
            conversationId = recipientFingerprint,
            senderFingerprint = identity.fingerprint,
            recipientFingerprint = recipientFingerprint,
            senderPublicKeyHex = identity.publicKeyHex,
            recipientPublicKeyHex = recipient,
            content = plaintext,
            timestamp = clock(),
            status = MessageStatus.QUEUED,
            transportUsed = "outbox"
        )
        // 1. Sauvegarde systématique dans l'Outbox locale (règle de non-perte)
        outboxRepository.enqueueMessage(message)
        // 2. Tentative d'envoi immédiate (chiffrée)
        scope.launch(Dispatchers.Default) { trySend(message) }
        return messageId
    }

    /** Chiffre un message de l'Outbox et mémorise l'empreinte de l'enveloppe (validation des accusés). */
    internal fun prepareEnvelope(msg: Message): EncryptedEnvelope {
        // V0.4 étape A : prékey vérifiée connue → v3 (confidentialité persistante) ; sinon v2.
        val pk = prekeys.peer(msg.recipientPublicKeyHex)
        val envelope = if (pk != null) CryptoEngine.encryptEnvelopeV3(
            messageId = msg.id,
            senderPrivateKey = myPrivateKey,
            senderPublicKeyHex = identity.publicKeyHex,
            recipientPublicKeyHex = msg.recipientPublicKeyHex,
            prekey = pk,
            plaintext = msg.content,
            timestamp = clock()
        ) else CryptoEngine.encryptEnvelope(
            messageId = msg.id,
            senderPrivateKey = myPrivateKey,
            senderPublicKeyHex = identity.publicKeyHex,
            recipientPublicKeyHex = msg.recipientPublicKeyHex,
            plaintext = msg.content
        )
        val hashes = sentEnvelopes.getOrPut(msg.id) { ConcurrentHashMap() }
        hashes[CryptoEngine.envelopeHash(envelope)] = msg.recipientPublicKeyHex
        if (sentEnvelopes.size > 1000) sentEnvelopes.keys.take(200).forEach { sentEnvelopes.remove(it) }
        return envelope
    }

    private fun trySend(msg: Message): Boolean {
        if (!anyTransport()) return false
        return try {
            val envelope = prepareEnvelope(msg)
            val viaRelay = webSocketTransport.sendEnvelope(envelope)
            val viaMesh = meshAvailable() && broadcastSealed(
                MeshFrame.Type.ENVELOPE,
                json.encodeToString(envelope).toByteArray(StandardCharsets.UTF_8),
                MeshFrame.MAX_TTL,
                idLabel = "env|" + CryptoEngine.envelopeHash(envelope)
            ) > 0
            val sent = viaRelay || viaMesh
            val previous = retryState[msg.id]?.attempts ?: 0
            val attempts = if (sent) previous + 1 else previous
            retryState[msg.id] = Retry(attempts, clock() + backoff(attempts))
            if (sent) outboxRepository.markSent(msg.id, listOfNotNull(if (viaRelay) "WebSocket" else null, if (viaMesh) "Bluetooth" else null).joinToString(" + "))
            sent
        } catch (e: Exception) {
            outboxRepository.markFailed(msg.id) // clé destinataire inutilisable : échec visible
            false
        }
    }

    fun handleIncomingEnvelope(envelope: EncryptedEnvelope, via: String = "WebSocket") {
        if (envelope.recipientPublicKeyHex != identity.publicKeyHex) return

        val plaintext = try {
            CryptoEngine.decryptEnvelope(envelope, myPrivateKey) { id -> prekeys.privateFor(id) } // vérifie la signature de l'expéditeur
        } catch (e: Exception) {
            return
        }

        if (envelope.v == 3) receivedV3.incrementAndGet()
        val senderId = WebSocketTransport.deriveId(envelope.senderPublicKeyHex)
        val localId = "$senderId:${envelope.id}"

        // Accusé (réémis au plus une fois par fenêtre si le même message revient)
        val now = clock()
        val last = lastAckAt[localId]
        if (last == null || now - last >= ACK_REEMIT_MS) {
            lastAckAt[localId] = now
            sendAckEverywhere(CryptoEngine.createSignedAck(envelope, myPrivateKey))
            if (lastAckAt.size > 2000) lastAckAt.keys.take(500).forEach { lastAckAt.remove(it) }
        }

        if (outboxRepository.hasSeenMessage(localId)) return

        val senderFingerprint = CryptoEngine.computeFingerprint(envelope.senderPublicKeyHex)
        outboxRepository.enqueueMessage(
            Message(
                id = localId,
                conversationId = senderFingerprint,
                senderFingerprint = senderFingerprint,
                recipientFingerprint = identity.fingerprint,
                senderPublicKeyHex = envelope.senderPublicKeyHex,
                recipientPublicKeyHex = envelope.recipientPublicKeyHex,
                content = plaintext,
                timestamp = envelope.timestamp,
                status = MessageStatus.DELIVERED,
                transportUsed = via
            )
        )
        outboxRepository.addOrUpdatePeer(
            Peer(
                publicKeyHex = envelope.senderPublicKeyHex,
                fingerprint = senderFingerprint,
                displayName = "Pair ${senderFingerprint.take(9)}",
                lastSeen = now,
                transport = via,
                isDirect = true
            )
        )
    }

    fun handleIncomingAck(ack: SignedAck) {
        val target = outboxRepository.messagesFlow.value.firstOrNull { it.id == ack.messageId } ?: return
        if (target.senderPublicKeyHex != identity.publicKeyHex) return
        if (ack.senderPublicKeyHex != identity.publicKeyHex) return
        if (target.recipientPublicKeyHex != ack.recipientPublicKeyHex) return
        if (sentEnvelopes[ack.messageId]?.get(ack.envelopeHash) != ack.recipientPublicKeyHex) return
        if (!CryptoEngine.verifySignedAck(ack)) return
        outboxRepository.markDelivered(ack.messageId)
        retryState.remove(ack.messageId)
    }

    /**
     * Renvoie les messages en attente dont l'échéance est passée (ou tous si [force]),
     * au plus [MAX_PER_PASS] à la fois.
     */
    fun flushOutbox(force: Boolean = false) {
        if (!anyTransport()) return
        scope.launch(Dispatchers.Default) {
            if (!flushMutex.tryLock()) return@launch
            try {
                val now = clock()
                val online = outboxRepository.peersFlow.value.map { it.publicKeyHex }.toSet()
                outboxRepository.getPendingOutbox()
                    .filter { it.senderPublicKeyHex == identity.publicKeyHex }
                    // Forcé seulement vers un destinataire présent ; sinon selon l'attente progressive.
                    .filter { (force && it.recipientPublicKeyHex in online) || (retryState[it.id]?.nextAt ?: 0L) <= now }
                    .take(MAX_PER_PASS)
                    .forEach { trySend(it) }
            } finally {
                flushMutex.unlock()
            }
        }
    }

    companion object {
        const val RETRY_MS = 15_000L
        const val MAX_BACKOFF_MS = 10 * 60_000L
        const val MAX_PER_PASS = 20
        const val ACK_REEMIT_MS = 30_000L
        const val ANNOUNCE_MS = 20_000L
        const val ANNOUNCE_TTL = 2
        const val ANNOUNCE_MAX_AGE_MS = 10 * 60_000L
        const val DELEGATION_MAX_AGE_MS = 10 * 60_000L
        const val SERVED_TTL_MS = 15 * 60_000L
        const val SERVE_REFRESH_MS = 60_000L
        const val MESH_PEER_TTL_MS = 90_000L
        const val PREKEY_CHECK_MS = 3_600_000L
        const val PREKEY_ANNOUNCE_EVERY = 3

        fun backoff(attempts: Int): Long =
            minOf(RETRY_MS shl minOf(attempts, 10), MAX_BACKOFF_MS)
    }
}
