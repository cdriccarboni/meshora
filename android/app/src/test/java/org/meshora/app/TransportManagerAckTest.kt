package org.meshora.app

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.meshora.app.crypto.CryptoEngine
import org.meshora.app.model.MessageStatus
import org.meshora.app.storage.OutboxRepository
import org.meshora.app.transport.TransportManager
import org.meshora.app.transport.WebSocketTransport

/** Contre-audit V0.2 : règles « Délivré » (accusé v2), réception, identifiants (JVM, sans réseau). */
class TransportManagerAckTest {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    @After fun tearDown() = scope.cancel()

    private val alice = CryptoEngine.generateIdentityKeyPair()
    private val bob = CryptoEngine.generateIdentityKeyPair()
    private val mallory = CryptoEngine.generateIdentityKeyPair()
    private fun priv(k: org.meshora.app.crypto.KeyIdentity) = CryptoEngine.importPrivateKey(k.privateKeyPkcs8Hex)

    @Test
    fun onlyRecipientAckForAnEnvelopeWeSentDelivers() {
        val repo = OutboxRepository(null)
        val tm = TransportManager(scope, alice, repo, null)
        val id = tm.sendMessage(bob.publicKeyHex, "bonjour")!!
        val msg = repo.messagesFlow.value.first { it.id == id }
        val env = tm.prepareEnvelope(msg) // enveloppe réellement émise (empreinte mémorisée)
        fun status() = repo.messagesFlow.value.first { it.id == id }.status

        // Mallory accuse réception d'une enveloppe qu'elle a fabriquée avec le même identifiant
        val fake = CryptoEngine.encryptEnvelope(id, priv(mallory), alice.publicKeyHex, mallory.publicKeyHex, "x")
        tm.handleIncomingAck(CryptoEngine.createSignedAck(fake, priv(mallory)))
        assertEquals(MessageStatus.QUEUED, status())

        // Bob signe un accusé pour une enveloppe que nous n'avons jamais émise (même id, autre contenu)
        val other = CryptoEngine.encryptEnvelope(id, priv(mallory), alice.publicKeyHex, bob.publicKeyHex, "y")
        tm.handleIncomingAck(CryptoEngine.createSignedAck(other, priv(bob)))
        assertEquals(MessageStatus.QUEUED, status())

        // Accusé authentique mais altéré
        val good = CryptoEngine.createSignedAck(env, priv(bob))
        tm.handleIncomingAck(good.copy(timestamp = good.timestamp + 1))
        assertEquals(MessageStatus.QUEUED, status())

        // Accusé authentique de Bob pour l'enveloppe émise : « Délivré »
        tm.handleIncomingAck(good)
        assertEquals(MessageStatus.DELIVERED, status())
    }

    @Test
    fun receivedMessagesAreKeyedBySenderAndId() {
        val repo = OutboxRepository(null)
        val tm = TransportManager(scope, bob, repo, null)
        // Mallory envoie d'abord SA propre enveloppe avec l'identifiant du futur message d'Alice
        tm.handleIncomingEnvelope(CryptoEngine.encryptEnvelope("m1", priv(mallory), mallory.publicKeyHex, bob.publicKeyHex, "faux"))
        val real = CryptoEngine.encryptEnvelope("m1", priv(alice), alice.publicKeyHex, bob.publicKeyHex, "vrai")
        tm.handleIncomingEnvelope(real)
        tm.handleIncomingEnvelope(real) // doublon
        val contents = repo.messagesFlow.value.map { it.content }
        assertTrue("le vrai message n'est pas écarté", contents.contains("vrai"))
        assertEquals(1, contents.count { it == "vrai" })

        tm.handleIncomingEnvelope(CryptoEngine.encryptEnvelope("m2", priv(alice), alice.publicKeyHex, mallory.publicKeyHex, "pas pour Bob"))
        assertTrue(repo.messagesFlow.value.none { it.content == "pas pour Bob" })
    }

    @Test
    fun invalidRecipientKeyIsRefusedWithoutCrash() {
        val repo = OutboxRepository(null)
        val tm = TransportManager(scope, alice, repo, null)
        assertNull(tm.sendMessage("abc", "x"))                 // longueur impaire
        assertNull(tm.sendMessage("zz" + bob.publicKeyHex, "x")) // caractères non hexadécimaux
        assertNull(tm.sendMessage(bob.publicKeyHex.dropLast(2), "x"))
        val id = tm.sendMessage(bob.publicKeyHex.uppercase(), "x") // majuscules : normalisées
        assertEquals(bob.publicKeyHex, repo.messagesFlow.value.first { it.id == id }.recipientPublicKeyHex)
        assertEquals(1, repo.messagesFlow.value.size)
    }

    @Test
    fun derivedIdMatchesIndependentVectorFromNodeAndRelay() {
        // Vecteur calculé indépendamment avec Node (crypto.createHash('sha256') sur la clé SPKI) — voir docs/PROTOCOLE-V0.2.md
        assertEquals(VECTOR_ID, WebSocketTransport.deriveId(VECTOR_SPKI))
    }

    @Test
    fun backoffGrowsAndIsCapped() {
        assertEquals(15_000L, TransportManager.backoff(0))
        assertEquals(30_000L, TransportManager.backoff(1))
        assertEquals(TransportManager.MAX_BACKOFF_MS, TransportManager.backoff(20))
    }

    companion object {
        const val VECTOR_SPKI = "3059301306072a8648ce3d020106082a8648ce3d03010703420004017a04cfe809da3ad6130e560e7ee5dac51d616c989296d26c4e33630ae60acb8268ac1416c6aec260979b9da86ec761acdac374670d607f3e5bc3f87751e56a"
        const val VECTOR_ID = "msh_7481b57cf3d1"
    }
}
