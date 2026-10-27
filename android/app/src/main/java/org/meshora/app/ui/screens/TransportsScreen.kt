package org.meshora.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay
import org.meshora.app.BuildConfig
import org.meshora.app.MeshoraApp
import org.meshora.app.R
import org.meshora.app.invite.Invitation
import org.meshora.app.transport.ConnectionState
import org.meshora.app.transport.RelayProblem
import org.meshora.app.ui.theme.*

@Composable
fun TransportsScreen() {
    val app = MeshoraApp.instance
    val tm = app.transportManager
    val ws = tm.webSocketTransport
    val bleMesh = app.bleMesh

    val state by ws.connectionState.collectAsState()
    val problem by ws.problem.collectAsState()
    val nextRetryAt by ws.nextRetryAt.collectAsState()
    val settings by app.settings.values.collectAsState()
    val bleRunning by bleMesh.running.collectAsState()
    val bleLinks by bleMesh.linkCount.collectAsState()
    val bleStatus by bleMesh.status.collectAsState()
    val torState by app.tor.state.collectAsState()
    val permissionLauncher = androidx.activity.compose.rememberLauncherForActivityResult(
        androidx.activity.result.contract.ActivityResultContracts.RequestMultiplePermissions()
    ) { bleMesh.start() }

    var now by remember { mutableLongStateOf(System.currentTimeMillis()) }
    LaunchedEffect(nextRetryAt) { while (nextRetryAt > 0) { now = System.currentTimeMillis(); delay(1000) } }

    var nameInput by remember(settings.alias) { mutableStateOf(settings.alias) }
    var showAdvanced by remember { mutableStateOf(false) }
    var relayInput by remember(settings.relayUrl) { mutableStateOf(settings.relayUrl) }
    var relayError by remember { mutableStateOf(false) }
    var confirmNewGroup by remember { mutableStateOf(false) }

    Column(Modifier.fillMaxSize().background(MeshoraBackground).padding(16.dp).verticalScroll(rememberScrollState())) {
        Text(stringResource(R.string.network_title), style = MaterialTheme.typography.titleLarge)
        Spacer(Modifier.height(12.dp))

        // --- Relais Internet ---
        Card(colors = CardDefaults.cardColors(containerColor = MeshoraSurface), modifier = Modifier.fillMaxWidth()) {
            Column(Modifier.padding(16.dp)) {
                Text(stringResource(R.string.relay_card), fontWeight = FontWeight.Bold)
                Spacer(Modifier.height(8.dp))
                val (label, color) = when (state) {
                    ConnectionState.AUTHENTICATED -> stringResource(R.string.st_authenticated) to MeshoraSuccess
                    ConnectionState.CONNECTED -> stringResource(R.string.st_auth) to MeshoraWarning
                    ConnectionState.CONNECTING -> stringResource(R.string.st_connecting) to MeshoraWarning
                    ConnectionState.DISCONNECTED -> stringResource(R.string.st_disconnected) to MeshoraTextSecondary
                }
                Surface(color = color.copy(alpha = 0.18f), shape = RoundedCornerShape(8.dp)) {
                    Text(label, Modifier.padding(horizontal = 10.dp, vertical = 6.dp), color = color, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                }
                if (state != ConnectionState.AUTHENTICATED && problem != RelayProblem.NONE) {
                    Spacer(Modifier.height(8.dp))
                    Text(
                        stringResource(when (problem) {
                            RelayProblem.NO_NETWORK -> R.string.problem_no_network
                            RelayProblem.REJECTED -> R.string.problem_rejected
                            RelayProblem.RATE_LIMITED -> R.string.problem_rate
                            RelayProblem.ROOM_FULL -> R.string.problem_full
                            RelayProblem.BAD_ADDRESS -> R.string.problem_bad_address
                            RelayProblem.WAITING_FOR_TOR -> R.string.problem_waiting_tor
                            RelayProblem.TOR_UNREACHABLE -> R.string.problem_tor_unreachable
                            else -> R.string.problem_unreachable
                        }),
                        style = MaterialTheme.typography.bodySmall
                    )
                    if (nextRetryAt > now) {
                        Text(stringResource(R.string.retry_in, ((nextRetryAt - now) / 1000).toInt() + 1), style = MaterialTheme.typography.bodySmall, color = MeshoraTextSecondary)
                    }
                }
                Spacer(Modifier.height(10.dp))
                Text(stringResource(R.string.group_label, settings.room), fontFamily = FontFamily.Monospace, fontSize = 12.sp)
                Text(
                    stringResource(R.string.relay_label, if (settings.usesDefaultRelay) stringResource(R.string.relay_default) else settings.relayUrl),
                    fontSize = 12.sp, color = MeshoraTextSecondary
                )
                Spacer(Modifier.height(12.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    if (ws.isWanted()) {
                        if (state == ConnectionState.DISCONNECTED) {
                            Button(onClick = { ws.reconnectNow() }, colors = ButtonDefaults.buttonColors(containerColor = MeshoraPrimary)) { Text(stringResource(R.string.retry_now)) }
                        }
                        OutlinedButton(onClick = { app.settings.setAutoConnect(false); tm.disconnectWebSocket() }) { Text(stringResource(R.string.disconnect)) }
                    } else {
                        Button(onClick = { app.settings.setAutoConnect(true); app.connectRelay() }, colors = ButtonDefaults.buttonColors(containerColor = MeshoraPrimary)) { Text(stringResource(R.string.connect)) }
                    }
                }
                Spacer(Modifier.height(10.dp))
                Text(stringResource(R.string.relay_privacy), style = MaterialTheme.typography.bodySmall, color = MeshoraTextSecondary)
                if (BuildConfig.RELAY_CHANNEL != "production") {
                    Spacer(Modifier.height(6.dp))
                    Text(stringResource(R.string.preprod_notice), style = MaterialTheme.typography.bodySmall, color = MeshoraWarning)
                }
            }
        }

        // --- Nom affiché ---
        Spacer(Modifier.height(16.dp))
        Card(colors = CardDefaults.cardColors(containerColor = MeshoraSurface), modifier = Modifier.fillMaxWidth()) {
            Column(Modifier.padding(16.dp)) {
                OutlinedTextField(
                    value = nameInput, onValueChange = { nameInput = it.take(40) },
                    label = { Text(stringResource(R.string.name_label)) },
                    supportingText = { Text(stringResource(R.string.name_hint)) },
                    singleLine = true, modifier = Modifier.fillMaxWidth()
                )
                Button(
                    onClick = { app.settings.setAlias(nameInput); if (ws.isWanted()) app.connectRelay() },
                    enabled = nameInput.trim() != settings.alias,
                    colors = ButtonDefaults.buttonColors(containerColor = MeshoraPrimary)
                ) { Text(stringResource(R.string.save)) }
            }
        }

        // --- Réglages avancés ---
        Spacer(Modifier.height(16.dp))
        TextButton(onClick = { showAdvanced = !showAdvanced }) { Text((if (showAdvanced) "▾ " else "▸ ") + stringResource(R.string.advanced)) }
        if (showAdvanced) {
            Card(colors = CardDefaults.cardColors(containerColor = MeshoraSurface), modifier = Modifier.fillMaxWidth()) {
                Column(Modifier.padding(16.dp)) {
                    OutlinedTextField(
                        value = relayInput, onValueChange = { relayInput = it; relayError = false },
                        label = { Text(stringResource(R.string.advanced_relay_label)) }, singleLine = true,
                        isError = relayError, supportingText = { if (relayError) Text(stringResource(R.string.relay_url_invalid)) },
                        modifier = Modifier.fillMaxWidth()
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Button(onClick = {
                            if (!Invitation.isAcceptableRelay(relayInput)) relayError = true
                            else { app.settings.setRelay(relayInput); app.settings.setAutoConnect(true); app.connectRelay() }
                        }, colors = ButtonDefaults.buttonColors(containerColor = MeshoraPrimary)) { Text(stringResource(R.string.apply)) }
                        if (!settings.usesDefaultRelay) {
                            OutlinedButton(onClick = { app.settings.resetRelay(); app.settings.setAutoConnect(true); app.connectRelay() }) { Text(stringResource(R.string.use_default_relay)) }
                        }
                    }
                    Spacer(Modifier.height(16.dp))
                    // --- Tor (expérimental) ---
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1f)) {
                            Text(stringResource(R.string.tor_title), fontWeight = FontWeight.SemiBold)
                            Text(
                                stringResource(when (torState) {
                                    org.meshora.app.transport.TorManager.State.ON -> R.string.tor_on
                                    org.meshora.app.transport.TorManager.State.STARTING -> R.string.tor_starting
                                    org.meshora.app.transport.TorManager.State.ERROR -> R.string.tor_error
                                    else -> R.string.tor_off
                                }),
                                style = MaterialTheme.typography.bodySmall,
                                color = if (torState == org.meshora.app.transport.TorManager.State.ON) MeshoraSuccess else MeshoraTextSecondary
                            )
                        }
                        Switch(checked = settings.torEnabled, onCheckedChange = { on ->
                            app.settings.setTorEnabled(on)
                            app.applyTorSetting()
                            if (app.settings.current.autoConnect) app.connectRelay()
                        })
                    }
                    Text(stringResource(R.string.tor_explain), style = MaterialTheme.typography.bodySmall, color = MeshoraTextSecondary)
                    Spacer(Modifier.height(12.dp))
                    if (confirmNewGroup) {
                        Text(stringResource(R.string.new_group_confirm), style = MaterialTheme.typography.bodySmall, color = MeshoraWarning)
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Button(onClick = { app.settings.newRoom(); confirmNewGroup = false; if (ws.isWanted()) app.connectRelay() }, colors = ButtonDefaults.buttonColors(containerColor = MeshoraError)) { Text(stringResource(R.string.new_group)) }
                            OutlinedButton(onClick = { confirmNewGroup = false }) { Text(stringResource(R.string.cancel)) }
                        }
                    } else {
                        OutlinedButton(onClick = { confirmNewGroup = true }) { Text(stringResource(R.string.new_group)) }
                    }
                }
            }
        }

        // --- Bluetooth (expérimental) ---
        Spacer(Modifier.height(16.dp))
        Card(colors = CardDefaults.cardColors(containerColor = MeshoraSurface), modifier = Modifier.fillMaxWidth()) {
            Column(Modifier.padding(16.dp)) {
                Text(stringResource(R.string.ble_title), fontWeight = FontWeight.Bold)
                Spacer(Modifier.height(6.dp))
                Notice(stringResource(R.string.ble_notice), MeshoraWarning)
                Spacer(Modifier.height(8.dp))
                Text(bleStatus, style = MaterialTheme.typography.labelSmall)
                Text(stringResource(R.string.ble_links, bleLinks), style = MaterialTheme.typography.labelSmall)
                Spacer(Modifier.height(10.dp))
                Button(
                    onClick = {
                        if (bleRunning) bleMesh.stop()
                        else if (bleMesh.hasPermissions()) bleMesh.start()
                        else permissionLauncher.launch(bleMesh.requiredPermissions())
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = if (bleRunning) MeshoraError else MeshoraSurfaceVariant),
                    modifier = Modifier.fillMaxWidth()
                ) { Text(stringResource(if (bleRunning) R.string.ble_stop else R.string.ble_start)) }
            }
        }
    }
}
