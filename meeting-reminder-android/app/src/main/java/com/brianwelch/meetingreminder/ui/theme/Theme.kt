package com.brianwelch.meetingreminder.ui.theme

import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext

private val Brand = Color(0xFF1F4E8C)

private val Light = lightColorScheme(
    primary = Brand,
    secondary = Color(0xFF4A6582),
    background = Color(0xFFFAFAFC),
    surface = Color(0xFFFAFAFC),
)

private val Dark = darkColorScheme(
    primary = Color(0xFFA7C8FF),
    secondary = Color(0xFFB4C8E6),
    background = Color(0xFF121316),
    surface = Color(0xFF121316),
)

/** Success green used for the "Reminder set" confirmation. */
val SuccessGreen = Color(0xFF2E7D32)

@Composable
fun MeetingReminderTheme(content: @Composable () -> Unit) {
    val dark = isSystemInDarkTheme()
    val context = LocalContext.current
    val scheme = when {
        Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ->
            if (dark) dynamicDarkColorScheme(context) else dynamicLightColorScheme(context)
        dark -> Dark
        else -> Light
    }
    MaterialTheme(colorScheme = scheme, content = content)
}
