package org.meshora.app.crypto

import kotlinx.serialization.EncodeDefault
import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.Serializable

/**
 * Enveloppe chiffrée. v2 (V0.2) : `v`, `prekeyId`, `saltHex` absents (jamais émis à null, même avec
 * encodeDefaults). v3 (V0.4 étape A) : `v = 3`, prékey du destinataire + HKDF-SHA256 (docs/PROTOCOLE-V0.4-PROPOSITION.md).
 */
@OptIn(ExperimentalSerializationApi::class)
@Serializable
data class EncryptedEnvelope(
    val id: String,
    val senderPublicKeyHex: String,
    val recipientPublicKeyHex: String,
    val ephemeralPublicKeyHex: String,
    val ivHex: String,
    val ciphertextHex: String,
    val signatureHex: String,
    val timestamp: Long,
    @EncodeDefault(EncodeDefault.Mode.NEVER) val v: Int? = null,
    @EncodeDefault(EncodeDefault.Mode.NEVER) val prekeyId: String? = null,
    @EncodeDefault(EncodeDefault.Mode.NEVER) val saltHex: String? = null
)

/**
 * Prékey de réception (V0.4 étape A) : clé ECDH P-256 tournante signée par la clé d'identité.
 * Chaîne signée : PREKEY|v1|<clé d'identité>|<prékey publique>|<id>|<expiresAt> ; id = 16 hex du SHA-256 de la prékey.
 */
@Serializable
data class SignedPrekey(
    val publicKeyHex: String,
    val id: String,
    val expiresAt: Long,
    val signatureHex: String
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
