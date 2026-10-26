package org.meshora.app.invite

import org.meshora.app.crypto.CryptoEngine
import java.net.URLDecoder
import java.net.URLEncoder
import java.security.SecureRandom

/**
 * Invitation MESHORA (identique côté web : prototype/src/core/invitation.ts).
 *
 *   https://<site>/app/#join=<groupe>&k=<clé publique hex>&n=<nom>[&r=<relais wss>]
 *   meshora://join#join=<groupe>&k=…            (ouverture directe de l'application Android)
 *
 * Les paramètres sont dans le FRAGMENT (#) : il n'est jamais envoyé au serveur du site.
 * La clé publique de l'invitant voyage hors du relais : elle devient un contact « vérifié ».
 * `r` n'est présent que si l'invitant utilise un autre relais que celui par défaut.
 */
data class Invitation(val room: String, val publicKeyHex: String, val alias: String, val relayUrl: String?) {

    fun toLink(base: String): String {
        val sb = StringBuilder(base.substringBefore('#'))
        sb.append("#join=").append(room)
        sb.append("&k=").append(publicKeyHex)
        if (alias.isNotBlank()) sb.append("&n=").append(enc(alias))
        if (relayUrl != null) sb.append("&r=").append(enc(relayUrl))
        return sb.toString()
    }

    fun toAppLink(): String = toLink("meshora://join")

    companion object {
        private val ROOM_RE = Regex("^[A-Za-z0-9_-]{1,64}$")
        private const val ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789" // sans 0/o/1/l : lisible à voix haute
        private val rng = SecureRandom()

        fun isValidRoom(room: String) = ROOM_RE.matches(room)

        /** Code de groupe aléatoire : « g » + 12 caractères (60 bits). */
        fun newRoomCode(): String = "g" + (1..12).map { ALPHABET[rng.nextInt(ALPHABET.length)] }.joinToString("")

        private fun enc(s: String) = URLEncoder.encode(s, "UTF-8").replace("+", "%20")
        private fun dec(s: String) = URLDecoder.decode(s.replace("+", "%2B"), "UTF-8")

        /** Relais accepté dans une invitation : wss:// uniquement (ws:// seulement pour un relais local d'essai). */
        fun isAcceptableRelay(url: String): Boolean {
            val u = url.trim().lowercase()
            if (u.length > 256) return false
            if (u.startsWith("wss://")) return true
            return u.startsWith("ws://localhost") || u.startsWith("ws://127.0.0.1") || u.startsWith("ws://10.0.2.2")
        }

        /** @return l'invitation, ou null si le lien n'en est pas une ou est invalide. */
        fun parse(link: String): Invitation? {
            val text = link.trim()
            if (text.length > 2048) return null
            val params = text.substringAfter('#', "").ifEmpty { text.substringAfter('?', "") }
            if (params.isEmpty()) return null
            val map = params.split('&').mapNotNull {
                val i = it.indexOf('=')
                if (i <= 0) null else it.substring(0, i) to runCatching { dec(it.substring(i + 1)) }.getOrNull()
            }.toMap()
            val room = map["join"] ?: return null
            if (!isValidRoom(room)) return null
            val key = map["k"]?.let { CryptoEngine.normalizePublicKeyHex(it) } ?: return null
            val alias = (map["n"] ?: "").replace(Regex("[\\p{Cntrl}]"), "").trim().take(40)
            val relay = map["r"]?.takeIf { it.isNotBlank() }
            if (relay != null && !isAcceptableRelay(relay)) return null
            return Invitation(room, key, alias, relay)
        }
    }
}
