package org.meshora.app.model

import kotlinx.serialization.Serializable

@Serializable
enum class MessageStatus {
    QUEUED,     // En attente d'envoi dans l'Outbox
    SENT,       // Reçu par le relais / diffusé sur le maillage mais non acquitté
    DELIVERED,  // Accusé de réception (SignedAck) signé par le destinataire vérifié
    FAILED      // Échec avéré
}

@Serializable
data class Message(
    val id: String,
    val conversationId: String,
    val senderFingerprint: String,
    val recipientFingerprint: String,
    val senderPublicKeyHex: String,
    val recipientPublicKeyHex: String,
    val content: String,
    val timestamp: Long,
    val status: MessageStatus = MessageStatus.QUEUED,
    val transportUsed: String = "outbox"
)

@Serializable
data class Peer(
    val publicKeyHex: String,
    val fingerprint: String,
    val displayName: String,
    val lastSeen: Long,
    val transport: String = "WebSocket",
    val isDirect: Boolean = true
)
