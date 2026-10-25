package org.meshora.app.transport

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.serialization.json.*
import okhttp3.*
import org.meshora.app.crypto.CryptoEngine
import org.meshora.app.crypto.EncryptedEnvelope
import org.meshora.app.crypto.SignedAck
import org.meshora.app.model.Peer
import java.util.concurrent.TimeUnit

enum class ConnectionState {
    DISCONNECTED,
    CONNECTING,
    CONNECTED
}

class WebSocketTransport(
    private val scope: CoroutineScope,
    private val onEnvelopeReceived: (EncryptedEnvelope) -> Unit,
    private val onAckReceived: (SignedAck) -> Unit,
    private val onPeersUpdated: (List<Peer>) -> Unit
) {
    private val client = OkHttpClient.Builder()
        .readTimeout(0, TimeUnit.MILLISECONDS)
        .pingInterval(15, TimeUnit.SECONDS)
        .build()

    private var webSocket: WebSocket? = null
    private val json = Json { ignoreUnknownKeys = true }

    private val _connectionState = MutableStateFlow(ConnectionState.DISCONNECTED)
    val connectionState: StateFlow<ConnectionState> = _connectionState.asStateFlow()

    private var currentUrl: String = "ws://10.0.2.2:8999"
    private var currentRoom: String = "general"
    private var myPublicKeyHex: String = ""

    fun connect(url: String, room: String, publicKeyHex: String) {
        currentUrl = url
        currentRoom = room
        myPublicKeyHex = publicKeyHex

        disconnect()
        _connectionState.value = ConnectionState.CONNECTING

        val wsUrl = if (url.contains("?")) "$url&room=$room" else "$url?room=$room"
        val request = Request.Builder().url(wsUrl).build()

        webSocket = client.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                _connectionState.value = ConnectionState.CONNECTED
                // Envoi du paquet d'enregistrement
                val registerPayload = buildJsonObject {
                    put("type", "register")
                    put("publicKeyHex", myPublicKeyHex)
                    put("room", currentRoom)
                }
                webSocket.send(registerPayload.toString())
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                scope.launch(Dispatchers.Default) {
                    handleIncomingJson(text)
                }
            }

            override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
                _connectionState.value = ConnectionState.DISCONNECTED
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                _connectionState.value = ConnectionState.DISCONNECTED
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                _connectionState.value = ConnectionState.DISCONNECTED
            }
        })
    }

    fun disconnect() {
        webSocket?.close(1000, "Normal closure")
        webSocket = null
        _connectionState.value = ConnectionState.DISCONNECTED
    }

    fun isConnected(): Boolean {
        return _connectionState.value == ConnectionState.CONNECTED
    }

    fun sendEnvelope(envelope: EncryptedEnvelope): Boolean {
        val ws = webSocket ?: return false
        if (!isConnected()) return false

        val envelopeJson = json.encodeToJsonElement(envelope)
        val packet = buildJsonObject {
            put("type", "message")
            put("envelope", envelopeJson)
        }
        return ws.send(packet.toString())
    }

    fun sendAck(ack: SignedAck): Boolean {
        val ws = webSocket ?: return false
        if (!isConnected()) return false

        val ackJson = json.encodeToJsonElement(ack)
        val packet = buildJsonObject {
            put("type", "ack")
            put("ack", ackJson)
        }
        return ws.send(packet.toString())
    }

    private fun handleIncomingJson(text: String) {
        try {
            val root = json.parseToJsonElement(text).jsonObject
            val type = root["type"]?.jsonPrimitive?.content ?: return

            when (type) {
                "welcome" -> {
                    val peersArray = root["peers"]?.jsonArray
                    val peersList = mutableListOf<Peer>()
                    peersArray?.forEach { el ->
                        val obj = el.jsonObject
                        val pub = obj["publicKeyHex"]?.jsonPrimitive?.content ?: ""
                        if (pub.isNotBlank() && pub != myPublicKeyHex) {
                            val fp = CryptoEngine.computeFingerprint(pub)
                            peersList.add(Peer(pub, fp, "Pair $fp", System.currentTimeMillis(), "WebSocket", true))
                        }
                    }
                    onPeersUpdated(peersList)
                }
                "peer_joined" -> {
                    val peerObj = root["peer"]?.jsonObject
                    val pub = peerObj?.get("publicKeyHex")?.jsonPrimitive?.content ?: ""
                    if (pub.isNotBlank() && pub != myPublicKeyHex) {
                        val fp = CryptoEngine.computeFingerprint(pub)
                        onPeersUpdated(listOf(Peer(pub, fp, "Pair $fp", System.currentTimeMillis(), "WebSocket", true)))
                    }
                }
                "message" -> {
                    val envJson = root["envelope"] ?: return
                    val envelope = json.decodeFromJsonElement<EncryptedEnvelope>(envJson)
                    onEnvelopeReceived(envelope)
                }
                "ack" -> {
                    val ackJson = root["ack"] ?: return
                    val ack = json.decodeFromJsonElement<SignedAck>(ackJson)
                    onAckReceived(ack)
                }
            }
        } catch (_: Exception) {}
    }
}
