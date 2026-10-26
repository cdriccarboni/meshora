package org.meshora.app.storage

import android.content.Context
import android.content.SharedPreferences
import org.meshora.app.crypto.CryptoEngine
import org.meshora.app.crypto.KeyIdentity

class IdentityStorage(context: Context) {
    private val prefs: SharedPreferences = context.getSharedPreferences("meshora_identity", Context.MODE_PRIVATE)

    fun getOrCreateIdentity(): KeyIdentity {
        val pub = prefs.getString("public_key_hex", null)
        val priv = prefs.getString("private_key_pkcs8_hex", null)
        val fp = prefs.getString("fingerprint", null)

        if (pub != null && priv != null && fp != null) {
            return KeyIdentity(pub, priv, fp)
        }

        val newIdentity = CryptoEngine.generateIdentityKeyPair()
        prefs.edit()
            .putString("public_key_hex", newIdentity.publicKeyHex)
            .putString("private_key_pkcs8_hex", newIdentity.privateKeyPkcs8Hex)
            .putString("fingerprint", newIdentity.fingerprint)
            .apply()

        return newIdentity
    }

    fun clearIdentity() {
        prefs.edit().clear().apply()
    }
}
