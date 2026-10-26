package org.meshora.app.transport

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.serialization.json.*
import okhttp3.HttpUrl
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
import java.util.concurrent.atomic.AtomicInteger

/** Cause de la dernière coupure, traduite en message clair par l'interface. */
enum class RelayProblem {
    NONE,
    /** Pas de réseau sur le téléphone. */
    NO_NETWORK,
    /** Relais injoignable (adresse fausse, panne, pare-feu). */
    UNREACHABLE,
    /** Le relais a refusé l'identité (HELLO) : version incompatible ou horloge/clé invalide. */
    REJECTED,
    /** Trop de connexions ou de messages : le relais limite le débit. */
    RATE_LIMITED,
    /** Groupe complet (64 appareils connectés). */
    ROOM_FULL,
    /** Adresse de relais invalide. */
    BAD_ADDRESS,
    /** Mode Tor : en attente du circuit Tor (aucune connexion directe tentée). */
    WAITING_FOR_TOR
}

enum class ConnectionState {
    DISCONNECTED,
    CONNECTING,
    /** Socket ouverte, identité pas encore prouvée au relais. */
    CONNECTED,
    /** HELLO signé accepté : le relais a publié la liste des pairs. */
    AUTHENTICATED
}

/**
 * Transport WebSocket compatible avec le relais MESHORA et l'application web (docs/PROTOCOLE-V0.2.md).
 *
 * Contre-audit V0.2 :
 *  - chaque connexion porte un numéro de génération ; les événements d'une connexion remplacée sont ignorés ;
 *  - reconnexion automatique avec attente progressive (2 s → 60 s) tant que l'utilisateur ne s'est pas déconnecté ;
 *  - les trames sont traitées dans l'ordre, sur le fil de lecture OkHttp (déjà sérialisé) ;
 *  - aucun message en clair n'est émis ni accepté.
 */
class WebSocketTransport(
    private val scope: CoroutineScope,
    private val onEnvelopeReceived: (EncryptedEnvelope) -> Unit,
    private val onAckReceived: (SignedAck) -> Unit,
    private val onPeersUpdated: (List<Peer>) -> Unit,
    private val onAuthenticated: () -> Unit = {}
) {
    private val baseClient = OkHttpClient.Builder()
        .readTimeout(0, TimeUnit.MILLISECONDS)
        .pingInterval(30, TimeUnit.SECONDS) // moins de réveils radio (batterie) ; Cloudflare coupe après ~100 s d'inactivité
        .build()

    /** Proxy à utiliser (Tor), ou null. */
    @Volatile var proxyProvider: () -> java.net.Proxy? = { null }

    /** Mode Tor : sans proxy prêt, AUCUNE connexion directe (échec fermé). */
    @Volatile var requireProxy: Boolean = false

    private fun clientForNow(): OkHttpClient? {
        val proxy = proxyProvider()
        if (proxy == null) return if (requireProxy) null else baseClient
        return baseClient.newBuilder().proxy(proxy).connectTimeout(30, TimeUnit.SECONDS).build()
    }

    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }

    private val _connectionState = MutableStateFlow(ConnectionState.DISCONNECTED)
    val connectionState: StateFlow<ConnectionState> = _connectionState.asStateFlow()

    private val _problem = MutableStateFlow(RelayProblem.NONE)
    val problem: StateFlow<RelayProblem> = _problem.asStateFlow()

    /** Heure (ms) de la prochaine tentative automatique, ou 0. */
    private val _nextRetryAt = MutableStateFlow(0L)
    val nextRetryAt: StateFlow<Long> = _nextRetryAt.asStateFlow()

    /** Réseau du téléphone disponible (fourni par MeshoraApp via ConnectivityManager). */
    @Volatile var networkAvailable: Boolean = true

    private val generation = AtomicInteger(0)
    @Volatile private var webSocket: WebSocket? = null
    @Volatile private var identity: KeyIdentity? = null
    @Volatile private var alias: String = "Android"
    @Volatile private var target: Pair<HttpUrl, String>? = null
    @Volatile private var wantConnected = false
    @Volatile private var reconnectAttempts = 0
    private var reconnectJob: Job? = null

    /**
     * @param url adresse du relais, `wss://…` (ou `ws://` en local) ; le paramètre `room` est fixé à [room].
     * @return false si l'adresse est invalide.
     */
    fun connect(url: String, room: String, identity: KeyIdentity, alias: String = "Android"): Boolean {
        val httpUrl = url.trim()
            .replaceFirst(Regex("^wss://", RegexOption.IGNORE_CASE), "https://")
            .replaceFirst(Regex("^ws://", RegexOption.IGNORE_CASE), "http://")
            .toHttpUrlOrNull()
        if (httpUrl == null || !Regex("^[A-Za-z0-9_-]{1,64}$").matches(room)) {
            _problem.value = RelayProblem.BAD_ADDRESS
            return false
        }
        disconnect()
        this.identity = identity
        this.alias = alias.take(64)
        this.target = httpUrl.newBuilder().setQueryParameter("room", room).build() to room
        wantConnected = true
        reconnectAttempts = 0
        open()
        return true
    }

    private fun open() {
        val (url, _) = target ?: return
        val client = clientForNow()
        if (client == null) {
            _problem.value = RelayProblem.WAITING_FOR_TOR
            _connectionState.value = ConnectionState.DISCONNECTED
            return // TorManager.onReady relancera la connexion
        }
        val gen = generation.incrementAndGet()
        _connectionState.value = ConnectionState.CONNECTING
        webSocket = client.newWebSocket(Request.Builder().url(url).build(), object : WebSocketListener() {
            private fun current() = gen == generation.get()

            override fun onOpen(webSocket: WebSocket, response: Response) {
                if (!current()) return webSocket.cancel()
                _connectionState.value = ConnectionState.CONNECTED
                _problem.value = RelayProblem.NONE
                // L'annonce d'identité attend le défi du relais (preuve de possession de la clé privée).
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                if (!current()) return
                handleIncomingJson(webSocket, text) // fil de lecture OkHttp : ordre préservé
            }

            override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
                webSocket.close(1000, null)
                if (!current()) return
                _problem.value = when {
                    code == 1008 && reason.contains("rate") -> RelayProblem.RATE_LIMITED
                    code == 1008 -> RelayProblem.REJECTED
                    else -> RelayProblem.UNREACHABLE
                }
                lost()
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                if (current()) lost()
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                if (!current()) return
                _problem.value = when {
                    !networkAvailable -> RelayProblem.NO_NETWORK
                    response?.code == 429 -> RelayProblem.RATE_LIMITED
                    response?.code == 503 -> RelayProblem.ROOM_FULL
                    else -> RelayProblem.UNREACHABLE
                }
                lost()
            }
        })
    }

    private fun lost() {
        webSocket = null
        _connectionState.value = ConnectionState.DISCONNECTED
        if (!wantConnected || reconnectJob?.isActive == true) return
        val wait = minOf(2_000L shl minOf(reconnectAttempts, 5), 60_000L)
        reconnectAttempts++
        reconnectJob?.cancel()
        _nextRetryAt.value = System.currentTimeMillis() + wait
        reconnectJob = scope.launch {
            delay(wait)
            _nextRetryAt.value = 0L
            if (wantConnected && webSocket == null) open()
        }
    }

    /** Retour du réseau ou de l'application au premier plan : nouvelle tentative immédiate. */
    fun reconnectNow() {
        if (!wantConnected || webSocket != null) return
        reconnectJob?.cancel()
        _nextRetryAt.value = 0L
        reconnectAttempts = 0
        open()
    }

    /** Vrai si une connexion est voulue (connectée ou en cours de reconnexion). */
    fun isWanted(): Boolean = wantConnected

    /** Déconnexion voulue par l'utilisateur : pas de reconnexion automatique. */
    fun disconnect() {
        wantConnected = false
        reconnectJob?.cancel()
        generation.incrementAndGet() // les événements de l'ancienne connexion seront ignorés
        webSocket?.close(1000, "Normal closure")
        webSocket = null
        _nextRetryAt.value = 0L
        _problem.value = RelayProblem.NONE
        _connectionState.value = ConnectionState.DISCONNECTED
    }

    /** Vrai uniquement après authentification auprès du relais. */
    fun isConnected(): Boolean = _connectionState.value == ConnectionState.AUTHENTICATED && webSocket != null

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
                put("timestamp", ack.timestamp)
                put("transport", "websocket")
                put("signedAck", json.encodeToJsonElement(ack))
            }
        }
        return ws.send(packet.toString())
    }

    private fun handleIncomingJson(ws: WebSocket, text: String) {
        val me = identity ?: return
        val root = try {
            json.parseToJsonElement(text).jsonObject
        } catch (_: Exception) {
            return
        }
        try {
            when ((root["type"] as? JsonPrimitive)?.contentOrNull) {
                "MESHORA_CHALLENGE" -> {
                    val nonce = (root["nonce"] as? JsonPrimitive)?.contentOrNull ?: return
                    if (!Regex("^[0-9a-fA-F]{16,128}$").matches(nonce)) return
                    val room = (root["room"] as? JsonPrimitive)?.contentOrNull ?: return
                    val privateKey = CryptoEngine.importPrivateKey(me.privateKeyPkcs8Hex)
                    val signature = CryptoEngine.signData(privateKey, helloPayload(room, nonce, me.publicKeyHex))
                    val hello = buildJsonObject {
                        put("type", "MESHORA_HELLO")
                        put("senderId", deriveId(me.publicKeyHex))
                        put("senderAlias", alias)
                        put("publicKey", me.publicKeyHex)
                        put("helloSignature", signature)
                    }
                    ws.send(hello.toString())
                }
                "MESHORA_PEERS" -> {
                    val peers = mutableListOf<Peer>()
                    (root["peers"] as? JsonArray)?.forEach { el ->
                        runCatching {
                            val obj = el.jsonObject
                            val pub = obj["publicKey"]?.jsonPrimitive?.contentOrNull ?: return@runCatching
                            val id = obj["id"]?.jsonPrimitive?.contentOrNull ?: return@runCatching
                            // L'identifiant annoncé doit dériver de la clé (anti-usurpation) ; on s'ignore soi-même.
                            if (pub == me.publicKeyHex || id != deriveIdOrNull(pub)) return@runCatching
                            val fp = CryptoEngine.computeFingerprint(pub)
                            val peerAlias = obj["alias"]?.jsonPrimitive?.contentOrNull?.take(64) ?: "Pair"
                            peers.add(Peer(pub, fp, "$peerAlias · ${fp.take(9)}", System.currentTimeMillis(), "WebSocket", true))
                        }
                    }
                    val first = _connectionState.value != ConnectionState.AUTHENTICATED
                    _connectionState.value = ConnectionState.AUTHENTICATED
                    reconnectAttempts = 0
                    onPeersUpdated(peers.distinctBy { it.publicKeyHex })
                    if (first) onAuthenticated()
                }
                "MESHORA_ENVELOPE" -> {
                    val envJson = root["envelope"] ?: return
                    onEnvelopeReceived(json.decodeFromJsonElement<EncryptedEnvelope>(envJson))
                }
                "MESHORA_ACK" -> {
                    val signed = (root["ack"] as? JsonObject)?.get("signedAck") ?: return
                    onAckReceived(json.decodeFromJsonElement<SignedAck>(signed))
                }
                else -> Unit // MESHORA_MSG (clair) et types inconnus : ignorés
            }
        } catch (_: Exception) {
            // trame invalide : ignorée
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
