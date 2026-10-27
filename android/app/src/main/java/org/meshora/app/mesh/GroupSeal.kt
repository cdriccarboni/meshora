package org.meshora.app.mesh

import java.nio.ByteBuffer
import java.security.SecureRandom
import javax.crypto.Cipher
import javax.crypto.Mac
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec

/**
 * Scellement de groupe des trames Bluetooth (V0.3, spécification : docs/BLUETOOTH-V0.3.md §3).
 *
 * But : un observateur radio qui n'est pas membre du groupe ne voit NI le nom, NI la clé publique,
 * NI le type de message (annonce, enveloppe, accusé), NI la taille exacte ; il ne peut pas relier
 * les identifiants de trame d'un jour à l'autre. Les membres d'autres groupes relaient quand même
 * la trame, sans pouvoir la lire.
 *
 *   kg(jour)  = HKDF-SHA256(ikm = code du groupe, sel = "MESHORA-BLE-v1", info = "frame|<jour>")
 *   kid(jour) = HKDF-SHA256(ikm = code du groupe, sel = "MESHORA-BLE-v1", info = "id|<jour>")
 *   clair     = type intérieur (1) | longueur (2, BE) | données | zéros jusqu'à un multiple de 128
 *   scellé    = 0x01 | jour (4, BE) | IV (12) | AES-256-GCM(kg, IV, clair, données associées = 0x01 | jour)
 *   id trame  = HMAC-SHA256(kid, étiquette)[0..16)   (enveloppe : "env|<empreinte>", accusé : "ack|<empreinte>")
 * jour = jours entiers depuis le 1er janvier 1970 (UTC) ; on accepte jour − 1, jour, jour + 1.
 * Vecteurs communs Python / Kotlin / TypeScript : GroupSealVectorsTest, prototype/tests/group-seal.test.ts.
 *
 * Limite : la force repose sur le code du groupe (60 bits aléatoires) ; il ne protège que la confidentialité
 * des métadonnées vis-à-vis des étrangers au groupe. Le contenu reste chiffré de bout en bout, en plus.
 */
object GroupSeal {
    const val VERSION = 1
    private const val PAD = 128
    private const val HEADER = 1 + 4 + 12
    private val SALT = "MESHORA-BLE-v1".toByteArray(Charsets.UTF_8)
    private val rng = SecureRandom()
    const val DAY_MS = 86_400_000L

    fun dayOf(millis: Long): Long = Math.floorDiv(millis, DAY_MS)

    fun hkdf(ikm: ByteArray, info: String, length: Int = 32): ByteArray {
        val mac = Mac.getInstance("HmacSHA256")
        mac.init(SecretKeySpec(SALT, "HmacSHA256"))
        val prk = mac.doFinal(ikm)
        mac.init(SecretKeySpec(prk, "HmacSHA256"))
        val out = ByteArray(length)
        var t = ByteArray(0)
        var pos = 0
        var i = 1
        while (pos < length) {
            mac.update(t); mac.update(info.toByteArray(Charsets.UTF_8)); mac.update(i.toByte())
            t = mac.doFinal()
            val n = minOf(t.size, length - pos)
            System.arraycopy(t, 0, out, pos, n)
            pos += n; i++
        }
        return out
    }

    fun frameKey(room: String, day: Long) = hkdf(room.toByteArray(Charsets.UTF_8), "frame|$day")
    fun idKey(room: String, day: Long) = hkdf(room.toByteArray(Charsets.UTF_8), "id|$day")

    /** Identifiant de trame stable pour la journée (déduplication), illisible hors du groupe. */
    fun frameId(room: String, day: Long, label: String): ByteArray {
        val mac = Mac.getInstance("HmacSHA256")
        mac.init(SecretKeySpec(idKey(room, day), "HmacSHA256"))
        return mac.doFinal(label.toByteArray(Charsets.UTF_8)).copyOf(MeshFrame.ID_SIZE)
    }

    fun seal(room: String, day: Long, innerType: MeshFrame.Type, data: ByteArray, iv: ByteArray = ByteArray(12).also { rng.nextBytes(it) }): ByteArray {
        require(data.size <= 0xFFFF) { "données trop grandes" }
        val plainLen = 3 + data.size
        val padded = ByteBuffer.allocate(plainLen + ((PAD - plainLen % PAD) % PAD))
            .put(innerType.code.toByte()).putShort(data.size.toShort()).put(data).array()
        val aad = ByteBuffer.allocate(5).put(VERSION.toByte()).putInt(day.toInt()).array()
        val c = Cipher.getInstance("AES/GCM/NoPadding")
        c.init(Cipher.ENCRYPT_MODE, SecretKeySpec(frameKey(room, day), "AES"), GCMParameterSpec(128, iv))
        c.updateAAD(aad)
        return aad + iv + c.doFinal(padded)
    }

    /** @return (type intérieur, données), ou null si la trame n'est pas de ce groupe, trop ancienne ou altérée. */
    fun open(room: String, sealed: ByteArray, nowMillis: Long = System.currentTimeMillis()): Pair<MeshFrame.Type, ByteArray>? {
        if (sealed.size < HEADER + 16 + PAD || sealed[0].toInt() != VERSION) return null
        val day = ByteBuffer.wrap(sealed, 1, 4).int.toLong() and 0xFFFFFFFFL
        if (kotlin.math.abs(day - dayOf(nowMillis)) > 1) return null
        return try {
            val c = Cipher.getInstance("AES/GCM/NoPadding")
            c.init(Cipher.DECRYPT_MODE, SecretKeySpec(frameKey(room, day), "AES"), GCMParameterSpec(128, sealed, 5, 12))
            c.updateAAD(sealed, 0, 5)
            val plain = c.doFinal(sealed, HEADER, sealed.size - HEADER)
            val type = MeshFrame.Type.of(plain[0].toInt() and 0xFF) ?: return null
            if (type == MeshFrame.Type.SEALED) return null
            val len = ((plain[1].toInt() and 0xFF) shl 8) or (plain[2].toInt() and 0xFF)
            if (3 + len > plain.size) return null
            type to plain.copyOfRange(3, 3 + len)
        } catch (_: Exception) {
            null
        }
    }
}
