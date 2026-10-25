package org.meshora.app.storage

import android.content.Context
import android.content.SharedPreferences
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import org.meshora.app.model.Message
import org.meshora.app.model.MessageStatus
import org.meshora.app.model.Peer

class OutboxRepository(context: Context? = null) {
    private val prefs: SharedPreferences? = context?.getSharedPreferences("meshora_messages", Context.MODE_PRIVATE)
    private val json = Json { ignoreUnknownKeys = true }

    private val _messages = MutableStateFlow<List<Message>>(emptyList())
    val messagesFlow: StateFlow<List<Message>> = _messages.asStateFlow()

    private val _peers = MutableStateFlow<List<Peer>>(emptyList())
    val peersFlow: StateFlow<List<Peer>> = _peers.asStateFlow()

    private val seenMessageIds = mutableSetOf<String>()

    init {
        loadFromStorage()
    }

    @Synchronized
    private fun loadFromStorage() {
        if (prefs == null) return
        val rawMessages = prefs.getString("messages_json", null)
        if (!rawMessages.isNullOrBlank()) {
            try {
                val list = json.decodeFromString<List<Message>>(rawMessages)
                _messages.value = list
                list.forEach { seenMessageIds.add(it.id) }
            } catch (_: Exception) {}
        }

        val rawSeen = prefs.getStringSet("seen_ids", emptySet())
        if (rawSeen != null) {
            seenMessageIds.addAll(rawSeen)
        }
    }

    @Synchronized
    private fun saveToStorage() {
        if (prefs == null) return
        try {
            val rawMessages = json.encodeToString(_messages.value)
            prefs.edit()
                .putString("messages_json", rawMessages)
                .putStringSet("seen_ids", seenMessageIds.toSet())
                .apply()
        } catch (_: Exception) {}
    }

    @Synchronized
    fun enqueueMessage(message: Message) {
        val current = _messages.value.toMutableList()
        current.removeAll { it.id == message.id }
        current.add(message)
        seenMessageIds.add(message.id)
        _messages.value = current
        saveToStorage()
    }

    @Synchronized
    fun markSent(messageId: String, transport: String) {
        val current = _messages.value.map {
            if (it.id == messageId && it.status == MessageStatus.QUEUED) {
                it.copy(status = MessageStatus.SENT, transportUsed = transport)
            } else {
                it
            }
        }
        _messages.value = current
        saveToStorage()
    }

    @Synchronized
    fun markDelivered(messageId: String) {
        val current = _messages.value.map {
            if (it.id == messageId) {
                it.copy(status = MessageStatus.DELIVERED)
            } else {
                it
            }
        }
        _messages.value = current
        saveToStorage()
    }

    @Synchronized
    fun markFailed(messageId: String) {
        val current = _messages.value.map {
            if (it.id == messageId) {
                it.copy(status = MessageStatus.FAILED)
            } else {
                it
            }
        }
        _messages.value = current
        saveToStorage()
    }

    fun getPendingOutbox(): List<Message> {
        return _messages.value.filter { it.status == MessageStatus.QUEUED || it.status == MessageStatus.SENT }
    }

    @Synchronized
    fun hasSeenMessage(id: String): Boolean {
        return seenMessageIds.contains(id)
    }

    @Synchronized
    fun recordSeenMessage(id: String) {
        seenMessageIds.add(id)
        prefs?.edit()?.putStringSet("seen_ids", seenMessageIds.toSet())?.apply()
    }

    @Synchronized
    fun updatePeers(newPeers: List<Peer>) {
        _peers.value = newPeers
    }

    @Synchronized
    fun addOrUpdatePeer(peer: Peer) {
        val list = _peers.value.toMutableList()
        list.removeAll { it.publicKeyHex == peer.publicKeyHex }
        list.add(peer)
        _peers.value = list
    }
}
