package org.meshora.app.crypto

import java.math.BigInteger
import java.nio.charset.StandardCharsets
import java.security.*
import java.security.spec.ECGenParameterSpec
import java.security.spec.PKCS8EncodedKeySpec
import java.security.spec.X509EncodedKeySpec
import javax.crypto.Cipher
import javax.crypto.KeyAgreement
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec

object CryptoEngine {
    private const val CURVE_NAME = "secp256r1" // P-256 standard NIST
    private const val EC_ALGO = "EC"
    private const val SIGN_ALGO = "SHA256withECDSA"
    private const val AES_GCM_ALGO = "AES/GCM/NoPadding"
    private const val TAG_LENGTH_BITS = 128
    private const val IV_LENGTH_BYTES = 12

    // --- Utilitaires Hexadécimaux ---
    fun bytesToHex(bytes: ByteArray): String {
        val hexChars = "0123456789abcdef"
        val result = StringBuilder(bytes.size * 2)
        for (b in bytes) {
            val i = b.toInt() and 0xFF
            result.append(hexChars[i shr 4])
            result.append(hexChars[i and 0x0F])
        }
        return result.toString()
    }

    fun hexToBytes(hex: String): ByteArray {
        val clean = hex.filter { it in "0123456789abcdefABCDEF" }
        require(clean.length % 2 == 0) { "Hexadecimal string must have an even length" }
        val result = ByteArray(clean.length / 2)
        for (i in 0 until clean.length step 2) {
            val firstDigit = Character.digit(clean[i], 16)
            val secondDigit = Character.digit(clean[i + 1], 16)
            result[i / 2] = ((firstDigit shl 4) + secondDigit).toByte()
        }
        return result
    }

    // --- Génération d'Identité & Clés Asymétriques ---
    fun generateIdentityKeyPair(): KeyIdentity {
        val keyPairGenerator = KeyPairGenerator.getInstance(EC_ALGO)
        keyPairGenerator.initialize(ECGenParameterSpec(CURVE_NAME), SecureRandom())
        val keyPair = keyPairGenerator.generateKeyPair()

        val spkiBytes = keyPair.public.encoded
        val pkcs8Bytes = keyPair.private.encoded

        val publicKeyHex = bytesToHex(spkiBytes)
        val privateKeyPkcs8Hex = bytesToHex(pkcs8Bytes)
        val fingerprint = computeFingerprint(publicKeyHex)

        return KeyIdentity(
            publicKeyHex = publicKeyHex,
            privateKeyPkcs8Hex = privateKeyPkcs8Hex,
            fingerprint = fingerprint
        )
    }

    /** Paramètres P-256 (secp256r1), FIPS 186-4 D.1.2.3. */
    private val P256_P = BigInteger("ffffffff00000001000000000000000000000000ffffffffffffffffffffffff", 16)
    private val P256_B = BigInteger("5ac635d8aa3a93e7b3ebbd55769886bc651d06b0cc53b0f63bce3c3e27d2604b", 16)
    private val P256_A = P256_P.subtract(BigInteger.valueOf(3))

    /**
     * Importe une clé publique SPKI et vérifie qu'il s'agit d'un point VALIDE de P-256.
     * Le KeyFactory Java n'effectue pas ce contrôle : sans lui, un point hors courbe serait accepté
     * (attaque par courbe invalide sur l'ECDH). WebCrypto et le relais rejettent déjà ces clés.
     */
    fun importPublicKey(publicKeyHex: String): PublicKey {
        val bytes = hexToBytes(publicKeyHex)
        val key = KeyFactory.getInstance(EC_ALGO).generatePublic(X509EncodedKeySpec(bytes))
        val ec = key as? java.security.interfaces.ECPublicKey ?: throw InvalidKeyException("not EC")
        val field = ec.params.curve.field as? java.security.spec.ECFieldFp ?: throw InvalidKeyException("not prime field")
        if (field.p != P256_P || ec.params.curve.a != P256_A || ec.params.curve.b != P256_B) throw InvalidKeyException("not P-256")
        val x = ec.w.affineX ?: throw InvalidKeyException("infinity")
        val y = ec.w.affineY ?: throw InvalidKeyException("infinity")
        if (x.signum() < 0 || y.signum() < 0 || x >= P256_P || y >= P256_P) throw InvalidKeyException("out of range")
        val lhs = y.modPow(BigInteger.valueOf(2), P256_P)
        val rhs = x.modPow(BigInteger.valueOf(3), P256_P).add(P256_A.multiply(x)).add(P256_B).mod(P256_P)
        if (lhs != rhs) throw InvalidKeyException("point not on curve")
        return key
    }

    fun importPrivateKey(privateKeyPkcs8Hex: String): PrivateKey {
        val bytes = hexToBytes(privateKeyPkcs8Hex)
        val spec = PKCS8EncodedKeySpec(bytes)
        val factory = KeyFactory.getInstance(EC_ALGO)
        return factory.generatePrivate(spec)
    }

    // --- Empreinte Publique Vérifiable (SHA-256 tronquée en 8 blocs) ---
    fun computeFingerprint(publicKeyHex: String): String {
        val bytes = hexToBytes(publicKeyHex)
        val digest = MessageDigest.getInstance("SHA-256").digest(bytes)
        val hex = bytesToHex(digest).take(32)
        return hex.chunked(4).joinToString(":")
    }

    // --- Signatures ECDSA & Interopérabilité P1363 (WebCrypto) / DER ---
    fun signData(privateKey: PrivateKey, data: ByteArray): String {
        val signer = Signature.getInstance(SIGN_ALGO)
        signer.initSign(privateKey)
        signer.update(data)
        val derSignature = signer.sign()
        // Conversion du DER Java standard vers le format IEEE P1363 (64 octets) standardisé par WebCrypto
        val p1363 = derToP1363(derSignature)
        return bytesToHex(p1363)
    }

    fun signData(privateKey: PrivateKey, text: String): String {
        return signData(privateKey, text.toByteArray(StandardCharsets.UTF_8))
    }

    fun verifySignature(publicKeyHex: String, signatureHex: String, data: ByteArray): Boolean {
        return try {
            val publicKey = importPublicKey(publicKeyHex)
            val signatureBytes = hexToBytes(signatureHex)
            val derBytes = if (signatureBytes.size == 64) {
                p1363ToDer(signatureBytes)
            } else {
                signatureBytes
            }
            val verifier = Signature.getInstance(SIGN_ALGO)
            verifier.initVerify(publicKey)
            verifier.update(data)
            verifier.verify(derBytes)
        } catch (e: Exception) {
            false
        }
    }

    fun verifySignature(publicKeyHex: String, signatureHex: String, text: String): Boolean {
        return verifySignature(publicKeyHex, signatureHex, text.toByteArray(StandardCharsets.UTF_8))
    }

    // --- Chiffrement E2EE : ECDH + AES-256-GCM ---
    fun encryptEnvelope(
        messageId: String,
        senderPrivateKey: PrivateKey,
        senderPublicKeyHex: String,
        recipientPublicKeyHex: String,
        plaintext: String
    ): EncryptedEnvelope {
        // 1. Génération de paire de clés ECDH éphémère
        val kpg = KeyPairGenerator.getInstance(EC_ALGO)
        kpg.initialize(ECGenParameterSpec(CURVE_NAME), SecureRandom())
        val ephemeralKeyPair = kpg.generateKeyPair()

        // 2. Dérivation de la clé secrète partagée via ECDH
        val recipientPublicKey = importPublicKey(recipientPublicKeyHex)
        val keyAgreement = KeyAgreement.getInstance("ECDH")
        keyAgreement.init(ephemeralKeyPair.private)
        keyAgreement.doPhase(recipientPublicKey, true)
        val sharedSecret = keyAgreement.generateSecret()

        // 3. Chiffrement symétrique AES-256-GCM
        val secureRandom = SecureRandom()
        val iv = ByteArray(IV_LENGTH_BYTES)
        secureRandom.nextBytes(iv)

        val aesKey = SecretKeySpec(sharedSecret, "AES")
        val cipher = Cipher.getInstance(AES_GCM_ALGO)
        cipher.init(Cipher.ENCRYPT_MODE, aesKey, GCMParameterSpec(TAG_LENGTH_BITS, iv))
        val ciphertext = cipher.doFinal(plaintext.toByteArray(StandardCharsets.UTF_8))

        val ephemeralPublicKeyHex = bytesToHex(ephemeralKeyPair.public.encoded)
        val ivHex = bytesToHex(iv)
        val ciphertextHex = bytesToHex(ciphertext)
        val timestamp = System.currentTimeMillis()

        // 4. Signature de l'enveloppe par la clé d'identité de l'expéditeur
        val unsigned = EncryptedEnvelope(
            id = messageId,
            senderPublicKeyHex = senderPublicKeyHex,
            recipientPublicKeyHex = recipientPublicKeyHex,
            ephemeralPublicKeyHex = ephemeralPublicKeyHex,
            ivHex = ivHex,
            ciphertextHex = ciphertextHex,
            signatureHex = "",
            timestamp = timestamp
        )
        return unsigned.copy(signatureHex = signData(senderPrivateKey, envelopeSignedString(unsigned)))
    }

    /** Chaîne signée par l'expéditeur : v2 (§2) ou v3 (V0.4 étape A). Identique au web et aux relais. */
    fun envelopeSignedString(e: EncryptedEnvelope): String =
        if (e.v == 3) "ENV3|${e.id}|${e.senderPublicKeyHex}|${e.recipientPublicKeyHex}|${e.prekeyId}|${e.ephemeralPublicKeyHex}|${e.saltHex}|${e.ivHex}|${e.ciphertextHex}|${e.timestamp}"
        else "${e.id}|${e.senderPublicKeyHex}|${e.recipientPublicKeyHex}|${e.ephemeralPublicKeyHex}|${e.ivHex}|${e.ciphertextHex}|${e.timestamp}"

    // --- V0.4 étape A : prékeys signées, HKDF-SHA256, enveloppe v3 ---

    /** Une prékey annoncée n'est acceptée que si son échéance est dans cet intervalle. */
    const val PREKEY_MAX_LIFETIME_MS = 30L * 24 * 3600 * 1000

    fun prekeyId(prekeyPublicKeyHex: String): String =
        bytesToHex(MessageDigest.getInstance("SHA-256").digest(hexToBytes(prekeyPublicKeyHex))).take(16)

    fun prekeySignedString(identityPublicKeyHex: String, publicKeyHex: String, id: String, expiresAt: Long) =
        "PREKEY|v1|$identityPublicKeyHex|$publicKeyHex|$id|$expiresAt"

    fun envelopeHkdfInfo(senderHex: String, recipientHex: String, prekeyId: String) = "MESHORA-ENV|v3|$senderHex|$recipientHex|$prekeyId"

    /** Nouvelle prékey ECDH P-256 signée par l'identité. @return (prékey publique signée, clé privée PKCS#8 hex). */
    fun generatePrekey(identityPrivateKey: PrivateKey, identityPublicKeyHex: String, expiresAt: Long): Pair<SignedPrekey, String> {
        val kpg = KeyPairGenerator.getInstance(EC_ALGO)
        kpg.initialize(ECGenParameterSpec(CURVE_NAME), SecureRandom())
        val kp = kpg.generateKeyPair()
        val pub = bytesToHex(kp.public.encoded)
        val id = prekeyId(pub)
        val sig = signData(identityPrivateKey, prekeySignedString(identityPublicKeyHex, pub, id, expiresAt))
        return SignedPrekey(pub, id, expiresAt, sig) to bytesToHex(kp.private.encoded)
    }

    /** Vérifie une prékey annoncée pour une identité (forme, empreinte, point P-256 valide, signature, échéance). */
    fun verifyPrekey(identityPublicKeyHex: String, p: SignedPrekey?, now: Long = System.currentTimeMillis()): Boolean {
        if (p == null) return false
        if (!Regex("^[0-9a-f]{2,400}$").matches(p.publicKeyHex) || p.publicKeyHex.length % 2 != 0) return false
        if (!Regex("^[0-9a-f]{16}$").matches(p.id) || !Regex("^[0-9a-fA-F]{128}$").matches(p.signatureHex)) return false
        if (p.expiresAt <= now || p.expiresAt > now + PREKEY_MAX_LIFETIME_MS || p.publicKeyHex == identityPublicKeyHex) return false
        return try {
            if (prekeyId(p.publicKeyHex) != p.id) return false
            importPublicKey(p.publicKeyHex) // point valide de P-256
            verifySignature(identityPublicKeyHex, p.signatureHex, prekeySignedString(identityPublicKeyHex, p.publicKeyHex, p.id, p.expiresAt))
        } catch (_: Exception) {
            false
        }
    }

    /** HKDF-SHA256 (RFC 5869), sortie de [length] ≤ 32 octets. */
    fun hkdfSha256(ikm: ByteArray, salt: ByteArray, info: ByteArray, length: Int = 32): ByteArray {
        require(length in 1..32)
        val mac = javax.crypto.Mac.getInstance("HmacSHA256")
        mac.init(SecretKeySpec(if (salt.isEmpty()) ByteArray(32) else salt, "HmacSHA256"))
        val prk = mac.doFinal(ikm)
        mac.init(SecretKeySpec(prk, "HmacSHA256"))
        mac.update(info)
        mac.update(1.toByte())
        return mac.doFinal().copyOf(length)
    }

    /** Clé de message v3 : HKDF-SHA256(ECDH(privée, publique), sel, info). */
    fun v3MessageKey(privateKey: PrivateKey, publicKeyHex: String, salt: ByteArray, info: String): ByteArray {
        val ka = KeyAgreement.getInstance("ECDH")
        ka.init(privateKey)
        ka.doPhase(importPublicKey(publicKeyHex), true)
        return hkdfSha256(ka.generateSecret(), salt, info.toByteArray(StandardCharsets.UTF_8))
    }

    /** Enveloppe v3. L'appelant DOIT avoir vérifié la prékey ([verifyPrekey]) pour ce destinataire. */
    fun encryptEnvelopeV3(
        messageId: String,
        senderPrivateKey: PrivateKey,
        senderPublicKeyHex: String,
        recipientPublicKeyHex: String,
        prekey: SignedPrekey,
        plaintext: String,
        timestamp: Long = System.currentTimeMillis()
    ): EncryptedEnvelope {
        val kpg = KeyPairGenerator.getInstance(EC_ALGO)
        kpg.initialize(ECGenParameterSpec(CURVE_NAME), SecureRandom())
        val eph = kpg.generateKeyPair()
        val rnd = SecureRandom()
        val salt = ByteArray(32).also { rnd.nextBytes(it) }
        val iv = ByteArray(IV_LENGTH_BYTES).also { rnd.nextBytes(it) }
        val key = v3MessageKey(eph.private, prekey.publicKeyHex, salt, envelopeHkdfInfo(senderPublicKeyHex, recipientPublicKeyHex, prekey.id))
        val cipher = Cipher.getInstance(AES_GCM_ALGO)
        cipher.init(Cipher.ENCRYPT_MODE, SecretKeySpec(key, "AES"), GCMParameterSpec(TAG_LENGTH_BITS, iv))
        val unsigned = EncryptedEnvelope(
            id = messageId,
            senderPublicKeyHex = senderPublicKeyHex,
            recipientPublicKeyHex = recipientPublicKeyHex,
            ephemeralPublicKeyHex = bytesToHex(eph.public.encoded),
            ivHex = bytesToHex(iv),
            ciphertextHex = bytesToHex(cipher.doFinal(plaintext.toByteArray(StandardCharsets.UTF_8))),
            signatureHex = "",
            timestamp = timestamp,
            v = 3,
            prekeyId = prekey.id,
            saltHex = bytesToHex(salt)
        )
        return unsigned.copy(signatureHex = signData(senderPrivateKey, envelopeSignedString(unsigned)))
    }

    /**
     * Déchiffre une enveloppe v2 ou v3.
     * @param prekeyLookup v3 : clé privée de la prékey désignée, ou null si elle a été effacée (message alors illisible).
     */
    fun decryptEnvelope(
        envelope: EncryptedEnvelope,
        recipientPrivateKey: PrivateKey,
        prekeyLookup: (String) -> PrivateKey? = { null }
    ): String {
        if (envelope.v != null && envelope.v != 3) throw SecurityException("Version d'enveloppe inconnue.")
        // 1. Vérification de la signature de l'expéditeur
        val verified = verifySignature(envelope.senderPublicKeyHex, envelope.signatureHex, envelopeSignedString(envelope))
        if (!verified) {
            throw SecurityException("ÉCHEC DE SÉCURITÉ : Signature de l'expéditeur invalide ou message altéré sur le fil.")
        }

        if (envelope.v == 3) {
            val pid = envelope.prekeyId ?: throw SecurityException("Enveloppe v3 mal formée.")
            val salt = envelope.saltHex?.takeIf { Regex("^[0-9a-fA-F]{64}$").matches(it) } ?: throw SecurityException("Enveloppe v3 mal formée.")
            val prekeyPrivate = prekeyLookup(pid) ?: throw SecurityException("Prékey inconnue ou effacée : message illisible (confidentialité persistante).")
            val key = v3MessageKey(prekeyPrivate, envelope.ephemeralPublicKeyHex, hexToBytes(salt), envelopeHkdfInfo(envelope.senderPublicKeyHex, envelope.recipientPublicKeyHex, pid))
            val cipher = Cipher.getInstance(AES_GCM_ALGO)
            cipher.init(Cipher.DECRYPT_MODE, SecretKeySpec(key, "AES"), GCMParameterSpec(TAG_LENGTH_BITS, hexToBytes(envelope.ivHex)))
            return String(cipher.doFinal(hexToBytes(envelope.ciphertextHex)), StandardCharsets.UTF_8)
        }

        // 2. Dérivation du secret partagé ECDH avec la clé publique éphémère de l'enveloppe
        val ephemeralPublicKey = importPublicKey(envelope.ephemeralPublicKeyHex)
        val keyAgreement = KeyAgreement.getInstance("ECDH")
        keyAgreement.init(recipientPrivateKey)
        keyAgreement.doPhase(ephemeralPublicKey, true)
        val sharedSecret = keyAgreement.generateSecret()

        // 3. Déchiffrement AES-256-GCM
        val iv = hexToBytes(envelope.ivHex)
        val ciphertext = hexToBytes(envelope.ciphertextHex)
        val aesKey = SecretKeySpec(sharedSecret, "AES")
        val cipher = Cipher.getInstance(AES_GCM_ALGO)
        cipher.init(Cipher.DECRYPT_MODE, aesKey, GCMParameterSpec(TAG_LENGTH_BITS, iv))
        val decryptedBytes = cipher.doFinal(ciphertext)

        return String(decryptedBytes, StandardCharsets.UTF_8)
    }

    // --- Accusés de Réception Signés v2 (SignedAck) ---
    /** Empreinte d'une enveloppe : SHA-256 (hex) de la chaîne UTF-8 de sa signature. */
    fun envelopeHash(envelope: EncryptedEnvelope): String =
        bytesToHex(MessageDigest.getInstance("SHA-256").digest(envelope.signatureHex.toByteArray(StandardCharsets.UTF_8)))

    fun createSignedAck(envelope: EncryptedEnvelope, recipientPrivateKey: PrivateKey): SignedAck {
        val timestamp = System.currentTimeMillis()
        val hash = envelopeHash(envelope)
        val payload = "ACK2|${envelope.id}|${envelope.senderPublicKeyHex}|${envelope.recipientPublicKeyHex}|$hash|$timestamp"
        return SignedAck(
            messageId = envelope.id,
            senderPublicKeyHex = envelope.senderPublicKeyHex,
            recipientPublicKeyHex = envelope.recipientPublicKeyHex,
            envelopeHash = hash,
            timestamp = timestamp,
            signatureHex = signData(recipientPrivateKey, payload)
        )
    }

    /** Vérifie la signature ; la correspondance avec un envoi réel est vérifiée par l'appelant. */
    fun verifySignedAck(ack: SignedAck): Boolean {
        val payload = "ACK2|${ack.messageId}|${ack.senderPublicKeyHex}|${ack.recipientPublicKeyHex}|${ack.envelopeHash}|${ack.timestamp}"
        return verifySignature(ack.recipientPublicKeyHex, ack.signatureHex, payload)
    }

    /** Clé publique SPKI hex normalisée (minuscules) et importable, sinon null. */
    fun normalizePublicKeyHex(input: String): String? {
        val hex = input.trim().lowercase()
        if (!Regex("^[0-9a-f]{120,400}$").matches(hex) || hex.length % 2 != 0) return null
        return try {
            importPublicKey(hex)
            hex
        } catch (_: Exception) {
            null
        }
    }

    // --- Convertisseurs DER <-> IEEE P1363 (Interopérabilité WebCrypto / Node.js) ---
    private fun derToP1363(der: ByteArray): ByteArray {
        var offset = 0
        require(der[offset++] == 0x30.toByte()) { "Not a valid DER sequence" }
        val len = der[offset++].toInt() and 0xFF
        val actualLen = if (len and 0x80 != 0) {
            val numBytes = len and 0x7F
            var l = 0
            for (i in 0 until numBytes) {
                l = (l shl 8) or (der[offset++].toInt() and 0xFF)
            }
            l
        } else len

        require(der[offset++] == 0x02.toByte()) { "Expected integer r" }
        val rLen = der[offset++].toInt() and 0xFF
        val rBytes = der.copyOfRange(offset, offset + rLen)
        offset += rLen

        require(der[offset++] == 0x02.toByte()) { "Expected integer s" }
        val sLen = der[offset++].toInt() and 0xFF
        val sBytes = der.copyOfRange(offset, offset + sLen)

        val r = BigInteger(1, rBytes)
        val s = BigInteger(1, sBytes)

        val p1363 = ByteArray(64)
        val rRaw = r.toByteArray()
        val sRaw = s.toByteArray()

        copyBigIntToFixed32(rRaw, p1363, 0)
        copyBigIntToFixed32(sRaw, p1363, 32)
        return p1363
    }

    private fun p1363ToDer(p1363: ByteArray): ByteArray {
        require(p1363.size == 64) { "P1363 signature must be 64 bytes" }
        val rBytes = p1363.copyOfRange(0, 32)
        val sBytes = p1363.copyOfRange(32, 64)

        val r = BigInteger(1, rBytes)
        val s = BigInteger(1, sBytes)

        val rDer = r.toByteArray()
        val sDer = s.toByteArray()

        val totalLen = 2 + rDer.size + 2 + sDer.size
        val der = ByteArray(2 + totalLen)
        var offset = 0
        der[offset++] = 0x30
        der[offset++] = totalLen.toByte()
        der[offset++] = 0x02
        der[offset++] = rDer.size.toByte()
        System.arraycopy(rDer, 0, der, offset, rDer.size)
        offset += rDer.size
        der[offset++] = 0x02
        der[offset++] = sDer.size.toByte()
        System.arraycopy(sDer, 0, der, offset, sDer.size)

        return der
    }

    private fun copyBigIntToFixed32(src: ByteArray, dest: ByteArray, destOffset: Int) {
        val srcTrimmed = if (src.size > 32 && src[0] == 0.toByte()) {
            src.copyOfRange(1, src.size)
        } else src
        val pad = 32 - srcTrimmed.size
        if (pad > 0) {
            java.util.Arrays.fill(dest, destOffset, destOffset + pad, 0.toByte())
            System.arraycopy(srcTrimmed, 0, dest, destOffset + pad, srcTrimmed.size)
        } else {
            System.arraycopy(srcTrimmed, srcTrimmed.size - 32, dest, destOffset, 32)
        }
    }
}
