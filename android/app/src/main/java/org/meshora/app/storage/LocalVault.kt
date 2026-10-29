package org.meshora.app.storage

import android.content.Context
import android.util.Base64
import java.security.SecureRandom
import javax.crypto.Cipher
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec

/**
 * Chiffrement au repos des données locales (messages, contacts) — correction A-P1-6 du contre-audit Android V0.2
 * (« messages stockés en clair dans SharedPreferences »).
 *
 * Une clé de données AES-256 aléatoire chiffre les données en mémoire (rapide, quelle que soit la taille de
 * l'historique) ; cette clé est elle-même scellée par la clé non exportable du magasin de clés Android
 * ([SecureKeyBox]). Effacement d'urgence : la clé du magasin est détruite → tout devient illisible.
 *
 * Format d'une valeur scellée : « lv1:<base64(iv 12 octets ‖ chiffré+étiquette)> ». Une valeur sans ce préfixe
 * est un ancien enregistrement en clair (lu une fois, puis réécrit chiffré).
 */
class LocalVault(private val dataKey: ByteArray) {
    init { require(dataKey.size == 32) }

    fun seal(plain: String): String {
        val iv = ByteArray(12).also { rng.nextBytes(it) }
        val c = Cipher.getInstance("AES/GCM/NoPadding")
        c.init(Cipher.ENCRYPT_MODE, SecretKeySpec(dataKey, "AES"), GCMParameterSpec(128, iv))
        return PREFIX + b64e(iv + c.doFinal(plain.toByteArray(Charsets.UTF_8)))
    }

    /** @return le texte clair ; une ancienne valeur en clair est rendue telle quelle ; null si illisible. */
    fun open(stored: String): String? {
        if (!isSealed(stored)) return stored
        return try {
            val raw = b64d(stored.removePrefix(PREFIX))
            val c = Cipher.getInstance("AES/GCM/NoPadding")
            c.init(Cipher.DECRYPT_MODE, SecretKeySpec(dataKey, "AES"), GCMParameterSpec(128, raw, 0, 12))
            String(c.doFinal(raw, 12, raw.size - 12), Charsets.UTF_8)
        } catch (_: Exception) {
            null
        }
    }

    companion object {
        const val PREFIX = "lv1:"
        const val PREFS = "meshora_vault"
        private const val KEY = "data_key"
        private val rng = SecureRandom()

        /** Encodage Base64 remplaçable pour les tests JVM (android.util.Base64 n'existe pas hors Android). */
        @JvmStatic var b64e: (ByteArray) -> String = { Base64.encodeToString(it, Base64.NO_WRAP) }
        @JvmStatic var b64d: (String) -> ByteArray = { Base64.decode(it, Base64.NO_WRAP) }

        fun isSealed(value: String) = value.startsWith(PREFIX)

        @Volatile private var app: LocalVault? = null

        /**
         * Coffre de l'application. La clé de données est créée au premier usage et scellée par le magasin de clés.
         * @return null si le magasin de clés refuse (les données restent alors en mémoire seulement, jamais en clair).
         */
        @Synchronized
        fun forApp(context: Context): LocalVault? {
            app?.let { return it }
            val prefs = context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            val sealed = prefs.getString(KEY, null)
            // Clé illisible (magasin de clés réinitialisé) : les anciennes données sont perdues de toute façon ;
            // on repart d'une clé neuve plutôt que de ne plus jamais rien enregistrer.
            val existing = sealed?.let { s -> SecureKeyBox.open(s)?.let { runCatching { org.meshora.app.crypto.CryptoEngine.hexToBytes(it) }.getOrNull() } }
            val key: ByteArray? = existing ?: run {
                val k = ByteArray(32).also { rng.nextBytes(it) }
                runCatching { prefs.edit().putString(KEY, SecureKeyBox.seal(org.meshora.app.crypto.CryptoEngine.bytesToHex(k))).commit() }
                    .getOrDefault(false).let { ok -> if (ok) k else null }
            }
            return key?.takeIf { it.size == 32 }?.let { LocalVault(it) }?.also { app = it }
        }

        /** Après un effacement d'urgence : oublie la clé gardée en mémoire. */
        fun forget() { app = null }
    }
}
