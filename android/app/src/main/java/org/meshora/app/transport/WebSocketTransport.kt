package org.meshora.app.transport

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.serialization.json.*
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import org.meshora.app.crypto.CryptoEngine
import org.meshora.app.crypto.EncryptedEnvelope
import org.meshora.app.crypto.KeyIdentity
import org.meshora.app.crypto.SignedAck
import org.meshora.app.model.Peer
import java.util.concurrent.TimeUnit

enum class ConnectionState {
    DISCONNECTED,
    CONNECTING,
    /** Socket ouverte, identité pas encore prouvée au relais. */
    CONNECTED,
    /** HELLO signé accepté : le relais a publié la liste des pairs. */
    AUTHENTICATED
}

/**
 * Transport WebSocket compatible avec le relais MESHORA (`tools/relay/server.js`) et l'application web.
 *
 * Protocole (contre-audit V0.2, identique au client web `prototype/src/transports/WebSocketTransport.ts`) :
 *  relais → MESHORA_CHALLENGE {nonce, room}
 *  client → MESHORA_HELLO {senderId, senderAlias, publicKey, helloSignature}
 *           helloSignature = ECDSA P-256/SHA-256 (IEEE P1363, hex) de "MESHORA-HELLO|v1|<room>|<nonce>|<publicKeyHex>"
 *           senderId = "msh_" + 12 premiers caractères hex de SHA-256(clé SPKI)
 *  relais → MESHORA_PEERS {peers:[{id, alias, publicKey}]}
 *  client ↔ MESHORA_ENVELOPE {envelope}
 *  client ↔ MESHORA_ACK {ack:{messageId, recipientId, timestamp, transport, signedAck}}
 * Aucun message en clair n'est émis ni accepté.
 */
class WebSocketTransport(
    private val scope: CoroutineScope,
    private val onEnvelopeReceived: (EncryptedEnvelope) -> Unit,
    private val onAckReceived: (SignedAck) -> Unit,
    private val onPeersUpdated: (List<Peer>) -> Unit,
    private val onAuthenticated: () -> Unit = {}
) {
    private val client = OkHttpClient.Builder()
        .readTimeout(0, TimeUnit.MILLISECONDS)
        .pingInterval(15, TimeUnit.SECONDS)
        .build()

    private var webSocket: WebSocket? = null
    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }

    private val _connectionState = MutableStateFlow(ConnectionState.DISCONNECTED)
    val connectionState: StateFlow<ConnectionState> = _connectionState.asStateFlow()

    private var identity: KeyIdentity? = null
    private var alias: String = "Android"

    /**
     * @param url adresse du relais, `wss://…` (ou `ws://` en local) ; le paramètre `room` est fixé à [room].
     * @return false si l'adresse est invalide.
     */
    fun connect(url: String, room: String, identity: KeyIdentity, alias: String = "Android"): Boolean {
        disconnect()
        this.identity = identity
        this.alias = alias.take(64)

        val httpUrl = url.trim()
            .replaceFirst(Regex("^wss://", RegexOption.IGNORE_CASE), "https://")
            .replaceFirst(Regex("^ws://", RegexOption.IGNORE_CASE), "http://")
            .toHttpUrlOrNull() ?: return false
        val finalUrl = httpUrl.newBuilder().setQueryParameter("room", room).build()
        val request = Request.Builder().url(finalUrl).build()

        _connectionState.value = ConnectionState.CONNECTING
        webSocket = client.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                _connectionState.value = ConnectionState.CONNECTED
                // L'annonce d'identité attend le défi du relais (preuve de possession de la clé privée).
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                scope.launch(Dispatchers.Default) { handleIncomingJson(webSocket, text) }
            }

            override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
                webSocket.close(1000, null)
                _connectionState.value = ConnectionState.DISCONNECTED
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                _connectionState.value = ConnectionState.DISCONNECTED
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                _connectionState.value = ConnectionState.DISCONNECTED
            }
        })
        return true
    }

    fun disconnect() {
        webSocket?.close(1000, "Normal closure")
        webSocket = null
        _connectionState.value = ConnectionState.DISCONNECTED
    }

    /** Vrai uniquement après authentification auprès du relais. */
    fun isConnected(): Boolean = _connectionState.value == ConnectionState.AUTHENTICATED

    fun sendEnvelope(envelope: EncryptedEnvelope): Boolean {
        val ws = webSocket ?: return false
        if (!isConnected()) return false
        val packet = buildJsonObject {
            put("type", "MESHORA_ENVELOPE")
            put("envelope", json.encodeToJsonElement(envelope))
        }
        return ws.send(packet.toString())
    }

    fun sendAck(ack: SignedAck): Boolean {
        val ws = webSocket ?: return false
        if (!isConnected()) return false
        val me = identity ?: return false
        val packet = buildJsonObject {
            put("type", "MESHORA_ACK")
            putJsonObject("ack") {
                put("messageId", ack.messageId)
                put("recipientId", deriveId(me.publicKeyHex))
                put("recipientAlias", alias)
                put("timestamp", ack.timestamp)
                put("transport", "websocket")
                put("signature", ack.signatureHex)
                put("signedAck", json.encodeToJsonElement(ack))
            }
        }
        return ws.send(packet.toString())
    }

    private fun handleIncomingJson(ws: WebSocket, text: String) {
        val me = identity ?: return
        try {
            val root = json.parseToJsonElement(text).jsonObject
            when (root["type"]?.jsonPrimitive?.contentOrNull) {
                "MESHORA_CHALLENGE" -> {
                    val nonce = root["nonce"]?.jsonPrimitive?.contentOrNull ?: return
                    if (!Regex("^[0-9a-fA-F]{16,128}$").matches(nonce)) return
                    val room = root["room"]?.jsonPrimitive?.contentOrNull ?: return
                    val privateKey = CryptoEngine.importPrivateKey(me.privateKeyPkcs8Hex)
                    val signature = CryptoEngine.signData(privateKey, helloPayload(room, nonce, me.publicKeyHex))
                    val hello = buildJsonObject {
                        put("type", "MESHORA_HELLO")
                        put("senderId", deriveId(me.publicKeyHex))
                        put("senderAlias", alias)
                        put("publicKey", me.publicKeyHex)
                        put("helloSignature", signature)
                        put("room", room)
                    }
                    ws.send(hello.toString())
                }
                "MESHORA_PEERS" -> {
                    val wasAuthenticated = _connectionState.value == ConnectionState.AUTHENTICATED
                    _connectionState.value = ConnectionState.AUTHENTICATED
                    val peers = mutableListOf<Peer>()
                    root["peers"]?.jsonArray?.forEach { el ->
                        val obj = el.jsonObject
                        val pub = obj["publicKey"]?.jsonPrimitive?.contentOrNull ?: return@forEach
                        val id = obj["id"]?.jsonPrimitive?.contentOrNull ?: return@forEach
                        // L'identifiant annoncé doit dériver de la clé (anti-usurpation) ; on s'ignore soi-même.
                        if (pub == me.publicKeyHex || id != deriveIdOrNull(pub)) return@forEach
                        val fp = CryptoEngine.computeFingerprint(pub)
                        val peerAlias = obj["alias"]?.jsonPrimitive?.contentOrNull?.take(64) ?: "Pair"
                        peers.add(Peer(pub, fp, "$peerAlias · ${fp.take(9)}", System.currentTimeMillis(), "WebSocket", true))
                    }
                    onPeersUpdated(peers.distinctBy { it.publicKeyHex })
                    if (!wasAuthenticated) onAuthenticated()
                }
                "MESHORA_ENVELOPE" -> {
                    val envJson = root["envelope"] ?: return
                    onEnvelopeReceived(json.decodeFromJsonElement<EncryptedEnvelope>(envJson))
                }
                "MESHORA_ACK" -> {
                    val signed = root["ack"]?.jsonObject?.get("signedAck") ?: return
                    onAckReceived(json.decodeFromJsonElement<SignedAck>(signed))
                }
                else -> Unit // MESHORA_MSG (clair) et types inconnus : ignorés
            }
        } catch (_: Exception) {
        }
    }

    companion object {
        fun helloPayload(room: String, nonce: String, publicKeyHex: String) =
            "MESHORA-HELLO|v1|$room|$nonce|$publicKeyHex"

        /** Identifiant MESHORA dérivé de la clé publique, identique au web et au relais. */
        fun deriveId(publicKeyHex: String): String =
            "msh_" + CryptoEngine.computeFingerprint(publicKeyHex).replace(":", "").take(12)

        fun deriveIdOrNull(publicKeyHex: String): String? = try {
            deriveId(publicKeyHex)
        } catch (_: Exception) {
            null
        }
    }
}
