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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import org.meshora.app.MeshoraApp
import org.meshora.app.transport.ConnectionState
import org.meshora.app.ui.theme.*

@Composable
fun TransportsScreen() {
    val transportManager = MeshoraApp.instance.transportManager
    val bleManager = MeshoraApp.instance.bleManager

    val connectionState by transportManager.webSocketTransport.connectionState.collectAsState()
    val isScanning by bleManager.isScanning.collectAsState()
    val isAdvertising by bleManager.isAdvertising.collectAsState()
    val bleStatus by bleManager.statusMessage.collectAsState()

    var relayUrlInput by remember { mutableStateOf("ws://10.0.2.2:8999") }
    var roomInput by remember { mutableStateOf("general") }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MeshoraBackground)
            .padding(16.dp)
            .verticalScroll(rememberScrollState())
    ) {
        Text(
            text = "Transports Réseau & Maillage",
            style = MaterialTheme.typography.titleLarge
        )
        Text(
            text = "Gestion des canaux réels d'acheminement et architecture physique.",
            style = MaterialTheme.typography.bodySmall,
            color = MeshoraTextSecondary
        )

        Spacer(modifier = Modifier.height(16.dp))

        // --- SECTION WEBSOCKET RELAY ---
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = MeshoraSurface)
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "Relais WebSocket (Internet / LAN)",
                        fontWeight = FontWeight.Bold,
                        style = MaterialTheme.typography.bodyLarge
                    )

                    val (badgeText, badgeColor) = when (connectionState) {
                        ConnectionState.CONNECTED -> "CONNECTÉ" to MeshoraSuccess
                        ConnectionState.CONNECTING -> "CONNEXION..." to MeshoraWarning
                        ConnectionState.DISCONNECTED -> "DÉCONNECTÉ" to MeshoraTextSecondary
                    }

                    Surface(
                        color = badgeColor.copy(alpha = 0.2f),
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        Text(
                            text = badgeText,
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                            color = badgeColor,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }

                Spacer(modifier = Modifier.height(12.dp))

                OutlinedTextField(
                    value = relayUrlInput,
                    onValueChange = { relayUrlInput = it },
                    label = { Text("Adresse du relais WebSocket") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )

                Spacer(modifier = Modifier.height(8.dp))

                OutlinedTextField(
                    value = roomInput,
                    onValueChange = { roomInput = it },
                    label = { Text("Nom du salon (room)") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )

                Spacer(modifier = Modifier.height(12.dp))

                Row(modifier = Modifier.fillMaxWidth()) {
                    if (connectionState == ConnectionState.CONNECTED) {
                        Button(
                            onClick = { transportManager.disconnectWebSocket() },
                            colors = ButtonDefaults.buttonColors(containerColor = MeshoraError),
                            modifier = Modifier.weight(1f)
                        ) {
                            Text("Déconnecter")
                        }
                    } else {
                        Button(
                            onClick = {
                                transportManager.connectWebSocket(relayUrlInput.trim(), roomInput.trim())
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = MeshoraPrimary),
                            modifier = Modifier.weight(1f)
                        ) {
                            Text("Connecter au relais")
                        }
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        // --- SECTION BLUETOOTH LE (0xFE60) ---
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = MeshoraSurface)
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text(
                    text = "Bluetooth LE Natif (Spécification 0xFE60)",
                    fontWeight = FontWeight.Bold,
                    style = MaterialTheme.typography.bodyLarge
                )

                Spacer(modifier = Modifier.height(6.dp))

                Surface(
                    color = MeshoraAccent.copy(alpha = 0.15f),
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Text(
                        text = "Règle de Vérité : L'architecture GATT native est intégrée dans l'APK. La déclaration d'un maillage opérationnel sans relais nécessite un banc d'essai physique avec validation de portée.",
                        modifier = Modifier.padding(10.dp),
                        style = MaterialTheme.typography.bodySmall,
                        color = MeshoraAccent
                    )
                }

                Spacer(modifier = Modifier.height(12.dp))

                Text(
                    text = "Statut : $bleStatus",
                    style = MaterialTheme.typography.labelSmall
                )

                Spacer(modifier = Modifier.height(12.dp))

                Row(modifier = Modifier.fillMaxWidth()) {
                    OutlinedButton(
                        onClick = {
                            if (isScanning) bleManager.stopScan() else bleManager.startScan()
                        },
                        modifier = Modifier.weight(1f)
                    ) {
                        Text(if (isScanning) "Arrêter Scan" else "Lancer Scan BLE")
                    }

                    Spacer(modifier = Modifier.width(8.dp))

                    OutlinedButton(
                        onClick = {
                            if (isAdvertising) bleManager.stopAdvertising() else bleManager.startAdvertising()
                        },
                        modifier = Modifier.weight(1f)
                    ) {
                        Text(if (isAdvertising) "Arrêter Annonce" else "Annoncer Périphérique")
                    }
                }
            }
        }
    }
}
