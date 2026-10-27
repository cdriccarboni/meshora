package org.meshora.app

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.meshora.app.mesh.DedupCache
import org.meshora.app.mesh.Fragmenter
import org.meshora.app.mesh.MeshFrame
import org.meshora.app.mesh.PeerRateLimiter
import org.meshora.app.mesh.Reassembler
import org.meshora.app.mesh.RelayPolicy
import kotlin.random.Random

class MeshFrameTest {
    private val id = MeshFrame.newMessageId()

    @Test
    fun encodeDecodeRoundTrip() {
        val f = MeshFrame(MeshFrame.Type.ENVELOPE, 7, 0, id, 2, 5, "abc".toByteArray())
        val bytes = f.encode()
        assertEquals(MeshFrame.HEADER_SIZE + 3, bytes.size)
        assertEquals(f, MeshFrame.decode(bytes))
    }

    @Test
    fun decodeRejectsMalformedInput() {
        val good = MeshFrame(MeshFrame.Type.ACK, 3, 0, id, 0, 1, ByteArray(10)).encode()
        assertNull(MeshFrame.decode(ByteArray(5)))                         // trop court
        assertNull(MeshFrame.decode(good.copyOf(good.size - 1)))           // longueur incohérente
        assertNull(MeshFrame.decode(good.clone().also { it[0] = 9 }))      // version inconnue
        assertNull(MeshFrame.decode(good.clone().also { it[1] = 99 }))     // type inconnu
        assertNull(MeshFrame.decode(good.clone().also { it[2] = 8 }))      // TTL > 7
        repeat(2000) { assertTrueNoThrow { MeshFrame.decode(Random.nextBytes(Random.nextInt(0, 80))) } }
    }

    @Test
    fun fragmentationAndReassemblyAnyOrder() {
        val payload = Random.nextBytes(5000)
        val frames = Fragmenter.split(MeshFrame.Type.ENVELOPE, id, payload, 7, maxFrameSize = 185) // MTU BLE courant 185
        assertTrue(frames.all { it.encode().size <= 185 })
        val r = Reassembler()
        var result: ByteArray? = null
        frames.shuffled().forEach { f -> r.accept(MeshFrame.decode(f.encode())!!)?.let { result = it } }
        assertArrayEquals(payload, result)
        assertEquals(0, r.pendingCount())
    }

    @Test
    fun reassemblerBoundsMemoryAndTime() {
        var now = 0L
        val r = Reassembler(timeoutMs = 1000, maxMessageBytes = 1000, maxConcurrent = 2, clock = { now })
        val big = Fragmenter.split(MeshFrame.Type.ENVELOPE, id, ByteArray(3000), 7, 500)
        big.forEach { assertNull(r.accept(it)) }                              // dépasse 1000 octets : abandonné
        assertEquals(0, r.pendingCount())
        repeat(5) { r.accept(Fragmenter.split(MeshFrame.Type.ENVELOPE, MeshFrame.newMessageId(), ByteArray(100), 7, 60)[0]) }
        assertEquals(2, r.pendingCount())                                    // au plus 2 simultanés
        now = 5000
        assertEquals(0, r.pendingCount())                                    // expiration
    }

    @Test
    fun relayPolicyTtlDedupDensityAndRate() {
        val policy = RelayPolicy(DedupCache(), PeerRateLimiter(capacity = 3.0, refillPerSecond = 0.0))
        val f = MeshFrame(MeshFrame.Type.ENVELOPE, 7, 0, id, 0, 1, ByteArray(1))
        val d1 = policy.onReceived(f, "A", neighbourCount = 2) as RelayPolicy.Decision.Accept
        assertEquals(6, d1.forward!!.ttl)
        assertTrue(policy.onReceived(f, "A", 2) is RelayPolicy.Decision.Drop)        // doublon
        val dense = policy.onReceived(f.copy(messageId = MeshFrame.newMessageId()), "A", neighbourCount = 8) as RelayPolicy.Decision.Accept
        assertEquals(5, dense.forward!!.ttl)                                          // plafond milieu dense
        val last = policy.onReceived(f.copy(messageId = MeshFrame.newMessageId(), ttl = 0), "B", 1) as RelayPolicy.Decision.Accept
        assertNull(last.forward)                                                      // TTL épuisé : pas de relais
        assertTrue(policy.onReceived(f.copy(messageId = MeshFrame.newMessageId()), "A", 1) is RelayPolicy.Decision.Drop) // débit
    }

    private fun assertTrueNoThrow(block: () -> Unit) {
        try { block() } catch (e: Exception) { throw AssertionError("exception sur entrée aléatoire", e) }
    }
}
