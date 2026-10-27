package org.meshora.app.ui.screens

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.Key
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import org.meshora.app.R
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import org.meshora.app.MeshoraApp
import org.meshora.app.ui.theme.*

@Composable
fun IdentityScreen() {
    val context = LocalContext.current
    val identity = MeshoraApp.instance.transportManager.identity

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MeshoraBackground)
            .padding(16.dp)
            .verticalScroll(rememberScrollState())
    ) {
        Text(
            text = stringResource(R.string.identity_title),
            style = MaterialTheme.typography.titleLarge
        )
        Text(
            text = stringResource(R.string.identity_sub),
            style = MaterialTheme.typography.bodySmall,
            color = MeshoraTextSecondary
        )

        Spacer(modifier = Modifier.height(16.dp))

        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = MeshoraSurface)
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = Icons.Default.Key,
                        contentDescription = null,
                        tint = MeshoraAccent
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = stringResource(R.string.fingerprint_title),
                        fontWeight = FontWeight.Bold,
                        style = MaterialTheme.typography.bodyLarge
                    )
                }

                Spacer(modifier = Modifier.height(8.dp))

                Surface(
                    color = MeshoraBackground,
                    shape = RoundedCornerShape(8.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(
                        text = identity.fingerprint,
                        modifier = Modifier.padding(12.dp),
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Bold,
                        color = MeshoraAccent,
                        fontSize = 14.sp
                    )
                }
                Spacer(modifier = Modifier.height(6.dp))
                Text(stringResource(R.string.fingerprint_help), style = MaterialTheme.typography.bodySmall, color = MeshoraTextSecondary)

                Spacer(modifier = Modifier.height(16.dp))

                Text(
                    text = stringResource(R.string.pubkey_title),
                    fontWeight = FontWeight.SemiBold,
                    style = MaterialTheme.typography.bodyMedium
                )

                Spacer(modifier = Modifier.height(6.dp))

                Surface(
                    color = MeshoraBackground,
                    shape = RoundedCornerShape(8.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(
                        text = identity.publicKeyHex,
                        modifier = Modifier.padding(12.dp),
                        fontFamily = FontFamily.Monospace,
                        fontSize = 10.sp,
                        color = MeshoraTextSecondary,
                        lineHeight = 14.sp
                    )
                }

                Spacer(modifier = Modifier.height(12.dp))

                Button(
                    onClick = {
                        val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                        val clip = ClipData.newPlainText("MESHORA Public Key", identity.publicKeyHex)
                        clipboard.setPrimaryClip(clip)
                        Toast.makeText(context, context.getString(R.string.key_copied), Toast.LENGTH_SHORT).show()
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = MeshoraPrimary),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Icon(Icons.Default.ContentCopy, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(stringResource(R.string.copy_key))
                }
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = MeshoraSurface)
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text(
                    text = stringResource(R.string.security_title),
                    fontWeight = FontWeight.Bold,
                    style = MaterialTheme.typography.bodyLarge
                )
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = stringResource(R.string.security_body),
                    style = MaterialTheme.typography.bodySmall,
                    color = MeshoraTextSecondary
                )
            }
        }
    
        Spacer(modifier = Modifier.height(16.dp))
        Card(modifier = Modifier.fillMaxWidth(), colors = CardDefaults.cardColors(containerColor = MeshoraSurface)) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text(stringResource(R.string.limits_title), fontWeight = FontWeight.Bold, color = MeshoraWarning)
                Spacer(modifier = Modifier.height(8.dp))
                Text(stringResource(R.string.limits_body), style = MaterialTheme.typography.bodySmall, color = MeshoraTextSecondary)
            }
        }
    
        Spacer(modifier = Modifier.height(16.dp))
        var confirmWipe by remember { mutableStateOf(false) }
        Card(modifier = Modifier.fillMaxWidth(), colors = CardDefaults.cardColors(containerColor = MeshoraError.copy(alpha = 0.12f))) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text(stringResource(R.string.wipe_title), fontWeight = FontWeight.Bold, color = MeshoraError)
                Spacer(modifier = Modifier.height(6.dp))
                Text(stringResource(R.string.wipe_body), style = MaterialTheme.typography.bodySmall)
                Spacer(modifier = Modifier.height(10.dp))
                Button(onClick = { confirmWipe = true }, colors = ButtonDefaults.buttonColors(containerColor = MeshoraError), modifier = Modifier.fillMaxWidth()) {
                    Text(stringResource(R.string.wipe_button))
                }
            }
        }
        if (confirmWipe) {
            AlertDialog(
                onDismissRequest = { confirmWipe = false },
                title = { Text(stringResource(R.string.wipe_confirm_title)) },
                text = { Text(stringResource(R.string.wipe_confirm_body)) },
                confirmButton = {
                    TextButton(onClick = { org.meshora.app.storage.PanicWipe.wipe(context) }) {
                        Text(stringResource(R.string.wipe_confirm_button), color = MeshoraError, fontWeight = FontWeight.Bold)
                    }
                },
                dismissButton = { TextButton(onClick = { confirmWipe = false }) { Text(stringResource(R.string.cancel)) } }
            )
        }
    }
}
