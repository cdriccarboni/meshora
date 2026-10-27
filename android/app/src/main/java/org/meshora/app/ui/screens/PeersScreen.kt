package org.meshora.app.ui.screens

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.widget.Toast
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.PersonAdd
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import org.meshora.app.BuildConfig
import org.meshora.app.MeshoraApp
import org.meshora.app.R
import org.meshora.app.invite.Invitation
import org.meshora.app.ui.ConversationEntry
import org.meshora.app.ui.buildConversations
import org.meshora.app.ui.qrBitmap
import org.meshora.app.ui.theme.*

/** Mon invitation : groupe actuel, ma clé publique, mon nom, et le relais s'il n'est pas celui par défaut. */
fun myInvitation(): Invitation {
    val app = MeshoraApp.instance
    val s = app.settings.current
    return Invitation(s.room, app.transportManager.identity.publicKeyHex, app.displayAlias(), if (s.usesDefaultRelay) null else s.relayUrl)
}

@Composable
fun PeersScreen(onChat: (String) -> Unit, onInvitation: (Invitation) -> Unit) {
    val app = MeshoraApp.instance
    val context = LocalContext.current
    val tm = app.transportManager
    val peers by tm.outboxRepository.peersFlow.collectAsState()
    val contacts by app.contacts.contacts.collectAsState()
    val settings by app.settings.values.collectAsState()
    val people = remember(contacts, peers) { buildConversations(contacts, peers, emptyList(), tm.identity.fingerprint) }

    var showInvite by remember { mutableStateOf(false) }
    var pasted by remember { mutableStateOf("") }
    var pasteError by remember { mutableStateOf(false) }
    val link = remember(settings) { myInvitation().toLink(BuildConfig.INVITE_BASE_URL) }

    Column(Modifier.fillMaxSize().background(MeshoraBackground).padding(16.dp).verticalScroll(rememberScrollState())) {
        Text(stringResource(R.string.contacts_title), style = MaterialTheme.typography.titleLarge)
        Spacer(Modifier.height(12.dp))

        Button(onClick = { showInvite = !showInvite }, colors = ButtonDefaults.buttonColors(containerColor = MeshoraPrimary), modifier = Modifier.fillMaxWidth().height(52.dp)) {
            Icon(Icons.Default.PersonAdd, contentDescription = null)
            Spacer(Modifier.width(8.dp))
            Text(stringResource(R.string.invite_button), fontWeight = FontWeight.Bold)
        }

        if (showInvite) {
            Spacer(Modifier.height(12.dp))
            Card(colors = CardDefaults.cardColors(containerColor = MeshoraSurface), modifier = Modifier.fillMaxWidth()) {
                Column(Modifier.padding(16.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(stringResource(R.string.invite_title), fontWeight = FontWeight.Bold)
                    Spacer(Modifier.height(6.dp))
                    Text(stringResource(R.string.invite_body), style = MaterialTheme.typography.bodySmall, color = MeshoraTextSecondary)
                    Spacer(Modifier.height(12.dp))
                    val qr = remember(link) { qrBitmap(link) }
                    Image(qr, contentDescription = stringResource(R.string.invite_title), modifier = Modifier.size(240.dp).background(androidx.compose.ui.graphics.Color.White, RoundedCornerShape(8.dp)).padding(6.dp))
                    Spacer(Modifier.height(8.dp))
                    Text(stringResource(R.string.fingerprint_label, tm.identity.fingerprint.take(19)), fontFamily = FontFamily.Monospace, fontSize = 11.sp, color = MeshoraAccent)
                    Spacer(Modifier.height(12.dp))
                    val shareText = stringResource(R.string.invite_share_text, link)
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Button(onClick = {
                            context.startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).apply {
                                type = "text/plain"; putExtra(Intent.EXTRA_TEXT, shareText)
                            }, null))
                        }, modifier = Modifier.weight(1f), colors = ButtonDefaults.buttonColors(containerColor = MeshoraPrimary)) {
                            Icon(Icons.Default.Share, contentDescription = null, modifier = Modifier.size(16.dp)); Spacer(Modifier.width(6.dp))
                            Text(stringResource(R.string.invite_share))
                        }
                        val copiedMsg = stringResource(R.string.copied)
                        OutlinedButton(onClick = {
                            (context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager).setPrimaryClip(ClipData.newPlainText("MESHORA", link))
                            Toast.makeText(context, copiedMsg, Toast.LENGTH_SHORT).show()
                        }, modifier = Modifier.weight(1f)) {
                            Icon(Icons.Default.ContentCopy, contentDescription = null, modifier = Modifier.size(16.dp)); Spacer(Modifier.width(6.dp))
                            Text(stringResource(R.string.invite_copy))
                        }
                    }
                }
            }
        }

        Spacer(Modifier.height(16.dp))
        Card(colors = CardDefaults.cardColors(containerColor = MeshoraSurface), modifier = Modifier.fillMaxWidth()) {
            Column(Modifier.padding(16.dp)) {
                Text(stringResource(R.string.invite_paste_title), fontWeight = FontWeight.SemiBold)
                Spacer(Modifier.height(8.dp))
                OutlinedTextField(
                    value = pasted, onValueChange = { pasted = it; pasteError = false },
                    label = { Text(stringResource(R.string.invite_paste_hint)) }, singleLine = true, modifier = Modifier.fillMaxWidth(),
                    isError = pasteError,
                    supportingText = { if (pasteError) Text(stringResource(R.string.invite_invalid)) }
                )
                Spacer(Modifier.height(8.dp))
                OutlinedButton(onClick = {
                    val inv = Invitation.parse(pasted)
                    if (inv == null) pasteError = true else { pasted = ""; onInvitation(inv) }
                }, enabled = pasted.isNotBlank(), modifier = Modifier.fillMaxWidth()) {
                    Text(stringResource(R.string.invite_paste_button))
                }
            }
        }

        val online = people.filter { it.online }
        val saved = people.filter { it.isContact }
        if (online.isNotEmpty()) {
            SectionTitle(stringResource(R.string.online_section) + " (${online.size})")
            online.forEach { PersonRow(it, onChat) }
        }
        SectionTitle(stringResource(R.string.contacts_section) + " (${saved.size})")
        if (saved.isEmpty()) Text(stringResource(R.string.contacts_empty), style = MaterialTheme.typography.bodySmall, color = MeshoraTextSecondary)
        saved.forEach { PersonRow(it, onChat) }
    }
}

@Composable
private fun SectionTitle(t: String) {
    Spacer(Modifier.height(20.dp))
    Text(t, style = MaterialTheme.typography.titleSmall, color = MeshoraTextSecondary)
    Spacer(Modifier.height(6.dp))
}

@Composable
private fun PersonRow(p: ConversationEntry, onChat: (String) -> Unit) {
    val contacts = MeshoraApp.instance.contacts
    Card(colors = CardDefaults.cardColors(containerColor = MeshoraSurface), modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
        Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
            PresenceDot(p.online)
            Spacer(Modifier.width(10.dp))
            Column(Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(p.name, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    if (p.verified) VerifiedMark()
                }
                Text(p.fingerprint.take(19), fontFamily = FontFamily.Monospace, fontSize = 11.sp, color = MeshoraAccent)
                p.transport?.let { Text(stringResource(R.string.via, it), fontSize = 10.sp, color = MeshoraTextSecondary) }
            }
            if (p.isContact) {
                TextButton(onClick = { contacts.remove(p.publicKeyHex) }) { Text(stringResource(R.string.remove_contact), fontSize = 12.sp) }
            } else {
                TextButton(onClick = { contacts.upsert(p.publicKeyHex, p.name, verified = false) }) { Text(stringResource(R.string.add_contact), fontSize = 12.sp) }
            }
            Button(onClick = { onChat(p.publicKeyHex) }, colors = ButtonDefaults.buttonColors(containerColor = MeshoraPrimary), contentPadding = PaddingValues(horizontal = 12.dp)) {
                Text(stringResource(R.string.write), fontSize = 12.sp)
            }
        }
    }
}
