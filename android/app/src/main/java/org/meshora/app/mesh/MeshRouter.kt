package org.meshora.app.mesh

import java.util.concurrent.ConcurrentHashMap

/**
 * Lien radio direct vers UN voisin (une connexion GATT, un groupe Wi-Fi Direct…).
 * [send] doit être non bloquant et thread-safe ; il renvoie false si la trame n'a pas été mise en file.
 */
interface MeshLink {
    val id: String
    /** Taille maximale d'une trame encodée sur ce lien (ATT_MTU − 3 en BLE). */
    val maxFrameSize: Int
    fun send(frame: ByteArray): Boolean
}

/**
 * Routeur du maillage, indépendant de la radio (testé sur JVM avec des liens en mémoire).
 *  - réassemble les fragments reçus par lien ;
 *  - déduplique au niveau message, applique TTL (7, plafonné à 5 en milieu dense) et limite de débit par lien ;
 *  - livre localement chaque message nouveau et le relaie (TTL − 1) sur tous les AUTRES liens,
 *    re-fragmenté selon la MTU de chacun.
 * La charge utile (enveloppe, accusé, annonce) est opaque pour le routeur : chiffrée et signée en amont.
 */
class MeshRouter(
    private val onMessage: (type: MeshFrame.Type, payload: ByteArray, ttl: Int, fromLink: String) -> Unit,
    private val clock: () -> Long = System::currentTimeMillis
) {
    private val links = ConcurrentHashMap<String, MeshLink>()
    private val reassemblers = ConcurrentHashMap<String, Reassembler>()
    private val dedup = DedupCache(capacity = 8192, clock = clock)
    private val limiter = PeerRateLimiter(capacity = 120.0, refillPerSecond = 20.0, clock = clock)

    fun addLink(link: MeshLink) {
        links[link.id] = link
        reassemblers[link.id] = Reassembler(clock = clock)
    }

    fun removeLink(id: String) {
        links.remove(id)
        reassemblers.remove(id)
    }

    fun linkCount(): Int = links.size

    /** Émet un message local sur tous les liens. Renvoie le nombre de liens qui l'ont accepté. */
    fun broadcast(type: MeshFrame.Type, payload: ByteArray, ttl: Int, messageId: ByteArray = MeshFrame.newMessageId()): Int {
        dedup.firstSeen(MeshFrame(type, ttl, 0, messageId, 0, 1, ByteArray(0)).messageIdHex) // pas d'écho
        return sendTo(links.values, type, payload, ttl, messageId)
    }

    /** À appeler pour chaque trame brute reçue sur un lien. */
    fun onFrameReceived(linkId: String, bytes: ByteArray) {
        val frame = MeshFrame.decode(bytes) ?: return
        if (!limiter.tryAcquire(linkId)) return
        val reassembler = reassemblers[linkId] ?: return
        val payload = reassembler.accept(frame) ?: return
        if (!dedup.firstSeen(frame.messageIdHex)) return
        onMessage(frame.type, payload, frame.ttl, linkId)
        if (frame.ttl > 0) {
            val cap = if (links.size >= RelayPolicy.DENSE_NEIGHBOURS) MeshFrame.DENSE_TTL else MeshFrame.MAX_TTL
            val nextTtl = minOf(frame.ttl - 1, cap)
            sendTo(links.values.filter { it.id != linkId }, frame.type, payload, nextTtl, frame.messageId)
        }
    }

    private fun sendTo(targets: Collection<MeshLink>, type: MeshFrame.Type, payload: ByteArray, ttl: Int, id: ByteArray): Int {
        var ok = 0
        for (link in targets) {
            val frames = try {
                Fragmenter.split(type, id, payload, ttl, link.maxFrameSize)
            } catch (_: IllegalArgumentException) {
                continue // MTU trop petite ou message trop grand pour ce lien
            }
            if (frames.all { link.send(it.encode()) }) ok++
        }
        return ok
    }
}
