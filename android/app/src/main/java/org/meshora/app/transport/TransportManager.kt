package org.meshora.app.transport

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import org.meshora.app.crypto.CryptoEngine
import org.meshora.app.crypto.EncryptedEnvelope
import org.meshora.app.crypto.SignedAck
import org.meshora.app.model.Message
import org.meshora.app.model.MessageStatus
import org.meshora.app.model.Peer
import org.meshora.app.storage.IdentityStorage
import org.meshora.app.storage.OutboxRepository
import org.meshora.app.transport.ble.MeshoraBleManager
import java.util.UUID

class TransportManager(
    private val scope: CoroutineScope,
    private val identityStorage: IdentityStorage,
    val outboxRepository: OutboxRepository,
    val bleManager: MeshoraBleManager
) {
    val identity = identityStorage.getOrCreateIdentity()
    private val myPrivateKey = CryptoEngine.importPrivateKey(identity.privateKeyPkcs8Hex)

    val webSocketTransport = WebSocketTransport(
        scope = scope,
        onEnvelopeReceived = { env -> handleIncomingEnvelope(env) },
        onAckReceived = { ack -> handleIncomingAck(ack) },
        onPeersUpdated = { peers -> outboxRepository.updatePeers(peers) }
    )

    fun connectWebSocket(url: String, room: String) {
        webSocketTransport.connect(url, room, identity.publicKeyHex)
    }

    fun disconnectWebSocket() {
        webSocketTransport.disconnect()
    }

    fun sendMessage(recipientPublicKeyHex: String, plaintext: String): String {
        val messageId = "msg-" + UUID.randomUUID().toString().take(12)
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

        // 2. Chiffrement et tentative d'envoi immédiat
        scope.launch(Dispatchers.Default) {
            try {
                val envelope = CryptoEngine.encryptEnvelope(
                    messageId = messageId,
                    senderPrivateKey = myPrivateKey,
                    senderPublicKeyHex = identity.publicKeyHex,
                    recipientPublicKeyHex = recipientPublicKeyHex,
                    plaintext = plaintext
                )

                if (webSocketTransport.isConnected()) {
                    val sent = webSocketTransport.sendEnvelope(envelope)
                    if (sent) {
                        outboxRepository.markSent(messageId, "WebSocket")
                    }
                }
            } catch (e: Exception) {
                outboxRepository.markFailed(messageId)
            }
        }

        return messageId
    }

    fun handleIncomingEnvelope(envelope: EncryptedEnvelope) {
        if (outboxRepository.hasSeenMessage(envelope.id)) {
            return // Déduplication stricte
        }

        // Vérification si ce message est adressé à notre clé publique
        if (envelope.recipientPublicKeyHex != identity.publicKeyHex) {
            return
        }

        try {
            // Déchiffrement E2EE et contrôle signature expéditeur
            val decryptedPlaintext = CryptoEngine.decryptEnvelope(envelope, myPrivateKey)
            val senderFingerprint = CryptoEngine.computeFingerprint(envelope.senderPublicKeyHex)

            val incomingMessage = Message(
                id = envelope.id,
                conversationId = senderFingerprint,
                senderFingerprint = senderFingerprint,
                recipientFingerprint = identity.fingerprint,
                senderPublicKeyHex = envelope.senderPublicKeyHex,
                recipientPublicKeyHex = envelope.recipientPublicKeyHex,
                content = decryptedPlaintext,
                timestamp = envelope.timestamp,
                status = MessageStatus.DELIVERED,
                transportUsed = "WebSocket"
            )

            outboxRepository.enqueueMessage(incomingMessage)

            // Découverte opportuniste du pair expéditeur
            outboxRepository.addOrUpdatePeer(
                Peer(
                    publicKeyHex = envelope.senderPublicKeyHex,
                    fingerprint = senderFingerprint,
                    displayName = "Pair $senderFingerprint",
                    lastSeen = System.currentTimeMillis(),
                    transport = "WebSocket",
                    isDirect = true
                )
            )

            // Émission immédiate de l'Accusé de Réception Signé (SignedAck)
            val ack = CryptoEngine.createSignedAck(envelope.id, myPrivateKey, identity.publicKeyHex)
            webSocketTransport.sendAck(ack)

        } catch (e: SecurityException) {
            // Message altéré ou signature invalide : rejet silencieux pour préserver la sécurité
        }
    }

    fun handleIncomingAck(ack: SignedAck) {
        val valid = CryptoEngine.verifySignedAck(ack)
        if (valid) {
            // Seule une signature cryptographique valide du destinataire autorise le passage à DELIVERED
            outboxRepository.markDelivered(ack.messageId)
        }
    }

    fun flushOutbox() {
        if (!webSocketTransport.isConnected()) return
        val pending = outboxRepository.getPendingOutbox()
        scope.launch(Dispatchers.Default) {
            for (msg in pending) {
                try {
                    val envelope = CryptoEngine.encryptEnvelope(
                        messageId = msg.id,
                        senderPrivateKey = myPrivateKey,
                        senderPublicKeyHex = identity.publicKeyHex,
                        recipientPublicKeyHex = msg.recipientPublicKeyHex,
                        plaintext = msg.content
                    )
                    val sent = webSocketTransport.sendEnvelope(envelope)
                    if (sent && msg.status == MessageStatus.QUEUED) {
                        outboxRepository.markSent(msg.id, "WebSocket")
                    }
                } catch (_: Exception) {}
            }
        }
    }
}
