package org.meshora.app.mesh

/**
 * Cache de déduplication à durée de vie et capacité bornées (LRU).
 */
class DedupCache(
    private val capacity: Int = 4096,
    private val ttlMs: Long = 6 * 60 * 60 * 1000L,
    private val clock: () -> Long = System::currentTimeMillis
) {
    private val seen = object : LinkedHashMap<String, Long>(capacity, 0.75f, true) {
        override fun removeEldestEntry(eldest: MutableMap.MutableEntry<String, Long>?): Boolean = size > capacity
    }

    /** Vrai si la clé est nouvelle (et l'enregistre), faux si déjà vue récemment. */
    @Synchronized
    fun firstSeen(key: String): Boolean {
        val now = clock()
        val at = seen[key]
        if (at != null && now - at < ttlMs) return false
        seen[key] = now
        return true
    }

    @Synchronized
    fun size(): Int = seen.size
}

/**
 * Limiteur de débit par pair (seau à jetons) : protège la batterie et le lien contre l'inondation.
 */
class PeerRateLimiter(
    private val capacity: Double = 30.0,
    private val refillPerSecond: Double = 5.0,
    private val maxPeers: Int = 256,
    private val clock: () -> Long = System::currentTimeMillis
) {
    private class Bucket(var tokens: Double, var at: Long)

    private val buckets = object : LinkedHashMap<String, Bucket>(64, 0.75f, true) {
        override fun removeEldestEntry(eldest: MutableMap.MutableEntry<String, Bucket>?): Boolean = size > maxPeers
    }

    @Synchronized
    fun tryAcquire(peer: String): Boolean {
        val now = clock()
        val b = buckets.getOrPut(peer) { Bucket(capacity, now) }
        b.tokens = minOf(capacity, b.tokens + (now - b.at) / 1000.0 * refillPerSecond)
        b.at = now
        if (b.tokens < 1.0) return false
        b.tokens -= 1.0
        return true
    }
}

/**
 * Décision de relais d'une trame reçue (inondation contrôlée, inspirée des valeurs publiées par Bitchat :
 * TTL initial 7, plafonné à 5 quand le nœud a au moins 6 voisins directs).
 */
class RelayPolicy(
    private val dedup: DedupCache = DedupCache(),
    private val limiter: PeerRateLimiter = PeerRateLimiter()
) {
    sealed class Decision {
        /** Trame déjà vue, débit dépassé ou invalide : ignorer. */
        data class Drop(val reason: String) : Decision()
        /** À traiter localement ; [forward] = copie à relayer (ou null si TTL épuisé). */
        data class Accept(val forward: MeshFrame?) : Decision()
    }

    fun onReceived(frame: MeshFrame, fromPeer: String, neighbourCount: Int): Decision {
        if (!limiter.tryAcquire(fromPeer)) return Decision.Drop("débit")
        if (!dedup.firstSeen(frame.dedupKey)) return Decision.Drop("doublon")
        if (frame.ttl == 0) return Decision.Accept(null)
        val cap = if (neighbourCount >= DENSE_NEIGHBOURS) MeshFrame.DENSE_TTL else MeshFrame.MAX_TTL
        val next = minOf(frame.ttl - 1, cap)
        return Decision.Accept(frame.copy(ttl = next))
    }

    /** À appeler pour les trames émises localement, afin de ne pas les relayer en écho. */
    fun markOwn(frame: MeshFrame) {
        dedup.firstSeen(frame.dedupKey)
    }

    companion object {
        const val DENSE_NEIGHBOURS = 6
    }
}
