package org.meshora.app

import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.meshora.app.crypto.CryptoEngine
import org.meshora.app.mesh.MeshFrame
import org.meshora.app.transport.TransportManager

/** Vecteurs partagés avec le web (prototype/tests/mesh-interop-vectors.ts) : la radio parle la même langue des deux côtés. */
class MeshInteropVectorsTest {
    @Test
    fun referenceFrameMatchesWebEncoding() {
        val f = MeshFrame(MeshFrame.Type.ENVELOPE, 7, 0, ByteArray(16) { it.toByte() }, 1, 3, "abc".toByteArray())
        assertEquals(REF_HEX, CryptoEngine.bytesToHex(f.encode()))
        assertEquals(f, MeshFrame.decode(CryptoEngine.hexToBytes(REF_HEX)))
    }

    @Test
    fun announceSignedByWebCodeIsVerifiedByAndroid() {
        val a = Json.decodeFromString<TransportManager.MeshAnnounce>(WEB_ANNOUNCE)
        assertTrue(CryptoEngine.verifySignature(a.publicKey, a.signature, "MESHORA-ANNOUNCE|v1|${a.publicKey}|${a.alias}|${a.timestamp}"))
        assertTrue(!CryptoEngine.verifySignature(a.publicKey, a.signature, "MESHORA-ANNOUNCE|v1|${a.publicKey}|Autre|${a.timestamp}"))
    }

    companion object {
        const val REF_HEX = "01010700000102030405060708090a0b0c0d0e0f000100030003616263"
        const val WEB_ANNOUNCE = """{"publicKey": "3059301306072a8648ce3d020106082a8648ce3d03010703420004354906fbf8f75c3d7db4966a41ab9932b6887fd3b42b0ef58c09df7949954e663c3a8d921fb6d23815d6e784c6f06756157addcefdd1807c7e8a4fa492d63b38", "alias": "Mac-Web", "timestamp": 1793030000000, "signature": "87352eb69b8aec43114a40a673d0fa9aeccf58fad4d51c8313f59e9a49ccab41dedc7e526aacde295cbc62f62fef8229b91eebbc307952102785537217b0591d"}"""
    }
}
