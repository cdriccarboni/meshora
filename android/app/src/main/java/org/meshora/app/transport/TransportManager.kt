package org.meshora.app.transport

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
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

/**
 * Orchestration des envois (Outbox), réceptions et accusés.
 * Contre-audit V0.2 : l'identité est injectée (testable sur JVM), « Délivré » exige un ACK signé
 * par la clé à laquelle le message a été chiffré, et l'Outbox est renvoyée à l'authentification,
 * à l'arrivée d'un pair et toutes les [RETRY_MS] millisecondes.
 */
class TransportManager(
    private val scope: CoroutineScope,
    val identity: KeyIdentity,
    val outboxRepository: OutboxRepository,
    val bleManager: MeshoraBleManager? = null,
    private val alias: String = "Android"
) {
    private val myPrivateKey = CryptoEngine.importPrivateKey(identity.privateKeyPkcs8Hex)
    private val flushMutex = Mutex()

    val webSocketTransport = WebSocketTransport(
        scope = scope,
        onEnvelopeReceived = { env -> handleIncomingEnvelope(env) },
        onAckReceived = { ack -> handleIncomingAck(ack) },
        onPeersUpdated = { peers ->
            outboxRepository.updatePeers(peers)
            flushOutbox()
        },
        onAuthenticated = { flushOutbox() }
    )

    init {
        scope.launch(Dispatchers.Default) {
            while (isActive) {
                delay(RETRY_MS)
                if (outboxRepository.getPendingOutbox().any { it.senderPublicKeyHex == identity.publicKeyHex }) {
                    flushOutbox()
                }
            }
        }
    }

    fun connectWebSocket(url: String, room: String): Boolean =
        webSocketTransport.connect(url, room, identity, alias)

    fun disconnectWebSocket() {
        webSocketTransport.disconnect()
    }

    fun sendMessage(recipientPublicKeyHex: String, plaintext: String): String {
        val messageId = "msg-" + UUID.randomUUID().toString()
        val recipientFingerprint = CryptoEngine.computeFingerprint(recipientPublicKeyHex)

        val message = Message(
            id = messageId,
            conversationId = recipientFingerprint,
            senderFingerprint = identity.fingerprint,
            recipientFingerprint = recipientFingerprint,
            senderPublicKeyHex = identity.publicKeyHex,
            recipientPublicKeyHex = recipientPublicKeyHex,
            content = plaintext,
            timestamp = System.currentTimeMillis(),
            status = MessageStatus.QUEUED,
            transportUsed = "outbox"
        )

        // 1. Sauvegarde systématique dans l'Outbox locale (règle de non-perte)
        outboxRepository.enqueueMessage(message)
        // 2. Tentative d'envoi immédiate (chiffrée)
        scope.launch(Dispatchers.Default) { trySend(message) }
        return messageId
    }

    private fun trySend(msg: Message): Boolean {
        if (!webSocketTransport.isConnected()) return false
        return try {
            val envelope = CryptoEngine.encryptEnvelope(
                messageId = msg.id,
                senderPrivateKey = myPrivateKey,
                senderPublicKeyHex = identity.publicKeyHex,
                recipientPublicKeyHex = msg.recipientPublicKeyHex,
                plaintext = msg.content
            )
            val sent = webSocketTransport.sendEnvelope(envelope)
            if (sent) outboxRepository.markSent(msg.id, "WebSocket")
            sent
        } catch (e: Exception) {
            // Clé destinataire invalide : échec définitif et visible
            outboxRepository.markFailed(msg.id)
            false
        }
    }

    fun handleIncomingEnvelope(envelope: EncryptedEnvelope) {
        // Seuls les messages adressés à notre clé sont traités
        if (envelope.recipientPublicKeyHex != identity.publicKeyHex) return

        val plaintext = try {
            CryptoEngine.decryptEnvelope(envelope, myPrivateKey) // vérifie aussi la signature de l'expéditeur
        } catch (e: Exception) {
            return // altéré, mal signé ou non déchiffrable : rejet
        }

        // Accusé signé émis à chaque réception valide, y compris en double :
        // l'expéditeur renvoie tant qu'il n'a pas reçu d'accusé (accusé perdu, reconnexion).
        val ack = CryptoEngine.createSignedAck(envelope.id, myPrivateKey, identity.publicKeyHex)
        webSocketTransport.sendAck(ack)

        if (outboxRepository.hasSeenMessage(envelope.id)) return // déduplication

        val senderFingerprint = CryptoEngine.computeFingerprint(envelope.senderPublicKeyHex)
        outboxRepository.enqueueMessage(
            Message(
                id = envelope.id,
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
                lastSeen = System.currentTimeMillis(),
                transport = "WebSocket",
                isDirect = true
            )
        )
    }

    /**
     * « Délivré » uniquement si : le message est à nous, l'ACK est signé par la clé du destinataire
     * à qui ce message a été chiffré, et la signature est valide. Un ACK signé par un tiers est ignoré.
     */
    fun handleIncomingAck(ack: SignedAck) {
        val target = outboxRepository.messagesFlow.value.firstOrNull { it.id == ack.messageId } ?: return
        if (target.senderPublicKeyHex != identity.publicKeyHex) return
        if (target.recipientPublicKeyHex != ack.recipientPublicKeyHex) return
        if (!CryptoEngine.verifySignedAck(ack)) return
        outboxRepository.markDelivered(ack.messageId)
    }

    fun flushOutbox() {
        if (!webSocketTransport.isConnected()) return
        scope.launch(Dispatchers.Default) {
            if (!flushMutex.tryLock()) return@launch
            try {
                outboxRepository.getPendingOutbox()
                    .filter { it.senderPublicKeyHex == identity.publicKeyHex }
                    .forEach { trySend(it) }
            } finally {
                flushMutex.unlock()
            }
        }
    }

    companion object {
        const val RETRY_MS = 15_000L
    }
}
