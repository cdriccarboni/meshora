package org.meshora.app

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import org.junit.After
import org.junit.Assume.assumeTrue
import org.junit.Assert.assertTrue
import org.junit.Test
import org.meshora.app.crypto.CryptoEngine
import org.meshora.app.mesh.MeshLink
import org.meshora.app.mesh.MeshRouter
import org.meshora.app.model.MessageStatus
import org.meshora.app.storage.OutboxRepository
import org.meshora.app.transport.TransportManager
import java.util.concurrent.Executors

/**
 * V0.4 — « Retrouver Internet par les voisins », avec le VRAI relais (MESHORA_INTEROP_RELAY) :
 *   Alice : Bluetooth seulement (liens en mémoire)   ⇄   Bob : passerelle (Bluetooth + relais)   ⇄   Carole : Internet seulement
 * Vérifie : délégation, annonce « via passerelle », messages et accusés signés dans les deux sens, Bob ne lit rien.
 */
class GatewayInteropTest {
    private val relay = System.getenv("MESHORA_INTEROP_RELAY") ?: ""
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private val wire = Executors.newSingleThreadExecutor()
    @After fun tearDown() { scope.cancel(); wire.shutdownNow() }

    private inner class MemLink(override val id: String, private val target: () -> MeshRouter, private val targetLinkId: String) : MeshLink {
        override val maxFrameSize = 182
        override fun send(frame: ByteArray): Boolean { wire.execute { target().onFrameReceived(targetLinkId, frame) }; return true }
    }

    private fun waitUntil(ms: Long = 30_000, cond: () -> Boolean): Boolean {
        val t0 = System.currentTimeMillis()
        while (System.currentTimeMillis() - t0 < ms) { if (cond()) return true; Thread.sleep(200) }
        return cond()
    }

    @Test
    fun meshOnlyMemberReachesInternetMemberThroughGateway() {
        assumeTrue("MESHORA_INTEROP_RELAY non défini", relay.isNotBlank())
        val room = "gw" + System.currentTimeMillis().toString(36)
        val alice = CryptoEngine.generateIdentityKeyPair(); val bob = CryptoEngine.generateIdentityKeyPair(); val carol = CryptoEngine.generateIdentityKeyPair()
        val repoA = OutboxRepository(null); val repoB = OutboxRepository(null); val repoC = OutboxRepository(null)
        val tmA = TransportManager(scope, alice, repoA, null, alias = "Alice")
        val tmB = TransportManager(scope, bob, repoB, null, alias = "Bob-passerelle")
        val tmC = TransportManager(scope, carol, repoC, null, alias = "Carole")
        listOf(tmA, tmB, tmC).forEach { it.groupRoom = room }
        tmB.gatewayEnabled = true

        assertTrue(tmB.connectWebSocket(relay, room)); assertTrue(tmC.connectWebSocket(relay, room))
        assertTrue("passerelle et Carole authentifiées", waitUntil { tmB.webSocketTransport.isConnected() && tmC.webSocketTransport.isConnected() })

        tmA.meshRouter.addLink(MemLink("B", { tmB.meshRouter }, "A"))
        tmB.meshRouter.addLink(MemLink("A", { tmA.meshRouter }, "B"))
        tmA.onMeshLinksChanged(); tmB.onMeshLinksChanged()
        assertTrue("Alice voit la passerelle", waitUntil { repoA.peersFlow.value.any { it.publicKeyHex == bob.publicKeyHex } })
        tmA.announceOnMesh() // envoie la délégation (Alice n'a pas Internet)
        assertTrue("Carole voit Alice « via passerelle »", waitUntil(40_000) { repoC.peersFlow.value.any { it.publicKeyHex == alice.publicKeyHex } })
        assertTrue("Bob sert Alice", tmB.isServing(alice.publicKeyHex))

        // Alice (Bluetooth seul) → Carole (Internet seul)
        val id1 = tmA.sendMessage(carol.publicKeyHex, "depuis le maillage")!!
        assertTrue("Carole reçoit", waitUntil(40_000) { repoC.messagesFlow.value.any { it.content == "depuis le maillage" } })
        assertTrue("« Délivré » chez Alice (accusé de Carole revenu par la passerelle)", waitUntil(40_000) { repoA.messagesFlow.value.first { it.id == id1 }.status == MessageStatus.DELIVERED })

        // Carole → Alice
        val id2 = tmC.sendMessage(alice.publicKeyHex, "depuis Internet")!!
        assertTrue("Alice reçoit par Bluetooth", waitUntil(40_000) { repoA.messagesFlow.value.any { it.content == "depuis Internet" } })
        assertTrue("« Délivré » chez Carole (accusé d'Alice porté par la passerelle)", waitUntil(40_000) { repoC.messagesFlow.value.first { it.id == id2 }.status == MessageStatus.DELIVERED })

        assertTrue("la passerelle ne lit rien", repoB.messagesFlow.value.none { it.content == "depuis le maillage" || it.content == "depuis Internet" })
        tmB.disconnectWebSocket(); tmC.disconnectWebSocket()
    }
}
