# SQLCipher native bindings must survive shrinking.
-keep class net.zetetic.** { *; }
-keep class net.sqlcipher.** { *; }

# Room generated code
-keep class * extends androidx.room.RoomDatabase { *; }
-dontwarn androidx.room.paging.**

# Media3 / ExoPlayer
-dontwarn androidx.media3.**

# Keep the four SMS-role stub components so RoleManager can resolve them.
-keep class com.brianwelch.smsvault.role.** { *; }
