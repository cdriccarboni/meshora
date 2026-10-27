package org.meshora.app

import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import org.meshora.app.storage.LocalVault

/** Chiffrement au repos des messages et contacts (correction A-P1-6). */
class LocalVaultTest {
    @Before fun jvmBase64() {
        LocalVault.b64e = { java.util.Base64.getEncoder().encodeToString(it) }
        LocalVault.b64d = { java.util.Base64.getDecoder().decode(it) }
    }

    private val v = LocalVault(ByteArray(32) { it.toByte() })

    @Test fun roundTripAndNoPlaintextOnDisk() {
        val secret = """[{"content":"rendez-vous à 18 h, loge 3"}]"""
        val sealed = v.seal(secret)
        assertTrue(LocalVault.isSealed(sealed))
        assertFalse("aucun texte clair dans la valeur stockée", sealed.contains("loge"))
        assertNotEquals("IV aléatoire", sealed, v.seal(secret))
        assertEquals(secret, v.open(sealed))
    }

    @Test fun tamperingOrOtherKeyIsUnreadable() {
        val sealed = v.seal("x")
        val raw = java.util.Base64.getDecoder().decode(sealed.removePrefix(LocalVault.PREFIX)); raw[raw.size - 1] = (raw.last() + 1).toByte()
        assertNull(v.open(LocalVault.PREFIX + java.util.Base64.getEncoder().encodeToString(raw)))
        assertNull(LocalVault(ByteArray(32) { 7 }).open(sealed))
    }

    @Test fun legacyPlaintextIsReadOnceForMigration() {
        assertEquals("[]", v.open("[]"))
    }
}
