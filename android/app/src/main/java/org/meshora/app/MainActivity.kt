package org.meshora.app

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.core.content.ContextCompat
import org.meshora.app.ui.screens.*
import org.meshora.app.ui.theme.MeshoraBackground
import org.meshora.app.ui.theme.MeshoraSurface
import org.meshora.app.ui.theme.MeshoraTheme

class MainActivity : ComponentActivity() {

    private val requestPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { _ ->
        // Les autorisations Bluetooth et notifications sont demandées de façon non-bloquante
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        checkAndRequestPermissions()

        setContent {
            MeshoraTheme {
                MainAppScaffold()
            }
        }
    }

    private fun checkAndRequestPermissions() {
        val permissions = mutableListOf<String>()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.BLUETOOTH_SCAN) != PackageManager.PERMISSION_GRANTED) {
                permissions.add(Manifest.permission.BLUETOOTH_SCAN)
            }
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.BLUETOOTH_ADVERTISE) != PackageManager.PERMISSION_GRANTED) {
                permissions.add(Manifest.permission.BLUETOOTH_ADVERTISE)
            }
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.BLUETOOTH_CONNECT) != PackageManager.PERMISSION_GRANTED) {
                permissions.add(Manifest.permission.BLUETOOTH_CONNECT)
            }
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                permissions.add(Manifest.permission.POST_NOTIFICATIONS)
            }
        }

        if (permissions.isNotEmpty()) {
            requestPermissionLauncher.launch(permissions.toTypedArray())
        }
    }
}

enum class NavigationTab {
    MESSAGES,
    PEERS,
    TRANSPORTS,
    IDENTITY,
    EMERGENCY
}

@Composable
fun MainAppScaffold() {
    var selectedTab by remember { mutableStateOf(NavigationTab.MESSAGES) }

    Scaffold(
        bottomBar = {
            NavigationBar(
                containerColor = MeshoraSurface
            ) {
                NavigationBarItem(
                    selected = selectedTab == NavigationTab.MESSAGES,
                    onClick = { selectedTab = NavigationTab.MESSAGES },
                    icon = { Icon(Icons.Default.Chat, contentDescription = "Messages") },
                    label = { Text("Messages") }
                )
                NavigationBarItem(
                    selected = selectedTab == NavigationTab.PEERS,
                    onClick = { selectedTab = NavigationTab.PEERS },
                    icon = { Icon(Icons.Default.Group, contentDescription = "Voisins") },
                    label = { Text("Voisins") }
                )
                NavigationBarItem(
                    selected = selectedTab == NavigationTab.TRANSPORTS,
                    onClick = { selectedTab = NavigationTab.TRANSPORTS },
                    icon = { Icon(Icons.Default.Sensors, contentDescription = "Réseau") },
                    label = { Text("Réseau") }
                )
                NavigationBarItem(
                    selected = selectedTab == NavigationTab.IDENTITY,
                    onClick = { selectedTab = NavigationTab.IDENTITY },
                    icon = { Icon(Icons.Default.Key, contentDescription = "Identité") },
                    label = { Text("Identité") }
                )
                NavigationBarItem(
                    selected = selectedTab == NavigationTab.EMERGENCY,
                    onClick = { selectedTab = NavigationTab.EMERGENCY },
                    icon = { Icon(Icons.Default.Call, contentDescription = "Secours 112") },
                    label = { Text("112") }
                )
            }
        }
    ) { innerPadding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .background(MeshoraBackground)
        ) {
            when (selectedTab) {
                NavigationTab.MESSAGES -> MessagesScreen(
                    onSelectPeer = { _ -> }
                )
                NavigationTab.PEERS -> PeersScreen(
                    onChatWithPeer = { _ ->
                        selectedTab = NavigationTab.MESSAGES
                    }
                )
                NavigationTab.TRANSPORTS -> TransportsScreen()
                NavigationTab.IDENTITY -> IdentityScreen()
                NavigationTab.EMERGENCY -> EmergencyHelpScreen()
            }
        }
    }
}
