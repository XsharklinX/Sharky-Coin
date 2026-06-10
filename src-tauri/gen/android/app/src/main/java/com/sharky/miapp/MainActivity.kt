package com.sharky.miapp

import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.OpenableColumns
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    window.statusBarColor = Color.parseColor("#1B1B1B")
    window.navigationBarColor = Color.parseColor("#151515")
    handleShareIntent(intent)
  }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    handleShareIntent(intent)
  }

  /**
   * Si el usuario abrió $harky desde "Compartir" con una foto o un PDF (recibo),
   * copia el archivo a la carpeta de caché de la app y deja un marcador
   * (`shared/pending.json`) que el lado Rust/JS consume una sola vez vía
   * el comando `take_pending_shared_file`.
   */
  private fun handleShareIntent(intent: Intent?) {
    if (intent == null || intent.action != Intent.ACTION_SEND) return
    val mimeType = intent.type ?: return
    if (!(mimeType.startsWith("image/") || mimeType == "application/pdf")) return
    val uri = sharedStreamUri(intent) ?: return

    try {
      val sharedDir = File(cacheDir, "shared").apply { mkdirs() }
      val name = displayNameFor(uri) ?: "recibo-${System.currentTimeMillis()}"
      val destFile = File(sharedDir, "${System.currentTimeMillis()}_$name")
      contentResolver.openInputStream(uri)?.use { input ->
        FileOutputStream(destFile).use { output -> input.copyTo(output) }
      } ?: return

      val marker = JSONObject().apply {
        put("path", destFile.absolutePath)
        put("mimeType", mimeType)
        put("name", name)
      }
      File(sharedDir, "pending.json").writeText(marker.toString())
    } catch (_: Exception) {
      // Si algo falla al copiar el archivo compartido, lo ignoramos silenciosamente
    }
  }

  private fun sharedStreamUri(intent: Intent): Uri? =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      intent.getParcelableExtra(Intent.EXTRA_STREAM, Uri::class.java)
    } else {
      @Suppress("DEPRECATION")
      intent.getParcelableExtra(Intent.EXTRA_STREAM)
    }

  private fun displayNameFor(uri: Uri): String? =
    contentResolver.query(uri, null, null, null, null)?.use { cursor ->
      val idx = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
      if (idx >= 0 && cursor.moveToFirst()) cursor.getString(idx) else null
    }
}
