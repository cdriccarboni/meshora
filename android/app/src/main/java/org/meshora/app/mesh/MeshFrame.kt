package org.meshora.app.mesh

import java.nio.ByteBuffer
import java.security.SecureRandom
import java.util.UUID

/**
 * Trame du maillage MESHORA (couche liaison commune BLE / Wi-Fi pair-à-pair), version 1.
 * Spécification : docs/MESH-NATIF-V0.3.md §3. Code pur, sans dépendance Android, testé sur JVM.
 *
 * Disposition (gros-boutiste), en-tête de [HEADER_SIZE] octets :
 *   version(1) type(1) ttl(1) flags(1) messageId(16) fragIndex(2) fragCount(2) payloadLength(2) payload(n)
 *
 * La trame elle-même n'est ni chiffrée ni signée : sa charge utile est une enveloppe MESHORA
 * déjà chiffrée et signée de bout en bout (docs/PROTOCOLE-V0.2.md). Le TTL est volontairement hors
 * de toute signature pour que les relais puissent le décrémenter.
 */
data class MeshFrame(
    val type: Type,
    val ttl: Int,
    val flags: Int,
    val messageId: ByteArray,
    val fragIndex: Int,
    val fragCount: Int,
    val payload: ByteArray
) {
    enum class Type(val code: Int) {
        ENVELOPE(1), ACK(2), ANNOUNCE(3),
        /** V0.3 : charge utile scellée par la clé du groupe ([GroupSeal]) ; le vrai type est chiffré à l'intérieur. */
        SEALED(4),
        /** V0.4 (toujours à l'intérieur d'une trame scellée) : délégation d'un membre sans Internet à une passerelle. */
        DELEGATE(5);
        companion object {
            fun of(code: Int): Type? = entries.firstOrNull { it.code == code }
        }
    }

    init {
        require(ttl in 0..MAX_TTL) { "TTL hors limites : $ttl" }
        require(flags in 0..0xFF) { "flags hors limites" }
        require(messageId.size == ID_SIZE) { "messageId doit faire $ID_SIZE octets" }
        require(fragCount in 1..MAX_FRAGMENTS) { "fragCount hors limites : $fragCount" }
        require(fragIndex in 0 until fragCount) { "fragIndex hors limites : $fragIndex/$fragCount" }
        require(payload.size <= 0xFFFF) { "charge utile trop grande" }
    }

    /** Clé de déduplication d'un fragment (identifiant + rang). */
    val dedupKey: String get() = messageIdHex + ":" + fragIndex

    val messageIdHex: String get() = messageId.joinToString("") { "%02x".format(it) }

    fun encode(): ByteArray {
        val buf = ByteBuffer.allocate(HEADER_SIZE + payload.size)
        buf.put(VERSION.toByte())
        buf.put(type.code.toByte())
        buf.put(ttl.toByte())
        buf.put(flags.toByte())
        buf.put(messageId)
        buf.putShort(fragIndex.toShort())
        buf.putShort(fragCount.toShort())
        buf.putShort(payload.size.toShort())
        buf.put(payload)
        return buf.array()
    }

    /** Copie pour relais : TTL décrémenté. */
    fun forwarded(): MeshFrame {
        check(ttl > 0) { "TTL épuisé" }
        return copy(ttl = ttl - 1)
    }

    override fun equals(other: Any?): Boolean =
        other is MeshFrame && type == other.type && ttl == other.ttl && flags == other.flags &&
            messageId.contentEquals(other.messageId) && fragIndex == other.fragIndex &&
            fragCount == other.fragCount && payload.contentEquals(other.payload)

    override fun hashCode(): Int = dedupKey.hashCode()

    companion object {
        const val VERSION = 1
        const val ID_SIZE = 16
        const val HEADER_SIZE = 1 + 1 + 1 + 1 + ID_SIZE + 2 + 2 + 2
        /** TTL maximal accepté (comme Bitchat : 7 ; plafonné à [DENSE_TTL] en milieu dense). */
        const val MAX_TTL = 7
        const val DENSE_TTL = 5
        const val MAX_FRAGMENTS = 256

        private val random = SecureRandom()

        fun newMessageId(): ByteArray = ByteArray(ID_SIZE).also { random.nextBytes(it) }

        fun messageIdFromString(id: String): ByteArray {
            // Identifiants « msg-<uuid> » (Android) ou libres (web) : dérivation stable sur 16 octets.
            val digest = java.security.MessageDigest.getInstance("SHA-256").digest(id.toByteArray(Charsets.UTF_8))
            return digest.copyOf(ID_SIZE)
        }

        /** Décode une trame ; renvoie null pour toute entrée invalide (jamais d'exception vers le transport). */
        fun decode(bytes: ByteArray): MeshFrame? {
            if (bytes.size < HEADER_SIZE) return null
            val buf = ByteBuffer.wrap(bytes)
            val version = buf.get().toInt() and 0xFF
            if (version != VERSION) return null
            val type = Type.of(buf.get().toInt() and 0xFF) ?: return null
            val ttl = buf.get().toInt() and 0xFF
            val flags = buf.get().toInt() and 0xFF
            val id = ByteArray(ID_SIZE).also { buf.get(it) }
            val fragIndex = buf.short.toInt() and 0xFFFF
            val fragCount = buf.short.toInt() and 0xFFFF
            val length = buf.short.toInt() and 0xFFFF
            if (bytes.size != HEADER_SIZE + length) return null
            if (ttl > MAX_TTL || fragCount !in 1..MAX_FRAGMENTS || fragIndex >= fragCount) return null
            val payload = ByteArray(length).also { buf.get(it) }
            return MeshFrame(type, ttl, flags, id, fragIndex, fragCount, payload)
        }

        @Suppress("unused")
        fun uuidBytes(u: UUID): ByteArray =
            ByteBuffer.allocate(16).putLong(u.mostSignificantBits).putLong(u.leastSignificantBits).array()
    }
}
