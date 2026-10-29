package org.meshora.app.storage

import android.content.Context
import android.content.SharedPreferences
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import org.meshora.app.crypto.CryptoEngine

/**
 * Contacts enregistrés, identifiés par leur CLÉ PUBLIQUE (jamais par le seul nom).
 * `verified` = clé reçue hors du relais (lien d'invitation ou QR code) : un relais malveillant
 * ne peut pas substituer cette clé ; une autre clé sous le même nom apparaît comme un autre contact, non vérifié.
 */
@Serializable
data class Contact(
    val publicKeyHex: String,
    val alias: String,
    val verified: Boolean = false,
    val addedAt: Long = 0L
) {
    val fingerprint: String get() = CryptoEngine.computeFingerprint(publicKeyHex)
}

class ContactStore(context: Context? = null) {
    private val prefs: SharedPreferences? = context?.getSharedPreferences("meshora_contacts", Context.MODE_PRIVATE)
    private val json = Json { ignoreUnknownKeys = true }
    private val _contacts = MutableStateFlow<List<Contact>>(emptyList())
    val contacts: StateFlow<List<Contact>> = _contacts.asStateFlow()

    init {
        prefs?.getString("contacts_json", null)?.let { raw ->
            runCatching { _contacts.value = json.decodeFromString<List<Contact>>(raw) }
        }
    }

    fun get(publicKeyHex: String): Contact? = _contacts.value.firstOrNull { it.publicKeyHex == publicKeyHex }

    /** Ajoute ou met à jour. Un contact vérifié ne redevient jamais « non vérifié ». */
    @Synchronized
    fun upsert(publicKeyHex: String, alias: String, verified: Boolean, now: Long = System.currentTimeMillis()): Contact? {
        val key = CryptoEngine.normalizePublicKeyHex(publicKeyHex) ?: return null
        val cleanAlias = alias.trim().take(40).ifBlank { CryptoEngine.computeFingerprint(key).take(9) }
        val existing = get(key)
        val c = Contact(key, cleanAlias, verified || (existing?.verified == true), existing?.addedAt ?: now)
        _contacts.value = _contacts.value.filterNot { it.publicKeyHex == key } + c
        persist()
        return c
    }

    @Synchronized
    fun remove(publicKeyHex: String) {
        _contacts.value = _contacts.value.filterNot { it.publicKeyHex == publicKeyHex }
        persist()
    }

    private fun persist() {
        prefs?.edit()?.putString("contacts_json", json.encodeToString(_contacts.value))?.apply()
    }
}
