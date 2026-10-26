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
import org.meshora.app.model.MessageStatus
import org.meshora.app.storage.OutboxRepository
import org.meshora.app.transport.TransportManager
import org.meshora.app.transport.WebSocketTransport

/** Contre-audit V0.2 : règles « Délivré », réception et identifiant (JVM, sans réseau). */
class TransportManagerAckTest {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    @After fun tearDown() = scope.cancel()

    private val alice = CryptoEngine.generateIdentityKeyPair()
    private val bob = CryptoEngine.generateIdentityKeyPair()
    private val mallory = CryptoEngine.generateIdentityKeyPair()

    @Test
    fun ackSignedByThirdPartyDoesNotDeliver_ackFromRecipientDoes() {
        val repo = OutboxRepository(null)
        val tm = TransportManager(scope, alice, repo, null)
        val id = tm.sendMessage(bob.publicKeyHex, "bonjour")
        assertEquals(MessageStatus.QUEUED, repo.messagesFlow.value.first { it.id == id }.status)

        // Mallory signe un ACK valide… avec SA clé : refusé
        val forged = CryptoEngine.createSignedAck(id, CryptoEngine.importPrivateKey(mallory.privateKeyPkcs8Hex), mallory.publicKeyHex)
        tm.handleIncomingAck(forged)
        assertEquals(MessageStatus.QUEUED, repo.messagesFlow.value.first { it.id == id }.status)

        // ACK de Bob avec signature altérée : refusé
        val good = CryptoEngine.createSignedAck(id, CryptoEngine.importPrivateKey(bob.privateKeyPkcs8Hex), bob.publicKeyHex)
        tm.handleIncomingAck(good.copy(timestamp = good.timestamp + 1))
        assertEquals(MessageStatus.QUEUED, repo.messagesFlow.value.first { it.id == id }.status)

        // ACK authentique de Bob : « Délivré »
        tm.handleIncomingAck(good)
        assertEquals(MessageStatus.DELIVERED, repo.messagesFlow.value.first { it.id == id }.status)
    }

    @Test
    fun envelopeForUsIsDecryptedOnce_otherRecipientIgnored() {
        val repo = OutboxRepository(null)
        val tm = TransportManager(scope, bob, repo, null)
        val alicePriv = CryptoEngine.importPrivateKey(alice.privateKeyPkcs8Hex)
        val env = CryptoEngine.encryptEnvelope("m1", alicePriv, alice.publicKeyHex, bob.publicKeyHex, "salut Bob")
        tm.handleIncomingEnvelope(env)
        tm.handleIncomingEnvelope(env) // doublon
        val received = repo.messagesFlow.value.filter { it.id == "m1" }
        assertEquals(1, received.size)
        assertEquals("salut Bob", received[0].content)

        val other = CryptoEngine.encryptEnvelope("m2", alicePriv, alice.publicKeyHex, mallory.publicKeyHex, "pas pour Bob")
        tm.handleIncomingEnvelope(other)
        assertTrue(repo.messagesFlow.value.none { it.id == "m2" })
    }

    @Test
    fun derivedIdMatchesWebAndRelayFormat() {
        val id = WebSocketTransport.deriveId(alice.publicKeyHex)
        assertTrue(Regex("^msh_[0-9a-f]{12}$").matches(id))
        assertEquals("msh_" + alice.fingerprint.replace(":", "").take(12), id)
    }
}
