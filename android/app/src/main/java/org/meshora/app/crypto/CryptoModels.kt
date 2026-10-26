package org.meshora.app.crypto

import kotlinx.serialization.Serializable

@Serializable
data class EncryptedEnvelope(
    val id: String,
    val senderPublicKeyHex: String,
    val recipientPublicKeyHex: String,
    val ephemeralPublicKeyHex: String,
    val ivHex: String,
    val ciphertextHex: String,
    val signatureHex: String,
    val timestamp: Long
)

/**
 * Accusé signé v2 (docs/PROTOCOLE-V0.2.md §3) : lie identifiant, expéditeur, destinataire et
 * empreinte de l'enveloppe reçue. Chaîne signée :
 * ACK2|messageId|senderPublicKeyHex|recipientPublicKeyHex|envelopeHash|timestamp
 */
@Serializable
data class SignedAck(
    val messageId: String,
    val senderPublicKeyHex: String,
    val recipientPublicKeyHex: String,
    val envelopeHash: String,
    val timestamp: Long,
    val signatureHex: String
)

data class KeyIdentity(
    val publicKeyHex: String,
    val privateKeyPkcs8Hex: String,
    val fingerprint: String
)
