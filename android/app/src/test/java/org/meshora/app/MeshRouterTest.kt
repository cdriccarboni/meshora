package org.meshora.app

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.meshora.app.crypto.CryptoEngine
import org.meshora.app.mesh.MeshFrame
import org.meshora.app.mesh.MeshLink
import org.meshora.app.mesh.MeshRouter
import org.meshora.app.model.MessageStatus
import org.meshora.app.storage.OutboxRepository
import org.meshora.app.transport.TransportManager
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.Executors

/**
 * Routeur du maillage et chaîne complète « TransportManager ↔ maillage » avec des liens EN MÉMOIRE
 * (remplaçant la radio pour tester la logique : fragmentation, relais, chiffrement, accusés).
 * Ne prouve rien sur le Bluetooth réel : voir les essais M1–M6 de docs/MESH-NATIF-V0.3.md.
 */
class MeshRouterTest {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private val wire = Executors.newSingleThreadExecutor()
    @After fun tearDown() { scope.cancel(); wire.shutdownNow() }

    /** Lien en mémoire : livraison asynchrone (comme une radio), MTU configurable. */
    private inner class MemLink(override val id: String, private val target: () -> MeshRouter, private val targetLinkId: String, mtu: Int) : MeshLink {
        override val maxFrameSize = mtu - 3
        override fun send(frame: ByteArray): Boolean {
            wire.execute { target().onFrameReceived(targetLinkId, frame) }
            return true
        }
    }

    private fun connect(a: MeshRouter, aName: String, b: MeshRouter, bName: String, mtu: Int = 185) {
        a.addLink(MemLink("$aName->$bName", { b }, "$bName->$aName", mtu))
        b.addLink(MemLink("$bName->$aName", { a }, "$aName->$bName", mtu))
    }

    private fun waitUntil(ms: Long = 8000, cond: () -> Boolean): Boolean {
        val end = System.currentTimeMillis() + ms
        while (System.currentTimeMillis() < end) { if (cond()) return true; Thread.sleep(20) }
        return cond()
    }

    @Test
    fun multiHopDeliveryWithFragmentationTtlAndNoDuplicates() {
        val got = mapOf("A" to CopyOnWriteArrayList<String>(), "B" to CopyOnWriteArrayList(), "C" to CopyOnWriteArrayList(), "D" to CopyOnWriteArrayList())
        val ttls = CopyOnWriteArrayList<Int>()
        fun router(n: String) = MeshRouter({ _, p, ttl, _ -> got[n]!!.add(String(p)); if (n == "D") ttls.add(ttl) })
        val a = router("A"); val b = router("B"); val c = router("C"); val d = router("D")
        connect(a, "A", b, "B"); connect(b, "B", c, "C"); connect(a, "A", c, "C", mtu = 64) // triangle : chemins multiples
        connect(c, "C", d, "D")
        val big = "x".repeat(3000)
        a.broadcast(MeshFrame.Type.ENVELOPE, big.toByteArray(), ttl = 7)
        assertTrue(waitUntil { got["D"]!!.size == 1 && got["B"]!!.size == 1 && got["C"]!!.size == 1 })
        Thread.sleep(300)
        assertEquals(listOf(big), got["D"])            // reçu une seule fois malgré les chemins multiples
        assertEquals(0, got["A"]!!.size)               // pas d'écho vers l'émetteur
        assertTrue("TTL décrémenté à chaque relais : ${ttls}", ttls.first() in 5..6)
    }

    @Test
    fun ttlZeroIsNotRelayed() {
        val got = CopyOnWriteArrayList<String>()
        val a = MeshRouter({ _, _, _, _ -> })
        val b = MeshRouter({ _, p, _, _ -> got.add("B:" + String(p)) })
        val c = MeshRouter({ _, p, _, _ -> got.add("C:" + String(p)) })
        connect(a, "A", b, "B"); connect(b, "B", c, "C")
        a.broadcast(MeshFrame.Type.ANNOUNCE, "salut".toByteArray(), ttl = 0)
        assertTrue(waitUntil { got.contains("B:salut") })
        Thread.sleep(300)
        assertTrue(got.none { it.startsWith("C:") })
    }

    @Test
    fun encryptedMessageAndSignedAckAcrossTwoHopsWithoutInternet() {
        val alice = CryptoEngine.generateIdentityKeyPair()
        val bob = CryptoEngine.generateIdentityKeyPair()
        val relay = CryptoEngine.generateIdentityKeyPair()
        val repoA = OutboxRepository(null); val repoB = OutboxRepository(null); val repoR = OutboxRepository(null)
        val tmA = TransportManager(scope, alice, repoA, null, alias = "Alice")
        val tmB = TransportManager(scope, bob, repoB, null, alias = "Bob")
        val tmR = TransportManager(scope, relay, repoR, null, alias = "Relais")
        // Alice ↔ Relais ↔ Bob : Alice et Bob ne sont pas en liaison directe
        connect(tmA.meshRouter, "A", tmR.meshRouter, "R")
        connect(tmR.meshRouter, "R", tmB.meshRouter, "B")
        listOf(tmA, tmR, tmB).forEach { it.onMeshLinksChanged() }

        assertTrue("Alice voit Bob par les annonces relayées", waitUntil { repoA.peersFlow.value.any { it.publicKeyHex == bob.publicKeyHex } })
        val id = tmA.sendMessage(bob.publicKeyHex, "bonjour sans Internet")!!
        assertTrue("Bob reçoit et déchiffre", waitUntil { repoB.messagesFlow.value.any { it.content == "bonjour sans Internet" } })
        assertTrue("le relais ne lit rien", repoR.messagesFlow.value.none { it.content == "bonjour sans Internet" })
        assertTrue("« Délivré » chez Alice via l'accusé signé relayé", waitUntil { repoA.messagesFlow.value.first { it.id == id }.status == MessageStatus.DELIVERED })
        assertTrue(repoA.messagesFlow.value.first { it.id == id }.transportUsed.contains("Bluetooth"))
    }
}
