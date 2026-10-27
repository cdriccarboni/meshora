package org.meshora.app.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable

private val DarkColorScheme = darkColorScheme(
    primary = MeshoraPrimary,
    onPrimary = MeshoraTextPrimary,
    secondary = MeshoraSecondary,
    onSecondary = MeshoraTextPrimary,
    background = MeshoraBackground,
    onBackground = MeshoraTextPrimary,
    surface = MeshoraSurface,
    onSurface = MeshoraTextPrimary,
    surfaceVariant = MeshoraSurfaceVariant,
    onSurfaceVariant = MeshoraTextSecondary
)

@Composable
fun MeshoraTheme(
    darkTheme: Boolean = true, // MESHORA privilégie un thème sombre orienté résilience et économie d'énergie
    content: @Composable () -> Unit
) {
    MaterialTheme(
        colorScheme = DarkColorScheme,
        typography = Typography,
        content = content
    )
}
