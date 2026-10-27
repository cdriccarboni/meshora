package org.meshora.app.storage

import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import org.meshora.app.crypto.CryptoEngine
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/**
 * Chiffrement local de la clé privée d'identité par une clé AES-256-GCM du magasin de clés Android
 * (non exportable ; protégée par le matériel quand l'appareil le permet, comme sur Pixel).
 *
 * Pourquoi un « emballage » plutôt qu'une clé P-256 du magasin Android : le protocole V0.2 exige
 * des signatures et un ECDH compatibles avec WebCrypto, et la clé doit rester utilisable par
 * CryptoEngine. La clé privée n'existe en clair qu'en mémoire vive.
 */
object SecureKeyBox {
    private const val KEY_ALIAS = "meshora_identity_wrap_v1"
    private const val PREFIX = "ks1:"

    private fun wrappingKey(): SecretKey {
        val ks = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (ks.getEntry(KEY_ALIAS, null) as? KeyStore.SecretKeyEntry)?.let { return it.secretKey }
        val gen = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
        gen.init(
            KeyGenParameterSpec.Builder(KEY_ALIAS, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .build()
        )
        return gen.generateKey()
    }

    fun isSealed(value: String) = value.startsWith(PREFIX)

    /** Effacement d'urgence : détruit la clé d'emballage (la clé privée chiffrée devient irrécupérable). */
    fun destroy() {
        runCatching { KeyStore.getInstance("AndroidKeyStore").apply { load(null) }.deleteEntry(KEY_ALIAS) }
    }

    fun seal(plain: String): String {
        val c = Cipher.getInstance("AES/GCM/NoPadding")
        c.init(Cipher.ENCRYPT_MODE, wrappingKey())
        val ct = c.doFinal(plain.toByteArray(Charsets.UTF_8))
        return PREFIX + CryptoEngine.bytesToHex(c.iv) + ":" + CryptoEngine.bytesToHex(ct)
    }

    /** @return le texte clair, ou null si la valeur est illisible (clé du magasin perdue ou donnée altérée). */
    fun open(sealed: String): String? = try {
        val parts = sealed.removePrefix(PREFIX).split(":")
        val c = Cipher.getInstance("AES/GCM/NoPadding")
        c.init(Cipher.DECRYPT_MODE, wrappingKey(), GCMParameterSpec(128, CryptoEngine.hexToBytes(parts[0])))
        String(c.doFinal(CryptoEngine.hexToBytes(parts[1])), Charsets.UTF_8)
    } catch (_: Exception) {
        null
    }
}
