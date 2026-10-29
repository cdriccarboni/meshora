package org.meshora.app.storage

import android.content.Context
import android.content.SharedPreferences
import org.meshora.app.crypto.CryptoEngine
import org.meshora.app.crypto.KeyIdentity

/**
 * Identité de l'appareil. V0.3 : la clé privée est chiffrée par le magasin de clés Android
 * ([SecureKeyBox]) ; une identité V0.2 stockée en clair est migrée au premier lancement.
 * Le fichier est exclu des sauvegardes (res/xml/backup_rules.xml, data_extraction_rules.xml).
 */
class IdentityStorage(context: Context) {
    private val prefs: SharedPreferences = context.getSharedPreferences("meshora_identity", Context.MODE_PRIVATE)

    fun getOrCreateIdentity(): KeyIdentity {
        val pub = prefs.getString("public_key_hex", null)
        val stored = prefs.getString("private_key_pkcs8_hex", null)
        val fp = prefs.getString("fingerprint", null)

        if (pub != null && stored != null && fp != null) {
            if (SecureKeyBox.isSealed(stored)) {
                val priv = SecureKeyBox.open(stored)
                if (priv != null) return KeyIdentity(pub, priv, fp)
                // Clé du magasin perdue (restauration, réinitialisation) : identité irrécupérable, on en crée une nouvelle.
            } else {
                // Migration V0.2 → V0.3 : chiffrement de la clé privée stockée en clair.
                runCatching { prefs.edit().putString("private_key_pkcs8_hex", SecureKeyBox.seal(stored)).commit() }
                return KeyIdentity(pub, stored, fp)
            }
        }

        val newIdentity = CryptoEngine.generateIdentityKeyPair()
        val sealed = runCatching { SecureKeyBox.seal(newIdentity.privateKeyPkcs8Hex) }.getOrElse { newIdentity.privateKeyPkcs8Hex }
        prefs.edit()
            .putString("public_key_hex", newIdentity.publicKeyHex)
            .putString("private_key_pkcs8_hex", sealed)
            .putString("fingerprint", newIdentity.fingerprint)
            .commit()
        return newIdentity
    }

    fun clearIdentity() {
        prefs.edit().clear().apply()
    }
}
