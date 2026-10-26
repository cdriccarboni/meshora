package org.meshora.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Done
import androidx.compose.material.icons.filled.DoneAll
import androidx.compose.material.icons.filled.HourglassTop
import androidx.compose.material.icons.filled.Send
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import org.meshora.app.MeshoraApp
import org.meshora.app.model.Message
import org.meshora.app.model.MessageStatus
import org.meshora.app.ui.theme.*
import java.text.SimpleDateFormat
import java.util.*

@Composable
fun MessagesScreen(
    onSelectPeer: (String) -> Unit = {}
) {
    val transportManager = MeshoraApp.instance.transportManager
    val messages by transportManager.outboxRepository.messagesFlow.collectAsState()
    val peers by transportManager.outboxRepository.peersFlow.collectAsState()
    val connectionState by transportManager.webSocketTransport.connectionState.collectAsState()

    var recipientKeyInput by remember { mutableStateOf("") }
    var sendError by remember { mutableStateOf<String?>(null) }
    var textInput by remember { mutableStateOf("") }

    // Si des pairs sont disponibles et qu'aucun destinataire n'est saisi, pré-sélectionner le premier
    LaunchedEffect(peers) {
        if (recipientKeyInput.isBlank() && peers.isNotEmpty()) {
            recipientKeyInput = peers.first().publicKeyHex
        }
    }

    val pendingCount = messages.count { it.status == MessageStatus.QUEUED || it.status == MessageStatus.SENT }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MeshoraBackground)
            .padding(16.dp)
    ) {
        // En-tête statut & Outbox
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = MeshoraSurface)
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(12.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(
                        text = "Protocole E2EE P-256 + AES-GCM",
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.SemiBold,
                        color = MeshoraAccent
                    )
                    Text(
                        text = "Identité : ${transportManager.identity.fingerprint}",
                        style = MaterialTheme.typography.labelSmall
                    )
                }
                if (pendingCount > 0) {
                    Surface(
                        color = MeshoraWarning.copy(alpha = 0.2f),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Text(
                            text = "Outbox: $pendingCount",
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                            color = MeshoraWarning,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(8.dp))

        // Sélecteur de destinataire
        if (peers.isNotEmpty()) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Destinataire : ",
                    style = MaterialTheme.typography.bodySmall,
                    color = MeshoraTextSecondary
                )
                Text(
                    text = peers.find { it.publicKeyHex == recipientKeyInput }?.fingerprint ?: "Manuel",
                    style = MaterialTheme.typography.bodySmall,
                    color = MeshoraAccent,
                    fontWeight = FontWeight.Bold
                )
            }
        } else {
            OutlinedTextField(
                value = recipientKeyInput,
                onValueChange = { recipientKeyInput = it },
                label = { Text("Clé publique hexadécimale du destinataire") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                textStyle = MaterialTheme.typography.labelSmall
            )
        }

        Spacer(modifier = Modifier.height(8.dp))

        // Liste des messages
        LazyColumn(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth(),
            reverseLayout = true
        ) {
            items(messages.reversed(), key = { it.id }) { msg ->
                MessageBubble(
                    message = msg,
                    isFromMe = msg.senderFingerprint == transportManager.identity.fingerprint
                )
                Spacer(modifier = Modifier.height(8.dp))
            }
        }

        Spacer(modifier = Modifier.height(8.dp))

        // Champ de saisie et bouton d'envoi
        sendError?.let {
            Text(text = it, color = MeshoraError, fontSize = 12.sp, modifier = Modifier.padding(vertical = 4.dp))
        }
        Row(
            modifier = Modifier.fillMaxWidth().imePadding(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            OutlinedTextField(
                value = textInput,
                onValueChange = { textInput = it },
                placeholder = { Text("Message chiffré de bout en bout...") },
                modifier = Modifier.weight(1f),
                maxLines = 4
            )
            Spacer(modifier = Modifier.width(8.dp))
            IconButton(
                onClick = {
                    if (textInput.isNotBlank() && recipientKeyInput.isNotBlank()) {
                        val id = transportManager.sendMessage(recipientKeyInput.trim(), textInput.trim())
                        if (id == null) {
                            sendError = "Clé publique du destinataire invalide : message non enregistré."
                        } else {
                            sendError = null
                            textInput = ""
                        }
                    }
                },
                modifier = Modifier
                    .clip(RoundedCornerShape(12.dp))
                    .background(if (textInput.isNotBlank()) MeshoraPrimary else MeshoraSurfaceVariant)
            ) {
                Icon(
                    imageVector = Icons.Default.Send,
                    contentDescription = "Envoyer",
                    tint = MeshoraTextPrimary
                )
            }
        }
    }
}

@Composable
fun MessageBubble(message: Message, isFromMe: Boolean) {
    val alignment = if (isFromMe) Alignment.End else Alignment.Start
    val bgColor = if (isFromMe) MeshoraPrimary.copy(alpha = 0.25f) else MeshoraSurface

    Column(
        modifier = Modifier.fillMaxWidth(),
        horizontalAlignment = alignment
    ) {
        Surface(
            color = bgColor,
            shape = RoundedCornerShape(12.dp),
            modifier = Modifier.widthIn(max = 280.dp)
        ) {
            Column(modifier = Modifier.padding(10.dp)) {
                Text(
                    text = if (isFromMe) "Moi -> ${message.recipientFingerprint}" else "De : ${message.senderFingerprint}",
                    fontSize = 11.sp,
                    fontFamily = FontFamily.Monospace,
                    color = MeshoraAccent
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = message.content,
                    style = MaterialTheme.typography.bodyLarge,
                    color = MeshoraTextPrimary
                )
                Spacer(modifier = Modifier.height(6.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.End,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    val timeFormat = SimpleDateFormat("HH:mm", Locale.getDefault())
                    Text(
                        text = timeFormat.format(Date(message.timestamp)),
                        fontSize = 10.sp,
                        color = MeshoraTextSecondary
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    // Règle de Vérité : Statuts stricts
                    when (message.status) {
                        MessageStatus.QUEUED -> {
                            Icon(
                                imageVector = Icons.Default.HourglassTop,
                                contentDescription = "En attente d'envoi",
                                tint = MeshoraWarning,
                                modifier = Modifier.size(14.dp)
                            )
                        }
                        MessageStatus.SENT -> {
                            Icon(
                                imageVector = Icons.Default.Done,
                                contentDescription = "Émis sur le réseau (non accusé)",
                                tint = MeshoraTextSecondary,
                                modifier = Modifier.size(14.dp)
                            )
                        }
                        MessageStatus.DELIVERED -> {
                            Icon(
                                imageVector = Icons.Default.DoneAll,
                                contentDescription = "Délivré et acquitté par signature",
                                tint = MeshoraSuccess,
                                modifier = Modifier.size(14.dp)
                            )
                        }
                        MessageStatus.FAILED -> {
                            Text(text = "✕", color = MeshoraError, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }
    }
}
