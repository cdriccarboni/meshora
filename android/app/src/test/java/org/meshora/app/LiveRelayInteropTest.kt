package org.meshora.app

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Test
import org.meshora.app.crypto.CryptoEngine
import org.meshora.app.model.MessageStatus
import org.meshora.app.storage.OutboxRepository
import org.meshora.app.transport.TransportManager

/**
 * Interopérabilité RÉELLE Android (code Kotlin de l'app, sur JVM) ↔ web (vrai code TypeScript)
 * à travers le relais MESHORA. Ignoré si MESHORA_INTEROP_RELAY n'est pas défini.
 * Lancé par tools/audit/interop-android.sh (relais + robot d'écho web).
 */
class LiveRelayInteropTest {
    private val relay = System.getenv("MESHORA_INTEROP_RELAY") ?: ""
    private val room = System.getenv("MESHORA_INTEROP_ROOM") ?: "interop"
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    @After fun tearDown() = scope.cancel()

    private fun waitUntil(ms: Long, cond: () -> Boolean): Boolean {
        val end = System.currentTimeMillis() + ms
        while (System.currentTimeMillis() < end) {
            if (cond()) return true
            Thread.sleep(200)
        }
        return cond()
    }

    @Test
    fun androidAndWebExchangeEncryptedMessagesWithSignedAcks() {
        assumeTrue("MESHORA_INTEROP_RELAY non défini", relay.isNotBlank())
        val repo = OutboxRepository(null)
        val me = CryptoEngine.generateIdentityKeyPair()
        val tm = TransportManager(scope, me, repo, null, alias = "Android-JVM")

        assertTrue(tm.connectWebSocket(relay, room))
        assertTrue("authentification et pair web visibles", waitUntil(15_000) { tm.webSocketTransport.isConnected() && repo.peersFlow.value.isNotEmpty() })
        val web = repo.peersFlow.value.first()
        // V0.4 étape A (relais à jour seulement : MESHORA_INTEROP_V3=1) : la prékey du web est connue → envoi en v3.
        val expectV3 = System.getenv("MESHORA_INTEROP_V3") == "1"
        if (expectV3) assertTrue("prékey du web reçue et vérifiée", waitUntil(10_000) { tm.prekeys.peer(web.publicKeyHex) != null })

        // Android → web : chiffré, accusé signé par la clé du web
        val ping = "ping-" + System.nanoTime()
        val id = tm.sendMessage(web.publicKeyHex, ping)
        assertTrue("« Délivré » sur accusé signé du web", waitUntil(15_000) { repo.messagesFlow.value.first { it.id == id }.status == MessageStatus.DELIVERED })

        // web → Android : réponse chiffrée, déchiffrée et vérifiée par le code Kotlin
        assertTrue("réponse du web reçue", waitUntil(15_000) { repo.messagesFlow.value.any { it.content == "echo:$ping" } })
        val echo = repo.messagesFlow.value.first { it.content == "echo:$ping" }
        assertEquals(web.publicKeyHex, echo.senderPublicKeyHex)
        if (expectV3) assertTrue("réponse du web reçue en enveloppe v3 (prékey Android)", tm.receivedV3.get() >= 1)

        // Outbox : message saisi hors connexion, renvoyé à la reconnexion
        tm.disconnectWebSocket()
        val offline = "ping-offline-" + System.nanoTime()
        val id2 = tm.sendMessage(web.publicKeyHex, offline)
        Thread.sleep(500)
        assertEquals(MessageStatus.QUEUED, repo.messagesFlow.value.first { it.id == id2 }.status)
        assertTrue(tm.connectWebSocket(relay, room))
        assertTrue("renvoi automatique puis « Délivré »", waitUntil(20_000) { repo.messagesFlow.value.first { it.id == id2 }.status == MessageStatus.DELIVERED })
        tm.disconnectWebSocket()
    }
}
