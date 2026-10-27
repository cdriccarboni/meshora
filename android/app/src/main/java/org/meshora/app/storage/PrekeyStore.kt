package org.meshora.app.storage

import android.content.Context
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import org.meshora.app.crypto.CryptoEngine
import org.meshora.app.crypto.SignedPrekey
import java.security.PrivateKey

/**
 * V0.4 étape A — prékeys de réception (confidentialité persistante à la semaine), même politique que le web
 * (prototype/src/core/prekeys.ts) :
 *  - une nouvelle prékey tous les 7 jours, annoncée avec une échéance à 8 jours ;
 *  - sa clé privée est EFFACÉE 7 jours après l'échéance : les messages captés qui lui étaient destinés
 *    deviennent illisibles, même pour qui volerait le téléphone ;
 *  - clés privées chiffrées au repos par le magasin de clés Android ([SecureKeyBox]) ;
 *  - prékeys des autres : gardées (vérifiées) jusqu'à leur échéance ; sans prékey valide → enveloppe v2.
 *
 * [kv], [seal], [open] et [clock] sont injectables pour les tests JVM (sans Android).
 */
class PrekeyStore(
    private val kv: KV = MemoryKV(),
    private val seal: (String) -> String = { it },
    private val open: (String) -> String? = { it },
    private val clock: () -> Long = System::currentTimeMillis
) {
    interface KV {
        fun get(key: String): String?
        fun put(key: String, value: String)
    }

    class MemoryKV : KV {
        private val m = java.util.concurrent.ConcurrentHashMap<String, String>()
        override fun get(key: String) = m[key]
        override fun put(key: String, value: String) { m[key] = value }
    }

    @Serializable
    private data class Own(val identity: String, val createdAt: Long, val prekey: SignedPrekey, val sealedPrivate: String)

    private val json = Json { ignoreUnknownKeys = true }
    private val lock = Any()

    private fun own(): List<Own> = runCatching { json.decodeFromString<List<Own>>(kv.get(OWN) ?: "[]") }.getOrDefault(emptyList())
    private fun peers(): Map<String, SignedPrekey> = runCatching { json.decodeFromString<Map<String, SignedPrekey>>(kv.get(PEERS) ?: "{}") }.getOrDefault(emptyMap())

    /** Efface les prékeys privées dont l'échéance + délai de grâce est passée. @return nombre effacé. */
    fun purge(): Int = synchronized(lock) { purgeLocked() }

    private fun purgeLocked(): Int {
        val now = clock()
        val all = own()
        val keep = all.filter { it.prekey.expiresAt + GRACE_MS > now }.takeLast(MAX_OWN)
        if (keep.size != all.size) kv.put(OWN, json.encodeToString(keep))
        return all.size - keep.size
    }

    /** Prékey à annoncer ; en crée une nouvelle si la plus récente a 7 jours ou plus. */
    fun current(identityPrivateKey: PrivateKey, identityPublicKeyHex: String): SignedPrekey =
        synchronized(lock) { currentLocked(identityPrivateKey, identityPublicKeyHex) }

    private fun currentLocked(identityPrivateKey: PrivateKey, identityPublicKeyHex: String): SignedPrekey {
        purgeLocked()
        val now = clock()
        val list = own()
        val latest = list.lastOrNull { it.identity == identityPublicKeyHex }
        if (latest != null && now - latest.createdAt < ROTATE_MS && latest.prekey.expiresAt > now) return latest.prekey
        val (prekey, priv) = CryptoEngine.generatePrekey(identityPrivateKey, identityPublicKeyHex, now + VALID_MS)
        kv.put(OWN, json.encodeToString((list + Own(identityPublicKeyHex, now, prekey, seal(priv))).takeLast(MAX_OWN)))
        return prekey
    }

    /** Clé privée d'une de MES prékeys encore conservées, ou null (inconnue ou déjà effacée). */
    fun privateFor(prekeyId: String): PrivateKey? {
        purge()
        val sealed = own().firstOrNull { it.prekey.id == prekeyId }?.sealedPrivate ?: return null
        return runCatching { open(sealed)?.let { CryptoEngine.importPrivateKey(it) } }.getOrNull()
    }

    /** Mémorise la prékey annoncée par une identité si elle est valide ; jamais de retour à une prékey plus ancienne. */
    fun rememberPeer(identityPublicKeyHex: String, prekey: SignedPrekey?): Boolean =
        synchronized(lock) { rememberLocked(identityPublicKeyHex, prekey) }

    private fun rememberLocked(identityPublicKeyHex: String, prekey: SignedPrekey?): Boolean {
        val now = clock()
        if (prekey == null || !CryptoEngine.verifyPrekey(identityPublicKeyHex, prekey, now)) return false
        val map = peers().filterValues { it.expiresAt > now }.toMutableMap()
        val old = map[identityPublicKeyHex]
        if (old != null && old.expiresAt >= prekey.expiresAt) return true
        map[identityPublicKeyHex] = prekey
        kv.put(PEERS, json.encodeToString(map.entries.toList().takeLast(MAX_PEERS).associate { it.key to it.value }))
        return true
    }

    /** Prékey valide connue pour ce destinataire, ou null → enveloppe v2. */
    fun peer(identityPublicKeyHex: String): SignedPrekey? = peers()[identityPublicKeyHex]?.takeIf { it.expiresAt > clock() }

    companion object {
        const val ROTATE_MS = 7L * 24 * 3600 * 1000
        const val VALID_MS = 8L * 24 * 3600 * 1000
        const val GRACE_MS = 7L * 24 * 3600 * 1000
        private const val OWN = "own_v1"
        private const val PEERS = "peers_v1"
        private const val MAX_OWN = 6
        private const val MAX_PEERS = 500
        const val PREFS = "meshora_prekeys"

        /** Magasin de l'application : préférences privées, clés privées chiffrées par le magasin de clés Android. */
        fun forApp(context: Context): PrekeyStore {
            val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            return PrekeyStore(
                kv = object : KV {
                    override fun get(key: String) = prefs.getString(key, null)
                    override fun put(key: String, value: String) { prefs.edit().putString(key, value).apply() }
                },
                seal = { SecureKeyBox.seal(it) },
                open = { SecureKeyBox.open(it) }
            )
        }
    }
}
