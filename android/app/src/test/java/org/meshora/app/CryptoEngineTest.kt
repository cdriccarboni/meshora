package org.meshora.app

import org.junit.Assert.*
import org.junit.Test
import org.meshora.app.crypto.CryptoEngine

class CryptoEngineTest {

    @Test
    fun testKeyPairGenerationAndFingerprint() {
        val identity = CryptoEngine.generateIdentityKeyPair()
        assertNotNull(identity.publicKeyHex)
        assertNotNull(identity.privateKeyPkcs8Hex)
        assertNotNull(identity.fingerprint)

        // L'empreinte doit être composée de 8 groupes de 4 caractères hex séparés par des ':'
        val parts = identity.fingerprint.split(":")
        assertEquals(8, parts.size)
        parts.forEach { part ->
            assertEquals(4, part.length)
        }
    }

    @Test
    fun testSignatureAndVerificationRoundTrip() {
        val alice = CryptoEngine.generateIdentityKeyPair()
        val privateKey = CryptoEngine.importPrivateKey(alice.privateKeyPkcs8Hex)

        val message = "MESHORA Test Payload 2026"
        val signatureHex = CryptoEngine.signData(privateKey, message)

        val isValid = CryptoEngine.verifySignature(alice.publicKeyHex, signatureHex, message)
        assertTrue("La signature légitime doit être valide", isValid)

        val isTamperedValid = CryptoEngine.verifySignature(alice.publicKeyHex, signatureHex, "Payload Altéré")
        assertFalse("Un payload altéré doit être rejeté", isTamperedValid)
    }

    @Test
    fun testEndToEndEncryptionAndDecryption() {
        val alice = CryptoEngine.generateIdentityKeyPair()
        val bob = CryptoEngine.generateIdentityKeyPair()

        val alicePrivateKey = CryptoEngine.importPrivateKey(alice.privateKeyPkcs8Hex)
        val bobPrivateKey = CryptoEngine.importPrivateKey(bob.privateKeyPkcs8Hex)

        val secretMessage = "Message confidentiel de secours entre Android et Mac"
        val envelope = CryptoEngine.encryptEnvelope(
            messageId = "msg-12345",
            senderPrivateKey = alicePrivateKey,
            senderPublicKeyHex = alice.publicKeyHex,
            recipientPublicKeyHex = bob.publicKeyHex,
            plaintext = secretMessage
        )

        assertEquals("msg-12345", envelope.id)
        assertEquals(alice.publicKeyHex, envelope.senderPublicKeyHex)
        assertEquals(bob.publicKeyHex, envelope.recipientPublicKeyHex)

        // Déchiffrement par Bob
        val decrypted = CryptoEngine.decryptEnvelope(envelope, bobPrivateKey)
        assertEquals(secretMessage, decrypted)
    }

    @Test
    fun testRejectionOfTamperedCiphertext() {
        val alice = CryptoEngine.generateIdentityKeyPair()
        val bob = CryptoEngine.generateIdentityKeyPair()

        val alicePrivateKey = CryptoEngine.importPrivateKey(alice.privateKeyPkcs8Hex)
        val bobPrivateKey = CryptoEngine.importPrivateKey(bob.privateKeyPkcs8Hex)

        val envelope = CryptoEngine.encryptEnvelope(
            messageId = "msg-tamper",
            senderPrivateKey = alicePrivateKey,
            senderPublicKeyHex = alice.publicKeyHex,
            recipientPublicKeyHex = bob.publicKeyHex,
            plaintext = "Original text"
        )

        // Altération d'un seul caractère hex dans le ciphertext
        val tamperedCiphertext = envelope.ciphertextHex.dropLast(2) + "ff"
        val tamperedEnvelope = envelope.copy(ciphertextHex = tamperedCiphertext)

        try {
            CryptoEngine.decryptEnvelope(tamperedEnvelope, bobPrivateKey)
            fail("Le déchiffrement doit lever une SecurityException en cas d'altération")
        } catch (e: SecurityException) {
            // Attendu
            assertTrue(e.message!!.contains("ÉCHEC DE SÉCURITÉ"))
        }
    }

    @Test
    fun testSignedAckCreationAndVerification() {
        val bob = CryptoEngine.generateIdentityKeyPair()
        val bobPrivateKey = CryptoEngine.importPrivateKey(bob.privateKeyPkcs8Hex)

        val ack = CryptoEngine.createSignedAck("msg-999", bobPrivateKey, bob.publicKeyHex)
        assertEquals("msg-999", ack.messageId)
        assertEquals(bob.publicKeyHex, ack.recipientPublicKeyHex)

        val valid = CryptoEngine.verifySignedAck(ack)
        assertTrue("L'accusé de réception signé doit être vérifié avec succès", valid)

        val forgedAck = ack.copy(recipientPublicKeyHex = CryptoEngine.generateIdentityKeyPair().publicKeyHex)
        val forgedValid = CryptoEngine.verifySignedAck(forgedAck)
        assertFalse("Un accusé usurpé doit être rejeté", forgedValid)
    }
}
