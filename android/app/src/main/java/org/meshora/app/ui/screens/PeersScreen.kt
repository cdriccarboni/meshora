package org.meshora.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Chat
import androidx.compose.material.icons.filled.Sensors
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import org.meshora.app.MeshoraApp
import org.meshora.app.ui.theme.*

@Composable
fun PeersScreen(
    onChatWithPeer: (String) -> Unit
) {
    val transportManager = MeshoraApp.instance.transportManager
    val peers by transportManager.outboxRepository.peersFlow.collectAsState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MeshoraBackground)
            .padding(16.dp)
    ) {
        Text(
            text = "Voisins Réseau Découverts (${peers.size})",
            style = MaterialTheme.typography.titleLarge
        )
        Text(
            text = "Nœuds réels connectés au même salon ou détectés par transport direct.",
            style = MaterialTheme.typography.bodySmall,
            color = MeshoraTextSecondary
        )

        Spacer(modifier = Modifier.height(16.dp))

        if (peers.isEmpty()) {
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = MeshoraSurface)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Icon(
                        imageVector = Icons.Default.Sensors,
                        contentDescription = "Recherche de voisins",
                        tint = MeshoraTextSecondary,
                        modifier = Modifier.size(48.dp)
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                    Text(
                        text = "Aucun voisin découvert",
                        style = MaterialTheme.typography.bodyLarge,
                        fontWeight = FontWeight.Bold
                    )
                    Spacer(modifier = Modifier.height(6.dp))
                    Text(
                        text = "Connectez un second appareil (Mac ou smartphone) sur le même relais WebSocket ou activez le balayage BLE dans l'onglet Réseau.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MeshoraTextSecondary
                    )
                }
            }
        } else {
            LazyColumn(modifier = Modifier.fillMaxSize()) {
                items(peers, key = { it.publicKeyHex }) { peer ->
                    Card(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 4.dp),
                        colors = CardDefaults.cardColors(containerColor = MeshoraSurface)
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(12.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Box(
                                    modifier = Modifier
                                        .size(10.dp)
                                        .clip(CircleShape)
                                        .background(MeshoraSuccess)
                                )
                                Spacer(modifier = Modifier.width(12.dp))
                                Column {
                                    Text(
                                        text = peer.displayName,
                                        fontWeight = FontWeight.SemiBold,
                                        style = MaterialTheme.typography.bodyLarge
                                    )
                                    Text(
                                        text = peer.fingerprint,
                                        fontSize = 11.sp,
                                        fontFamily = FontFamily.Monospace,
                                        color = MeshoraAccent
                                    )
                                    Text(
                                        text = "Transport : ${peer.transport}",
                                        fontSize = 10.sp,
                                        color = MeshoraTextSecondary
                                    )
                                }
                            }

                            IconButton(
                                onClick = { onChatWithPeer(peer.publicKeyHex) },
                                modifier = Modifier
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(MeshoraPrimary.copy(alpha = 0.2f))
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Chat,
                                    contentDescription = "Discuter",
                                    tint = MeshoraPrimary
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}
