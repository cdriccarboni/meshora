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
import org.meshora.app.model.Message
import org.meshora.app.model.MessageStatus
import org.meshora.app.model.Peer
import org.meshora.app.storage.OutboxRepository
import org.meshora.app.transport.ble.MeshoraBleManager
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
    private val alias: String = "Android",
    private val clock: () -> Long = System::currentTimeMillis
) {
    private val myPrivateKey = CryptoEngine.importPrivateKey(identity.privateKeyPkcs8Hex)
    private val flushMutex = Mutex()

    /** messageId → (empreinte d'enveloppe → clé du destinataire), pour valider les accusés. */
    private val sentEnvelopes = ConcurrentHashMap<String, MutableMap<String, String>>()
    private data class Retry(val attempts: Int, val nextAt: Long)
    private val retryState = ConcurrentHashMap<String, Retry>()
    private val lastAckAt = ConcurrentHashMap<String, Long>()

    val webSocketTransport = WebSocketTransport(
        scope = scope,
        onEnvelopeReceived = { env -> handleIncomingEnvelope(env) },
        onAckReceived = { ack -> handleIncomingAck(ack) },
        onPeersUpdated = { peers ->
            outboxRepository.updatePeers(peers)
            flushOutbox(force = true)
        },
        onAuthenticated = { flushOutbox(force = true) }
    )

    init {
        scope.launch(Dispatchers.Default) {
            while (isActive) {
                delay(RETRY_MS)
                flushOutbox()
            }
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
        val envelope = CryptoEngine.encryptEnvelope(
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
        if (!webSocketTransport.isConnected()) return false
        return try {
            val envelope = prepareEnvelope(msg)
            val sent = webSocketTransport.sendEnvelope(envelope)
            val previous = retryState[msg.id]?.attempts ?: 0
            val attempts = if (sent) previous + 1 else previous
            retryState[msg.id] = Retry(attempts, clock() + backoff(attempts))
            if (sent) outboxRepository.markSent(msg.id, "WebSocket")
            sent
        } catch (e: Exception) {
            outboxRepository.markFailed(msg.id) // clé destinataire inutilisable : échec visible
            false
        }
    }

    fun handleIncomingEnvelope(envelope: EncryptedEnvelope) {
        if (envelope.recipientPublicKeyHex != identity.publicKeyHex) return

        val plaintext = try {
            CryptoEngine.decryptEnvelope(envelope, myPrivateKey) // vérifie la signature de l'expéditeur
        } catch (e: Exception) {
            return
        }

        val senderId = WebSocketTransport.deriveId(envelope.senderPublicKeyHex)
        val localId = "$senderId:${envelope.id}"

        // Accusé (réémis au plus une fois par fenêtre si le même message revient)
        val now = clock()
        val last = lastAckAt[localId]
        if (last == null || now - last >= ACK_REEMIT_MS) {
            lastAckAt[localId] = now
            webSocketTransport.sendAck(CryptoEngine.createSignedAck(envelope, myPrivateKey))
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
                transportUsed = "WebSocket"
            )
        )
        outboxRepository.addOrUpdatePeer(
            Peer(
                publicKeyHex = envelope.senderPublicKeyHex,
                fingerprint = senderFingerprint,
                displayName = "Pair ${senderFingerprint.take(9)}",
                lastSeen = now,
                transport = "WebSocket",
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
        if (!webSocketTransport.isConnected()) return
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

        fun backoff(attempts: Int): Long =
            minOf(RETRY_MS shl minOf(attempts, 10), MAX_BACKOFF_MS)
    }
}
