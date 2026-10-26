package org.meshora.app

import org.junit.Assert.*
import org.junit.Test
import org.meshora.app.crypto.CryptoEngine
import org.meshora.app.invite.Invitation

class InvitationTest {
    private val key = CryptoEngine.generateIdentityKeyPair().publicKeyHex

    @Test
    fun roundTripHttpsAndAppLink() {
        val inv = Invitation(Invitation.newRoomCode(), key, "Cédric & co", null)
        val link = inv.toLink("https://meshora.pages.dev/app/")
        assertTrue(link.startsWith("https://meshora.pages.dev/app/#join="))
        assertEquals(inv, Invitation.parse(link))
        assertEquals(inv, Invitation.parse(inv.toAppLink()))
        assertEquals(inv, Invitation.parse("  $link  "))
    }

    @Test
    fun relayOnlyWhenCustomAndOnlyWss() {
        val inv = Invitation("g1234", key, "A", "wss://relay.example.org/x?y=1")
        assertEquals(inv, Invitation.parse(inv.toLink("https://meshora.pages.dev/app/")))
        assertNull(Invitation.parse(Invitation("g1234", key, "A", "ws://evil.example").toLink("https://x/app/")))
        assertNull(Invitation.parse(Invitation("g1234", key, "A", "https://evil.example").toLink("https://x/app/")))
    }

    @Test
    fun rejectsInvalid() {
        assertNull(Invitation.parse("https://meshora.pages.dev/app/"))
        assertNull(Invitation.parse("https://meshora.pages.dev/app/#join=../x&k=$key"))
        assertNull(Invitation.parse("https://meshora.pages.dev/app/#join=g1&k=zz"))
        assertNull(Invitation.parse("https://meshora.pages.dev/app/#join=g1"))
        assertNull(Invitation.parse("https://meshora.pages.dev/app/#join=g1&k=" + key.dropLast(2) + "00"))
    }

    @Test
    fun aliasIsSanitised() {
        val parsed = Invitation.parse("meshora://join#join=g1&k=$key&n=" + "A%0A%07B".padEnd(10, 'x') + "x".repeat(60))!!
        assertFalse(parsed.alias.any { it.isISOControl() })
        assertTrue(parsed.alias.length <= 40)
    }

    @Test
    fun roomCodesAreRandomAndValid() {
        val codes = (1..200).map { Invitation.newRoomCode() }.toSet()
        assertEquals(200, codes.size)
        codes.forEach { assertTrue(Invitation.isValidRoom(it)); assertEquals(13, it.length) }
    }
}
