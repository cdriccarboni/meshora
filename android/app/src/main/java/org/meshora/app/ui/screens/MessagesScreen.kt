package org.meshora.app.ui.screens

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.Done
import androidx.compose.material.icons.filled.DoneAll
import androidx.compose.material.icons.filled.HourglassTop
import androidx.compose.material.icons.filled.Verified
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import org.meshora.app.MeshoraApp
import org.meshora.app.R
import org.meshora.app.model.Message
import org.meshora.app.model.MessageStatus
import org.meshora.app.ui.ConversationEntry
import org.meshora.app.ui.buildConversations
import org.meshora.app.ui.counterpartKey
import org.meshora.app.ui.theme.*
import java.text.DateFormat
import java.util.*

/**
 * Discussions : liste des personnes (contacts, pairs connectés, auteurs de messages) puis fil par personne.
 * Le destinataire n'est JAMAIS choisi automatiquement : chaque fil correspond à une clé publique.
 */
@Composable
fun MessagesScreen(selectedKey: String?, onSelect: (String?) -> Unit) {
    val app = MeshoraApp.instance
    val tm = app.transportManager
    val messages by tm.outboxRepository.messagesFlow.collectAsState()
    val peers by tm.outboxRepository.peersFlow.collectAsState()
    val contacts by app.contacts.contacts.collectAsState()
    val myFp = tm.identity.fingerprint
    val conversations = remember(contacts, peers, messages) { buildConversations(contacts, peers, messages, myFp) }

    val selected = selectedKey?.let { k -> conversations.firstOrNull { it.publicKeyHex == k } }
    if (selected != null) {
        ChatView(selected, messages.filter { it.counterpartKey(myFp) == selected.publicKeyHex }, myFp, onBack = { onSelect(null) })
    } else {
        ConversationList(conversations, onSelect)
    }
}

@Composable
private fun ConversationList(conversations: List<ConversationEntry>, onSelect: (String) -> Unit) {
    Column(Modifier.fillMaxSize().background(MeshoraBackground).padding(16.dp)) {
        Text(stringResource(R.string.conv_title), style = MaterialTheme.typography.titleLarge)
        Spacer(Modifier.height(12.dp))
        if (conversations.isEmpty()) {
            Card(colors = CardDefaults.cardColors(containerColor = MeshoraSurface), modifier = Modifier.fillMaxWidth()) {
                Column(Modifier.padding(20.dp)) {
                    Text(stringResource(R.string.conv_empty_title), fontWeight = FontWeight.Bold)
                    Spacer(Modifier.height(6.dp))
                    Text(stringResource(R.string.conv_empty_body), style = MaterialTheme.typography.bodyMedium, color = MeshoraTextSecondary)
                }
            }
        } else {
            LazyColumn(Modifier.fillMaxSize()) {
                items(conversations, key = { it.publicKeyHex }) { c ->
                    Card(
                        colors = CardDefaults.cardColors(containerColor = MeshoraSurface),
                        modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp).clickable { onSelect(c.publicKeyHex) }
                    ) {
                        Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                            PresenceDot(c.online)
                            Spacer(Modifier.width(12.dp))
                            Column(Modifier.weight(1f)) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Text(c.name, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                    if (c.verified) VerifiedMark()
                                }
                                Text(
                                    c.last?.content ?: stringResource(if (c.online) R.string.online else R.string.offline),
                                    style = MaterialTheme.typography.bodySmall, color = MeshoraTextSecondary,
                                    maxLines = 1, overflow = TextOverflow.Ellipsis
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun PresenceDot(online: Boolean) {
    val label = stringResource(if (online) R.string.online else R.string.offline)
    Box(
        Modifier.size(10.dp).clip(CircleShape)
            .background(if (online) MeshoraSuccess else MeshoraSurfaceVariant)
            .semantics { contentDescription = label }
    )
}

@Composable
fun VerifiedMark() {
    Spacer(Modifier.width(6.dp))
    Icon(Icons.Default.Verified, contentDescription = stringResource(R.string.verified), tint = MeshoraAccent, modifier = Modifier.size(16.dp))
}

@Composable
private fun ChatView(c: ConversationEntry, thread: List<Message>, myFp: String, onBack: () -> Unit) {
    val tm = MeshoraApp.instance.transportManager
    var text by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }
    val invalidKey = stringResource(R.string.chat_invalid_key)
    BackHandler(onBack = onBack)
    val pending = thread.count { it.senderFingerprint == myFp && (it.status == MessageStatus.QUEUED || it.status == MessageStatus.SENT) }

    Column(Modifier.fillMaxSize().background(MeshoraBackground).padding(horizontal = 12.dp, vertical = 8.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = stringResource(R.string.chat_back)) }
            PresenceDot(c.online)
            Spacer(Modifier.width(8.dp))
            Column(Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(c.name, style = MaterialTheme.typography.titleMedium, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    if (c.verified) VerifiedMark()
                }
                Text(
                    stringResource(R.string.fingerprint_label, c.fingerprint.take(19)),
                    fontFamily = FontFamily.Monospace, fontSize = 11.sp, color = MeshoraTextSecondary
                )
            }
        }
        if (!c.verified) Notice(stringResource(R.string.chat_unverified_notice), MeshoraWarning)
        if (!c.online) Notice(stringResource(R.string.chat_offline_notice), MeshoraTextSecondary)
        if (pending > 0) Notice(stringResource(R.string.chat_pending, pending), MeshoraWarning)

        LazyColumn(Modifier.weight(1f).fillMaxWidth(), reverseLayout = true) {
            items(thread.sortedByDescending { it.timestamp }, key = { it.id }) { m ->
                MessageBubble(m, isFromMe = m.senderFingerprint == myFp)
                Spacer(Modifier.height(8.dp))
            }
        }

        error?.let { Text(it, color = MeshoraError, fontSize = 12.sp, modifier = Modifier.padding(vertical = 4.dp)) }
        Row(Modifier.fillMaxWidth().imePadding(), verticalAlignment = Alignment.CenterVertically) {
            OutlinedTextField(
                value = text, onValueChange = { text = it },
                placeholder = { Text(stringResource(R.string.chat_placeholder)) },
                modifier = Modifier.weight(1f), maxLines = 4
            )
            Spacer(Modifier.width(8.dp))
            IconButton(
                onClick = {
                    if (text.isNotBlank()) {
                        if (tm.sendMessage(c.publicKeyHex, text.trim()) == null) error = invalidKey
                        else { error = null; text = "" }
                    }
                },
                enabled = text.isNotBlank(),
                modifier = Modifier.clip(RoundedCornerShape(12.dp)).background(if (text.isNotBlank()) MeshoraPrimary else MeshoraSurfaceVariant)
            ) {
                Icon(Icons.AutoMirrored.Filled.Send, contentDescription = stringResource(R.string.chat_send), tint = MeshoraTextPrimary)
            }
        }
    }
}

@Composable
fun Notice(text: String, color: androidx.compose.ui.graphics.Color) {
    Surface(color = color.copy(alpha = 0.12f), shape = RoundedCornerShape(8.dp), modifier = Modifier.fillMaxWidth().padding(vertical = 3.dp)) {
        Text(text, modifier = Modifier.padding(8.dp), style = MaterialTheme.typography.bodySmall, color = color)
    }
}

@Composable
fun MessageBubble(message: Message, isFromMe: Boolean) {
    val failedLabel = stringResource(R.string.status_failed)
    Column(Modifier.fillMaxWidth(), horizontalAlignment = if (isFromMe) Alignment.End else Alignment.Start) {
        Surface(
            color = if (isFromMe) MeshoraPrimary.copy(alpha = 0.25f) else MeshoraSurface,
            shape = RoundedCornerShape(12.dp),
            modifier = Modifier.widthIn(max = 300.dp)
        ) {
            Column(Modifier.padding(10.dp)) {
                Text(message.content, style = MaterialTheme.typography.bodyLarge, color = MeshoraTextPrimary)
                Spacer(Modifier.height(4.dp))
                Row(Modifier.align(Alignment.End), verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        DateFormat.getTimeInstance(DateFormat.SHORT, Locale.getDefault()).format(Date(message.timestamp)),
                        fontSize = 10.sp, color = MeshoraTextSecondary
                    )
                    if (isFromMe) {
                        Spacer(Modifier.width(4.dp))
                        // Règle de vérité : « Délivré » uniquement sur accusé signé valide.
                        when (message.status) {
                            MessageStatus.QUEUED -> Icon(Icons.Default.HourglassTop, stringResource(R.string.status_queued), tint = MeshoraWarning, modifier = Modifier.size(14.dp))
                            MessageStatus.SENT -> Icon(Icons.Default.Done, stringResource(R.string.status_sent), tint = MeshoraTextSecondary, modifier = Modifier.size(14.dp))
                            MessageStatus.DELIVERED -> Icon(Icons.Default.DoneAll, stringResource(R.string.status_delivered), tint = MeshoraSuccess, modifier = Modifier.size(14.dp))
                            MessageStatus.FAILED -> Text("✕", color = MeshoraError, fontSize = 11.sp, fontWeight = FontWeight.Bold,
                                modifier = Modifier.semantics { contentDescription = failedLabel })
                        }
                    }
                }
            }
        }
    }
}
