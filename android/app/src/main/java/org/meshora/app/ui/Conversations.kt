package org.meshora.app.ui

import android.graphics.Bitmap
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import com.google.zxing.BarcodeFormat
import com.google.zxing.EncodeHintType
import com.google.zxing.qrcode.QRCodeWriter
import com.google.zxing.qrcode.decoder.ErrorCorrectionLevel
import org.meshora.app.model.Message
import org.meshora.app.model.Peer
import org.meshora.app.storage.Contact

/** Une personne avec qui l'on peut échanger : contact enregistré, pair connecté ou auteur d'un message. */
data class ConversationEntry(
    val publicKeyHex: String,
    val name: String,
    val fingerprint: String,
    val verified: Boolean,
    val online: Boolean,
    val isContact: Boolean,
    val transport: String?,
    val last: Message?
)

/** Clé publique de l'autre partie d'un message. */
fun Message.counterpartKey(myFingerprint: String): String =
    if (senderFingerprint == myFingerprint) recipientPublicKeyHex else senderPublicKeyHex

/** Nom choisi par le pair, sans le suffixe « · empreinte » ajouté par les transports. */
fun Peer.alias(): String = displayName.substringBeforeLast(" · ").ifBlank { fingerprint.take(9) }

fun buildConversations(
    contacts: List<Contact>,
    peers: List<Peer>,
    messages: List<Message>,
    myFingerprint: String
): List<ConversationEntry> {
    val lastByKey = HashMap<String, Message>()
    messages.forEach { m ->
        val k = m.counterpartKey(myFingerprint)
        val prev = lastByKey[k]
        if (prev == null || m.timestamp >= prev.timestamp) lastByKey[k] = m
    }
    val peerByKey = peers.associateBy { it.publicKeyHex }
    val contactByKey = contacts.associateBy { it.publicKeyHex }
    val keys = LinkedHashSet<String>().apply {
        addAll(contactByKey.keys); addAll(peerByKey.keys); addAll(lastByKey.keys)
    }
    return keys.map { k ->
        val c = contactByKey[k]
        val p = peerByKey[k]
        val fp = c?.fingerprint ?: p?.fingerprint ?: lastByKey[k]?.let { if (it.senderPublicKeyHex == k) it.senderFingerprint else it.recipientFingerprint } ?: ""
        ConversationEntry(
            publicKeyHex = k,
            name = c?.alias ?: p?.alias() ?: fp.take(9),
            fingerprint = fp,
            verified = c?.verified == true,
            online = p != null,
            isContact = c != null,
            transport = p?.transport,
            last = lastByKey[k]
        )
    }.sortedWith(compareByDescending<ConversationEntry> { it.last?.timestamp ?: 0L }.thenByDescending { it.online }.thenBy { it.name.lowercase() })
}

/** QR code (ZXing, Apache-2.0), correction d'erreur M. */
fun qrBitmap(text: String, size: Int = 640): ImageBitmap {
    val matrix = QRCodeWriter().encode(
        text, BarcodeFormat.QR_CODE, size, size,
        mapOf(EncodeHintType.ERROR_CORRECTION to ErrorCorrectionLevel.M, EncodeHintType.MARGIN to 2)
    )
    val pixels = IntArray(size * size) { i -> if (matrix[i % size, i / size]) 0xFF000000.toInt() else 0xFFFFFFFF.toInt() }
    return Bitmap.createBitmap(pixels, size, size, Bitmap.Config.ARGB_8888).asImageBitmap()
}
