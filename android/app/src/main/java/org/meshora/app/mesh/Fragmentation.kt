package org.meshora.app.mesh

/**
 * Découpage et réassemblage des charges utiles selon la taille utile d'un lien
 * (ATT_MTU − 3 en BLE ; jusqu'à plusieurs Kio en Wi-Fi pair-à-pair).
 */
object Fragmenter {
    /**
     * @param maxFrameSize taille maximale d'une trame encodée sur le lien (en-tête compris).
     */
    fun split(
        type: MeshFrame.Type,
        messageId: ByteArray,
        payload: ByteArray,
        ttl: Int,
        maxFrameSize: Int,
        flags: Int = 0
    ): List<MeshFrame> {
        val chunk = maxFrameSize - MeshFrame.HEADER_SIZE
        require(chunk >= 1) { "maxFrameSize trop petit ($maxFrameSize) pour l'en-tête de ${MeshFrame.HEADER_SIZE} octets" }
        val count = maxOf(1, (payload.size + chunk - 1) / chunk)
        require(count <= MeshFrame.MAX_FRAGMENTS) { "message trop grand : $count fragments" }
        return (0 until count).map { i ->
            val from = i * chunk
            val to = minOf(payload.size, from + chunk)
            MeshFrame(type, ttl, flags, messageId, i, count, payload.copyOfRange(from, to))
        }
    }
}

/**
 * Réassemblage borné : délai, taille totale et nombre de réassemblages simultanés limités
 * (protection mémoire contre l'injection de fragments). Non thread-safe : un par transport.
 */
class Reassembler(
    private val timeoutMs: Long = 30_000,
    private val maxMessageBytes: Int = 64 * 1024,
    private val maxConcurrent: Int = 64,
    private val clock: () -> Long = System::currentTimeMillis
) {
    private class Pending(val type: MeshFrame.Type, val count: Int, val startedAt: Long) {
        val parts = arrayOfNulls<ByteArray>(count)
        var bytes = 0
        var received = 0
    }

    private val pending = LinkedHashMap<String, Pending>()
    /** Messages abandonnés (trop gros, incohérents) : leurs fragments suivants sont ignorés jusqu'à expiration. */
    private val rejected = LinkedHashMap<String, Long>()

    private fun reject(key: String) {
        pending.remove(key)
        rejected[key] = clock()
        if (rejected.size > maxConcurrent * 4) rejected.remove(rejected.keys.first())
    }

    /** Ajoute un fragment ; renvoie la charge utile complète quand le dernier fragment manquant arrive. */
    fun accept(frame: MeshFrame): ByteArray? {
        purgeExpired()
        if (frame.fragCount == 1) return frame.payload
        val key = frame.messageIdHex
        if (rejected.containsKey(key)) return null
        val p = pending[key] ?: run {
            if (pending.size >= maxConcurrent) pending.remove(pending.keys.first()) // éviction du plus ancien
            Pending(frame.type, frame.fragCount, clock()).also { pending[key] = it }
        }
        if (p.count != frame.fragCount || p.type != frame.type) {
            reject(key) // incohérence : on abandonne ce message
            return null
        }
        if (p.parts[frame.fragIndex] != null) return null // doublon
        if (p.bytes + frame.payload.size > maxMessageBytes) {
            reject(key)
            return null
        }
        p.parts[frame.fragIndex] = frame.payload
        p.bytes += frame.payload.size
        p.received++
        if (p.received < p.count) return null
        pending.remove(key)
        val out = ByteArray(p.bytes)
        var off = 0
        for (part in p.parts) {
            System.arraycopy(part!!, 0, out, off, part.size)
            off += part.size
        }
        return out
    }

    fun pendingCount(): Int {
        purgeExpired()
        return pending.size
    }

    private fun purgeExpired() {
        val limit = clock() - timeoutMs
        pending.entries.removeAll { it.value.startedAt < limit }
        rejected.entries.removeAll { it.value < limit }
    }
}
