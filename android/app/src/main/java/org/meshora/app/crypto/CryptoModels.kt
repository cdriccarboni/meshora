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

@Serializable
data class SignedAck(
    val messageId: String,
    val recipientPublicKeyHex: String,
    val timestamp: Long,
    val signatureHex: String
)

data class KeyIdentity(
    val publicKeyHex: String,
    val privateKeyPkcs8Hex: String,
    val fingerprint: String
)
