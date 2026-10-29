package org.meshora.app.storage

import android.content.Context
import android.content.SharedPreferences
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import org.meshora.app.BuildConfig
import org.meshora.app.invite.Invitation

/** Réglages réseau : relais (par défaut celui de MESHORA), groupe (salon) et nom affiché. */
class Settings(context: Context) {
    private val prefs: SharedPreferences = context.getSharedPreferences("meshora_settings", Context.MODE_PRIVATE)

    data class Values(val relayUrl: String, val room: String, val alias: String, val autoConnect: Boolean, val gatewayEnabled: Boolean = false, val torEnabled: Boolean = false) {
        val usesDefaultRelay get() = relayUrl == DEFAULT_RELAY_URL
    }

    private val _values = MutableStateFlow(load())
    val values: StateFlow<Values> = _values.asStateFlow()
    val current get() = _values.value

    private fun load(): Values {
        var room = prefs.getString("room", null)
        if (room == null || !Invitation.isValidRoom(room)) {
            room = Invitation.newRoomCode()
            prefs.edit().putString("room", room).apply()
        }
        return Values(
            relayUrl = prefs.getString("relay_url", null) ?: DEFAULT_RELAY_URL,
            room = room,
            alias = prefs.getString("alias", null) ?: "",
            autoConnect = prefs.getBoolean("auto_connect", true),
            gatewayEnabled = prefs.getBoolean("gateway_enabled", false),
            torEnabled = prefs.getBoolean("tor_enabled", false)
        )
    }

    private fun save(v: Values) {
        prefs.edit()
            .putString("relay_url", v.relayUrl)
            .putString("room", v.room)
            .putString("alias", v.alias)
            .putBoolean("auto_connect", v.autoConnect)
            .putBoolean("gateway_enabled", v.gatewayEnabled)
            .putBoolean("tor_enabled", v.torEnabled)
            .apply()
        _values.value = v
    }

    fun setRelay(url: String) = save(current.copy(relayUrl = url.trim()))
    fun resetRelay() = save(current.copy(relayUrl = DEFAULT_RELAY_URL))
    fun setRoom(room: String) { if (Invitation.isValidRoom(room)) save(current.copy(room = room)) }
    fun newRoom() = save(current.copy(room = Invitation.newRoomCode()))
    fun setAlias(alias: String) = save(current.copy(alias = alias.trim().take(40)))
    fun setAutoConnect(on: Boolean) = save(current.copy(autoConnect = on))
    fun setGatewayEnabled(on: Boolean) = save(current.copy(gatewayEnabled = on))
    fun setTorEnabled(on: Boolean) = save(current.copy(torEnabled = on))

    companion object {
        val DEFAULT_RELAY_URL: String = BuildConfig.DEFAULT_RELAY_URL
    }
}
