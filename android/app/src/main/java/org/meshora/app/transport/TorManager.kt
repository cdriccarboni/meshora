package org.meshora.app.transport

import android.content.BroadcastReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.ServiceConnection
import android.os.IBinder
import androidx.core.content.ContextCompat
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import org.torproject.jni.TorService
import java.net.InetSocketAddress
import java.net.Proxy

/**
 * Tor intégré (bibliothèque Guardian Project « tor-android », Tor 0.4.9, licence BSD).
 *
 * Mode Tor : la connexion au relais passe par un circuit Tor ; le relais (et Cloudflare) voient
 * l'adresse d'un nœud de sortie Tor au lieu de celle du téléphone. **Fermé par défaut en cas d'échec** :
 * tant que Tor n'est pas prêt, AUCUNE connexion directe n'est tentée (WebSocketTransport.requireProxy).
 *
 * Expérimental : vérifié sur ordinateur (relais joignable et authentification réussie à travers Tor, 27/10/2026),
 * pas encore sur téléphone.
 */
class TorManager(private val context: Context) {
    enum class State { OFF, STARTING, ON, ERROR }

    private val _state = MutableStateFlow(State.OFF)
    val state: StateFlow<State> = _state.asStateFlow()

    @Volatile private var service: TorService? = null
    @Volatile private var socksPort: Int = -1
    private var receiverRegistered = false
    var onReady: () -> Unit = {}

    private val receiver = object : BroadcastReceiver() {
        override fun onReceive(c: Context, intent: Intent) {
            when (intent.getStringExtra(TorService.EXTRA_STATUS)) {
                TorService.STATUS_ON -> refreshPort()
                TorService.STATUS_STARTING -> if (_state.value != State.ON) _state.value = State.STARTING
                TorService.STATUS_OFF, TorService.STATUS_STOPPING -> { socksPort = -1; if (_state.value != State.ERROR) _state.value = State.OFF }
            }
        }
    }

    private val connection = object : ServiceConnection {
        override fun onServiceConnected(name: ComponentName?, binder: IBinder?) {
            service = (binder as? TorService.LocalBinder)?.service
            refreshPort()
        }

        override fun onServiceDisconnected(name: ComponentName?) {
            service = null
            socksPort = -1
            _state.value = State.OFF
        }
    }

    private fun refreshPort() {
        val port = try { service?.socksPort ?: -1 } catch (_: Exception) { -1 }
        if (port > 0) {
            val wasReady = _state.value == State.ON && socksPort == port
            socksPort = port
            _state.value = State.ON
            if (!wasReady) onReady()
        }
    }

    fun start() {
        if (_state.value == State.ON || _state.value == State.STARTING) return
        _state.value = State.STARTING
        try {
            if (!receiverRegistered) {
                ContextCompat.registerReceiver(context, receiver, IntentFilter(TorService.ACTION_STATUS), ContextCompat.RECEIVER_NOT_EXPORTED)
                receiverRegistered = true
            }
            context.bindService(Intent(context, TorService::class.java), connection, Context.BIND_AUTO_CREATE)
        } catch (_: Exception) {
            _state.value = State.ERROR
        }
    }

    fun stop() {
        socksPort = -1
        try { context.unbindService(connection) } catch (_: Exception) {}
        service = null
        _state.value = State.OFF
    }

    /** Proxy SOCKS de Tor, ou null s'il n'est pas prêt (la résolution DNS se fait aussi dans Tor). */
    fun proxy(): Proxy? {
        val p = socksPort
        return if (_state.value == State.ON && p > 0) Proxy(Proxy.Type.SOCKS, InetSocketAddress("127.0.0.1", p)) else null
    }
}
