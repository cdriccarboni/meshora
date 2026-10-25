package org.meshora.app.ui.screens

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Call
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import org.meshora.app.ui.theme.*

@Composable
fun EmergencyHelpScreen() {
    val context = LocalContext.current

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MeshoraBackground)
            .padding(16.dp)
            .verticalScroll(rememberScrollState())
    ) {
        Text(
            text = "Assistance & Secours Officiels",
            style = MaterialTheme.typography.titleLarge
        )
        Text(
            text = "Accès direct aux services de secours officiels d'urgence.",
            style = MaterialTheme.typography.bodySmall,
            color = MeshoraTextSecondary
        )

        Spacer(modifier = Modifier.height(16.dp))

        // Avertissement de sécurité absolu
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = MeshoraError.copy(alpha = 0.15f))
        ) {
            Row(
                modifier = Modifier.padding(16.dp),
                verticalAlignment = Alignment.Top
            ) {
                Icon(
                    imageVector = Icons.Default.Warning,
                    contentDescription = "Avertissement Vital",
                    tint = MeshoraError,
                    modifier = Modifier.size(28.dp)
                )
                Spacer(modifier = Modifier.width(12.dp))
                Column {
                    Text(
                        text = "AVERTISSEMENT VITAL",
                        color = MeshoraError,
                        fontWeight = FontWeight.Bold,
                        style = MaterialTheme.typography.bodyMedium
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = "MESHORA est une application d'entraide locale décentralisée. En cas de détresse ou d'urgence médicale vitale, n'attendez pas un relais maillé : contactez immédiatement les services d'urgence officiels par téléphone cellulaire ou satellite.",
                        color = MeshoraTextPrimary,
                        style = MaterialTheme.typography.bodySmall
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(20.dp))

        Button(
            onClick = {
                val intent = Intent(Intent.ACTION_DIAL, Uri.parse("tel:112"))
                context.startActivity(intent)
            },
            colors = ButtonDefaults.buttonColors(containerColor = MeshoraError),
            modifier = Modifier
                .fillMaxWidth()
                .height(56.dp),
            shape = RoundedCornerShape(12.dp)
        ) {
            Icon(Icons.Default.Call, contentDescription = "112")
            Spacer(modifier = Modifier.width(10.dp))
            Text("Appeler le 112 (Urgences Européennes)", fontSize = 16.sp, fontWeight = FontWeight.Bold)
        }

        Spacer(modifier = Modifier.height(12.dp))

        OutlinedButton(
            onClick = {
                val intent = Intent(Intent.ACTION_DIAL, Uri.parse("tel:15"))
                context.startActivity(intent)
            },
            modifier = Modifier
                .fillMaxWidth()
                .height(50.dp),
            shape = RoundedCornerShape(12.dp)
        ) {
            Icon(Icons.Default.Call, contentDescription = "15")
            Spacer(modifier = Modifier.width(10.dp))
            Text("Appeler le 15 (SAMU)", fontSize = 15.sp)
        }
    }
}
