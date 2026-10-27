package org.meshora.app

import org.junit.Assert.*
import org.junit.Test
import org.meshora.app.crypto.CryptoEngine
import org.meshora.app.mesh.GroupSeal
import org.meshora.app.mesh.MeshFrame

/** Vecteurs communs produits par une implémentation Python indépendante (docs/tests/v0.3/group-seal-vectors.json). */
class GroupSealVectorsTest {
    private val room = "gvector2345678"
    private val day = 20388L
    private val iv = CryptoEngine.hexToBytes("000102030405060708090a0b")

    @Test fun keysMatchReference() {
        assertEquals("993e59ddf6d170cb88c7fc96d31ca958532427663a14ab18a73ac4a921080d41", CryptoEngine.bytesToHex(GroupSeal.frameKey(room, day)))
        assertEquals("d2bd7605b3913186f1b9478bb7fc903ff3d77cd71b5a88d9bc9ec95071b7ef1d", CryptoEngine.bytesToHex(GroupSeal.idKey(room, day)))
        assertEquals("35d19abb72c8f21e367196852840d528", CryptoEngine.bytesToHex(GroupSeal.frameId(room, day, "env|00ff")))
    }

    @Test fun sealMatchesReferenceAndOpens() {
        val sealed = GroupSeal.seal(room, day, MeshFrame.Type.ANNOUNCE, "{\"a\":\"b\"}".toByteArray(), iv)
        assertEquals(REF_SEALED, CryptoEngine.bytesToHex(sealed))
        val now = day * GroupSeal.DAY_MS + 3_600_000
        val (type, data) = GroupSeal.open(room, sealed, now)!!
        assertEquals(MeshFrame.Type.ANNOUNCE, type)
        assertEquals("{\"a\":\"b\"}", String(data))
    }

    @Test fun rejectsOtherGroupTamperingAndOldDays() {
        val now = day * GroupSeal.DAY_MS
        val sealed = CryptoEngine.hexToBytes(REF_SEALED)
        assertNull("autre groupe", GroupSeal.open("gautregroupe23", sealed, now))
        val bad = sealed.copyOf(); bad[40] = (bad[40].toInt() xor 1).toByte()
        assertNull("altération", GroupSeal.open(room, bad, now))
        assertNotNull("veille acceptée", GroupSeal.open(room, sealed, now + GroupSeal.DAY_MS))
        assertNull("trop ancienne", GroupSeal.open(room, sealed, now + 2 * GroupSeal.DAY_MS))
        val shifted = sealed.copyOf(); shifted[4] = (shifted[4] + 1).toByte()
        assertNull("jour modifié (données associées)", GroupSeal.open(room, shifted, now))
    }

    @Test fun sizesArePadded() {
        val a = GroupSeal.seal(room, day, MeshFrame.Type.ENVELOPE, ByteArray(1))
        val b = GroupSeal.seal(room, day, MeshFrame.Type.ENVELOPE, ByteArray(120))
        assertEquals("même taille sur l'air", a.size, b.size)
        assertEquals(0, (a.size - 17 - 16) % 128)
    }

    companion object {
        const val REF_SEALED = "0100004fa4000102030405060708090a0bf8b2ff2c29769b61dec5d14e51849188447dfd9b56e82a9188de5d013ec204cac19970714b91f335c77eeaa0bba3c91ea6bbcd30120b0436fd87bc607963e9ec0fab06c378958bdaf421a622c00c38dbba2804121cc1ea373d2d82d1e7e57a4a2ff680dab6e03bb7070293622aa9482073b513d1cefbefdf460acc066275ed4973c07bc76df225e7d048de21b977fa06"
    }
}
