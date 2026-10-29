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

/**
 * Messages et file d'envoi. Sur l'appareil, l'historique est CHIFFRÉ au repos ([LocalVault], correction A-P1-6) ;
 * un ancien historique en clair est lu une fois puis réécrit chiffré. Sans coffre disponible, rien n'est écrit
 * en clair : les données restent en mémoire. [vault] est injectable pour les tests JVM.
 */
class OutboxRepository(context: Context? = null, vault: LocalVault? = null) {
    private val prefs: SharedPreferences? = context?.getSharedPreferences("meshora_messages", Context.MODE_PRIVATE)
    private val vault: LocalVault? = vault ?: context?.let { LocalVault.forApp(it) }
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
        val rawMessages = prefs.getString("messages_json", null)?.let { stored -> vault?.open(stored) ?: stored.takeUnless { LocalVault.isSealed(it) } }
        if (!rawMessages.isNullOrBlank()) {
            try {
                val list = json.decodeFromString<List<Message>>(rawMessages)
                _messages.value = list
                list.forEach { seenMessageIds.add(it.id) }
            } catch (_: Exception) {}
        }

        // Ancien format (identifiants en clair) puis format chiffré.
        prefs.getStringSet("seen_ids", null)?.let { seenMessageIds.addAll(it) }
        prefs.getString("seen_json", null)?.let { stored -> vault?.open(stored) }?.let { raw ->
            runCatching { seenMessageIds.addAll(json.decodeFromString<List<String>>(raw)) }
        }
        if (vault != null && (prefs.contains("seen_ids") || prefs.getString("messages_json", null)?.let { !LocalVault.isSealed(it) } == true)) {
            saveToStorage() // migration : réécrit chiffré et supprime le clair
        }
    }

    @Synchronized
    private fun saveToStorage() {
        if (prefs == null) return
        val v = vault ?: return // jamais d'écriture en clair
        try {
            prefs.edit()
                .putString("messages_json", v.seal(json.encodeToString(_messages.value)))
                .putString("seen_json", v.seal(json.encodeToString(seenMessageIds.toList())))
                .remove("seen_ids")
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
        saveToStorage()
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
