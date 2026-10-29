package org.meshora.app

import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.long
import org.junit.Assert.*
import org.junit.Test
import org.meshora.app.crypto.CryptoEngine
import org.meshora.app.crypto.EncryptedEnvelope
import org.meshora.app.crypto.SignedPrekey
import org.meshora.app.storage.PrekeyStore
import java.io.File

/**
 * V0.4 étape A — prékeys signées, HKDF, enveloppe v3, rotation et effacement.
 * Vecteurs communs : tools/audit/prekey-reference.py → docs/tests/v0.4/prekey-vectors.json (relus aussi par TypeScript).
 */
class PrekeyTest {
    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }
    private val v = Json.parseToJsonElement(
        listOf("../../docs/tests/v0.4/prekey-vectors.json", "../docs/tests/v0.4/prekey-vectors.json", "docs/tests/v0.4/prekey-vectors.json")
            .map(::File).first { it.exists() }.readText()
    ).jsonObject
    private fun s(k: String) = v[k]!!.jsonPrimitive.content
    private val prekey = json.decodeFromJsonElement(SignedPrekey.serializer(), v["prekey"]!!)
    private val envelope = json.decodeFromJsonElement(EncryptedEnvelope.serializer(), v["envelope"]!!)
    private val vNow = prekey.expiresAt - 24 * 3600 * 1000L

    @Test fun vectorsMatchPythonReference() {
        assertEquals(s("prekeySignedString"), CryptoEngine.prekeySignedString(s("bobIdentityPublicHex"), prekey.publicKeyHex, prekey.id, prekey.expiresAt))
        assertEquals(prekey.id, CryptoEngine.prekeyId(prekey.publicKeyHex))
        assertTrue("prékey signée par Python acceptée", CryptoEngine.verifyPrekey(s("bobIdentityPublicHex"), prekey, vNow))
        assertFalse("autre identité", CryptoEngine.verifyPrekey(s("aliceIdentityPublicHex"), prekey, vNow))
        assertFalse("échue", CryptoEngine.verifyPrekey(s("bobIdentityPublicHex"), prekey, prekey.expiresAt + 1))
        assertFalse("échéance modifiée", CryptoEngine.verifyPrekey(s("bobIdentityPublicHex"), prekey.copy(expiresAt = prekey.expiresAt + 1), vNow))
        assertEquals(s("hkdfInfo"), CryptoEngine.envelopeHkdfInfo(s("aliceIdentityPublicHex"), s("bobIdentityPublicHex"), prekey.id))
        val salt = CryptoEngine.hexToBytes(envelope.saltHex!!)
        assertEquals(s("messageKeyHex"), CryptoEngine.bytesToHex(CryptoEngine.v3MessageKey(CryptoEngine.importPrivateKey(s("prekeyPrivatePkcs8Hex")), envelope.ephemeralPublicKeyHex, salt, s("hkdfInfo"))))
        assertEquals(s("messageKeyHex"), CryptoEngine.bytesToHex(CryptoEngine.v3MessageKey(CryptoEngine.importPrivateKey(s("ephemeralPrivatePkcs8Hex")), prekey.publicKeyHex, salt, s("hkdfInfo"))))
        assertEquals(s("envelopeSignedString"), CryptoEngine.envelopeSignedString(envelope))
        val bobId = CryptoEngine.importPrivateKey(s("bobIdentityPrivatePkcs8Hex"))
        val pkPriv = CryptoEngine.importPrivateKey(s("prekeyPrivatePkcs8Hex"))
        assertEquals(s("plaintext"), CryptoEngine.decryptEnvelope(envelope, bobId) { if (it == prekey.id) pkPriv else null })
        assertThrows(SecurityException::class.java) { CryptoEngine.decryptEnvelope(envelope, bobId) } // prékey effacée → illisible
        for (bad in listOf(envelope.copy(prekeyId = "ffffffffffffffff"), envelope.copy(saltHex = "00".repeat(32)), envelope.copy(timestamp = envelope.timestamp + 1), envelope.copy(v = null))) {
            assertThrows(Exception::class.java) { CryptoEngine.decryptEnvelope(bad, bobId) { pkPriv } }
        }
    }

    @Test fun v2EnvelopesNeverCarryNullV3Fields() {
        val a = CryptoEngine.generateIdentityKeyPair(); val b = CryptoEngine.generateIdentityKeyPair()
        val env = CryptoEngine.encryptEnvelope("m", CryptoEngine.importPrivateKey(a.privateKeyPkcs8Hex), a.publicKeyHex, b.publicKeyHex, "x")
        val text = json.encodeToString(env) // encodeDefaults = true, comme les transports
        assertFalse("pas de \"v\":null émis (le web et les relais le refuseraient)", text.contains("\"v\"") || text.contains("prekeyId") || text.contains("saltHex"))
        val v3 = json.encodeToString(envelope)
        assertTrue(v3.contains("\"v\":3") && v3.contains("prekeyId") && v3.contains("saltHex"))
        assertEquals(envelope, json.decodeFromString(EncryptedEnvelope.serializer(), v3)) // aller-retour (passerelle) sans perte
    }

    @Test fun rotationEraseAndFallback() {
        var t = 1_800_000_000_000L
        val alice = CryptoEngine.generateIdentityKeyPair(); val bob = CryptoEngine.generateIdentityKeyPair()
        val aPriv = CryptoEngine.importPrivateKey(alice.privateKeyPkcs8Hex); val bPriv = CryptoEngine.importPrivateKey(bob.privateKeyPkcs8Hex)
        val bobStore = PrekeyStore(clock = { t }); val aliceStore = PrekeyStore(clock = { t })
        val p1 = bobStore.current(bPriv, bob.publicKeyHex)
        assertEquals(t + PrekeyStore.VALID_MS, p1.expiresAt)
        assertEquals(p1.id, bobStore.current(bPriv, bob.publicKeyHex).id)
        assertTrue(aliceStore.rememberPeer(bob.publicKeyHex, p1))
        assertFalse("prékey de Bob présentée pour Alice", aliceStore.rememberPeer(alice.publicKeyHex, p1))
        fun send(txt: String): EncryptedEnvelope {
            val pk = aliceStore.peer(bob.publicKeyHex)
            return if (pk != null) CryptoEngine.encryptEnvelopeV3("m-$txt", aPriv, alice.publicKeyHex, bob.publicKeyHex, pk, txt, t)
            else CryptoEngine.encryptEnvelope("m-$txt", aPriv, alice.publicKeyHex, bob.publicKeyHex, txt)
        }
        fun read(e: EncryptedEnvelope) = CryptoEngine.decryptEnvelope(e, bPriv) { bobStore.privateFor(it) }
        val e1 = send("semaine 1")
        assertEquals(3, e1.v)
        assertEquals("semaine 1", read(e1))
        assertTrue("accusé v2 inchangé", CryptoEngine.verifySignedAck(CryptoEngine.createSignedAck(e1, bPriv)))
        t += PrekeyStore.ROTATE_MS + 1
        val p2 = bobStore.current(bPriv, bob.publicKeyHex)
        assertNotEquals(p1.id, p2.id)
        assertEquals("lisible pendant le délai de grâce", "semaine 1", read(e1))
        assertTrue(aliceStore.rememberPeer(bob.publicKeyHex, p2))
        aliceStore.rememberPeer(bob.publicKeyHex, p1)
        assertEquals("pas de retour arrière", p2.id, aliceStore.peer(bob.publicKeyHex)?.id)
        t = p1.expiresAt + PrekeyStore.GRACE_MS + 1
        assertNull("prékey 1 effacée", bobStore.privateFor(p1.id))
        assertThrows("CONFIDENTIALITÉ PERSISTANTE : message de la semaine 1 illisible", SecurityException::class.java) { read(e1) }
        assertNull("prékey échue ignorée → v2", aliceStore.peer(bob.publicKeyHex))
        val e3 = send("repli")
        assertNull(e3.v)
        assertEquals("repli", read(e3))
    }
}
