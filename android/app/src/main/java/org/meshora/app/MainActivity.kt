package org.meshora.app

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Chat
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import org.meshora.app.invite.Invitation
import org.meshora.app.ui.screens.*
import org.meshora.app.ui.theme.MeshoraBackground
import org.meshora.app.ui.theme.MeshoraSurface
import org.meshora.app.ui.theme.MeshoraTheme
import org.meshora.app.ui.theme.MeshoraWarning

class MainActivity : ComponentActivity() {

    private val requestPermissionLauncher = registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { }

    /** Invitation reçue par lien (QR code, message, navigateur) en attente de confirmation. */
    private val pendingInvitation = mutableStateOf<Invitation?>(null)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        requestNotificationPermission()
        handleIntent(intent)
        setContent {
            MeshoraTheme {
                MainAppScaffold(pendingInvitation)
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleIntent(intent)
    }

    override fun onResume() {
        super.onResume()
        // Retour au premier plan : reconnexion immédiate si une connexion est voulue.
        MeshoraApp.instance.transportManager.webSocketTransport.reconnectNow()
    }

    private fun handleIntent(intent: Intent?) {
        val data = intent?.dataString ?: return
        val inv = Invitation.parse(data)
        if (inv == null) {
            Toast.makeText(this, getString(R.string.invite_invalid), Toast.LENGTH_LONG).show()
            return
        }
        pendingInvitation.value = inv
    }

    /**
     * V0.3 : seules les notifications sont demandées au démarrage. Les autorisations Bluetooth sont demandées
     * quand l'utilisateur active le Bluetooth (expérimental), pas avant.
     */
    private fun requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) {
            requestPermissionLauncher.launch(arrayOf(Manifest.permission.POST_NOTIFICATIONS))
        }
    }
}

enum class NavigationTab { CHATS, CONTACTS, NETWORK, IDENTITY, EMERGENCY }

/** Applique une invitation acceptée : contact vérifié, groupe (et relais) de l'invitant, reconnexion. */
fun acceptInvitation(inv: Invitation) {
    val app = MeshoraApp.instance
    app.contacts.upsert(inv.publicKeyHex, inv.alias, verified = true)
    val s = app.settings.current
    var reconnect = false
    if (inv.room != s.room) { app.settings.setRoom(inv.room); reconnect = true }
    val wantedRelay = inv.relayUrl ?: org.meshora.app.storage.Settings.DEFAULT_RELAY_URL
    if (wantedRelay != s.relayUrl) { app.settings.setRelay(wantedRelay); reconnect = true }
    if (reconnect || !app.transportManager.webSocketTransport.isWanted()) {
        app.settings.setAutoConnect(true)
        app.connectRelay()
    }
}

@Composable
fun MainAppScaffold(pendingInvitation: MutableState<Invitation?> = mutableStateOf(null)) {
    var selectedTab by remember { mutableStateOf(NavigationTab.CHATS) }
    var selectedChat by remember { mutableStateOf<String?>(null) }
    val app = MeshoraApp.instance
    val context = androidx.compose.ui.platform.LocalContext.current

    pendingInvitation.value?.let { inv ->
        val me = app.transportManager.identity.publicKeyHex
        val name = inv.alias.ifBlank { stringResource(R.string.someone) }
        if (inv.publicKeyHex == me) {
            AlertDialog(
                onDismissRequest = { pendingInvitation.value = null },
                confirmButton = { TextButton(onClick = { pendingInvitation.value = null }) { Text("OK") } },
                text = { Text(stringResource(R.string.join_self)) }
            )
        } else {
            val sameRoom = inv.room == app.settings.current.room && (inv.relayUrl ?: org.meshora.app.storage.Settings.DEFAULT_RELAY_URL) == app.settings.current.relayUrl
            val doneMsg = stringResource(R.string.join_done, name)
            AlertDialog(
                onDismissRequest = { pendingInvitation.value = null },
                title = { Text(stringResource(R.string.join_title, name)) },
                text = {
                    Column {
                        Text(if (sameRoom) stringResource(R.string.join_body_same, name) else stringResource(R.string.join_body_switch))
                        Spacer(Modifier.height(8.dp))
                        Text(
                            stringResource(R.string.fingerprint_label, org.meshora.app.crypto.CryptoEngine.computeFingerprint(inv.publicKeyHex).take(19)),
                            fontFamily = FontFamily.Monospace, fontSize = 12.sp
                        )
                        inv.relayUrl?.let {
                            Spacer(Modifier.height(8.dp))
                            Text(stringResource(R.string.join_relay_warning, it), color = MeshoraWarning)
                        }
                    }
                },
                confirmButton = {
                    TextButton(onClick = {
                        acceptInvitation(inv)
                        pendingInvitation.value = null
                        selectedTab = NavigationTab.CHATS
                        selectedChat = inv.publicKeyHex
                        Toast.makeText(context, doneMsg, Toast.LENGTH_LONG).show()
                    }) { Text(stringResource(if (sameRoom) R.string.join_add else R.string.join_accept)) }
                },
                dismissButton = { TextButton(onClick = { pendingInvitation.value = null }) { Text(stringResource(R.string.cancel)) } }
            )
        }
    }

    Scaffold(
        bottomBar = {
            NavigationBar(containerColor = MeshoraSurface) {
                @Composable
                fun item(tab: NavigationTab, icon: androidx.compose.ui.graphics.vector.ImageVector, label: Int) {
                    val text = stringResource(label)
                    NavigationBarItem(
                        selected = selectedTab == tab,
                        onClick = { selectedTab = tab; if (tab != NavigationTab.CHATS) selectedChat = null },
                        icon = { Icon(icon, contentDescription = null) },
                        label = { Text(text) }
                    )
                }
                item(NavigationTab.CHATS, Icons.AutoMirrored.Filled.Chat, R.string.tab_chats)
                item(NavigationTab.CONTACTS, Icons.Default.Group, R.string.tab_contacts)
                item(NavigationTab.NETWORK, Icons.Default.Sensors, R.string.tab_network)
                item(NavigationTab.IDENTITY, Icons.Default.Key, R.string.tab_identity)
                item(NavigationTab.EMERGENCY, Icons.Default.Call, R.string.tab_emergency)
            }
        }
    ) { innerPadding ->
        Box(Modifier.fillMaxSize().padding(innerPadding).background(MeshoraBackground)) {
            when (selectedTab) {
                NavigationTab.CHATS -> MessagesScreen(selectedKey = selectedChat, onSelect = { selectedChat = it })
                NavigationTab.CONTACTS -> PeersScreen(
                    onChat = { key -> selectedChat = key; selectedTab = NavigationTab.CHATS },
                    onInvitation = { pendingInvitation.value = it }
                )
                NavigationTab.NETWORK -> TransportsScreen()
                NavigationTab.IDENTITY -> IdentityScreen()
                NavigationTab.EMERGENCY -> EmergencyHelpScreen()
            }
        }
    }
}
