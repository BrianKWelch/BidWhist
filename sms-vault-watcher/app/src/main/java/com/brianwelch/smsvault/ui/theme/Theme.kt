package com.brianwelch.smsvault.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val DarkColors = darkColorScheme(
    primary = Color(0xFF8AB4F8),
    background = Color(0xFF101114),
    surface = Color(0xFF16181D),
    error = Color(0xFFF2B8B5)
)

private val LightColors = lightColorScheme(
    primary = Color(0xFF1A73E8),
    background = Color(0xFFF7F8FA),
    surface = Color(0xFFFFFFFF),
    error = Color(0xFFB3261E)
)

@Composable
fun VaultTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = if (isSystemInDarkTheme()) DarkColors else LightColors,
        content = content
    )
}
