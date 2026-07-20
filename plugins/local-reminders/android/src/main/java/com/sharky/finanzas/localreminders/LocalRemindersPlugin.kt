package com.sharky.finanzas.localreminders

import android.app.Activity
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import androidx.activity.result.ActivityResult
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.view.WindowCompat
import androidx.documentfile.provider.DocumentFile
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import app.tauri.annotation.ActivityCallback
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import java.io.File
import java.util.Calendar
import java.util.concurrent.TimeUnit

internal const val UNIQUE_WORK_NAME = "sharky-local-reminders"
internal const val EVENING_WORK_NAME = "sharky-evening-reminder"
internal const val BACKUP_WORK_NAME = "sharky-weekly-backup"
internal const val SNAPSHOT_FILE = "reminders_snapshot.json"
private const val EVENING_CHECK_HOUR = 19
// Notificación persistente de "agregar rápido" (gasto/ingreso de un toque).
private const val QUICK_ADD_CHANNEL = "sharky_quick_add"
private const val QUICK_ADD_NOTIF_ID = 9911
private val QUICK_ADD_ACCENT = 0xFF4D82FF.toInt()

@InvokeArg
class SyncSnapshotArgs {
    lateinit var snapshot: String
}

@InvokeArg
class ScheduleBackupArgs {
    /** 0 = domingo … 6 = sabado (mismo criterio que Date.getDay() en JS). */
    var day: Int = 1
    var hour: Int = 3
}

@InvokeArg
class SetSystemBarsArgs {
    /** true = la barra tiene fondo CLARO → el sistema pinta iconos OSCUROS. */
    var light: Boolean = false
}

@InvokeArg
class QuickAddArgs {
    var enabled: Boolean = false
}

@InvokeArg
class ShareTextArgs {
    lateinit var text: String
    var title: String? = null
}

@TauriPlugin
class LocalRemindersPlugin(private val activity: Activity) : Plugin(activity) {

    /**
     * Ajusta el color de los iconos de la barra de estado y de navegación para
     * que sigan el TEMA DE LA APP (no el del sistema). `enableEdgeToEdge` en
     * MainActivity los deja fijos en "claros" (buenos sobre fondo oscuro); en
     * tema claro eso los vuelve invisibles. El WebView llama a esto cuando cambia
     * el tema — es best-effort: si falla, se queda el default de MainActivity.
     */
    /**
     * Muestra/oculta una notificación PERSISTENTE (ongoing, no se puede deslizar)
     * con dos acciones: "Gasto" e "Ingreso". Cada acción abre $harky directo al
     * flujo de agregar, vía el mismo deep link de atajo que ya usan los widgets
     * (`sharky://shortcut/add-expense` / `add-income`). Opcional: el usuario lo
     * activa desde Configuración.
     */
    // El WebView de Android no implementa navigator.share() por su cuenta (a
    // diferencia de Chrome/PWA) — sin esto, compartir una lista siempre caía a
    // copiar al portapapeles. FLAG_ACTIVITY_NEW_TASK es necesario porque el
    // Intent se lanza desde el Activity de la app, no desde un contexto de
    // aplicación normal.
    @Command
    fun shareText(invoke: Invoke) {
        val args = invoke.parseArgs(ShareTextArgs::class.java)
        val sendIntent = Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(Intent.EXTRA_TEXT, args.text)
        }
        val chooser = Intent.createChooser(sendIntent, args.title).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        activity.startActivity(chooser)
        invoke.resolve(JSObject())
    }

    @Command
    fun setQuickAddNotification(invoke: Invoke) {
        val args = invoke.parseArgs(QuickAddArgs::class.java)
        if (args.enabled) showQuickAddNotification() else NotificationManagerCompat.from(activity).cancel(QUICK_ADD_NOTIF_ID)
        invoke.resolve(JSObject())
    }

    private fun shortcutPendingIntent(route: String, requestCode: Int): PendingIntent {
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse("sharky://shortcut/$route"))
            .setClassName(activity.packageName, "${activity.packageName}.MainActivity")
            .setFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        return PendingIntent.getActivity(
            activity, requestCode, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
    }

    // El plugin es un módulo Gradle aparte del app — no tiene su propia R con
    // los drawables que viven en app/src/main/res, así que hay que buscarlos
    // por nombre igual que ya se hacía con el ícono chico. `0` (sin ícono) es
    // lo que dejaba los botones de acción pelados y con mala pinta.
    private fun drawableId(name: String): Int =
        activity.resources.getIdentifier(name, "drawable", activity.packageName)

    private fun showQuickAddNotification() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(QUICK_ADD_CHANNEL, "Agregar rápido", NotificationManager.IMPORTANCE_LOW)
            channel.setShowBadge(false)
            channel.description = "Acceso permanente para anotar un gasto o ingreso al instante."
            activity.getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
        }
        val smallIcon = drawableId("ic_stat_sharky").let { if (it != 0) it else activity.applicationInfo.icon }
        val expenseIcon = drawableId("ic_action_expense")
        val incomeIcon = drawableId("ic_action_income")
        // Ícono grande (foto del app) en el cuerpo expandido — sin esto la
        // notificación se ve pelada, solo texto sin ninguna marca visual.
        val largeIcon = try {
            android.graphics.BitmapFactory.decodeResource(activity.resources, activity.applicationInfo.icon)
        } catch (_: Exception) {
            null
        }

        val builder = NotificationCompat.Builder(activity, QUICK_ADD_CHANNEL)
            .setSmallIcon(smallIcon)
            .setColor(QUICK_ADD_ACCENT)
            .setContentTitle("\$harky · Agregar rápido")
            .setContentText("Toca Gasto o Ingreso para anotarlo al instante.")
            .setOngoing(true)
            .setAutoCancel(false)
            .setShowWhen(false)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setContentIntent(shortcutPendingIntent("add-expense", 9901))
            .addAction(expenseIcon, "Gasto", shortcutPendingIntent("add-expense", 9902))
            .addAction(incomeIcon, "Ingreso", shortcutPendingIntent("add-income", 9903))

        if (largeIcon != null) builder.setLargeIcon(largeIcon)

        try {
            NotificationManagerCompat.from(activity).notify(QUICK_ADD_NOTIF_ID, builder.build())
        } catch (_: SecurityException) {
            // POST_NOTIFICATIONS no concedido — no se puede mostrar.
        }
    }

    @Command
    fun setSystemBars(invoke: Invoke) {
        val args = invoke.parseArgs(SetSystemBarsArgs::class.java)
        activity.runOnUiThread {
            val window = activity.window
            val controller = WindowCompat.getInsetsController(window, window.decorView)
            controller.isAppearanceLightStatusBars = args.light
            controller.isAppearanceLightNavigationBars = args.light
        }
        invoke.resolve(JSObject())
    }

    @Command
    fun syncSnapshot(invoke: Invoke) {
        val args = invoke.parseArgs(SyncSnapshotArgs::class.java)
        File(activity.filesDir, SNAPSHOT_FILE).writeText(args.snapshot)
        invoke.resolve(JSObject())
    }

    @Command
    fun scheduleReminders(invoke: Invoke) {
        val workManager = WorkManager.getInstance(activity.applicationContext)

        val request = PeriodicWorkRequestBuilder<ReminderWorker>(6, TimeUnit.HOURS).build()
        workManager.enqueueUniquePeriodicWork(UNIQUE_WORK_NAME, ExistingPeriodicWorkPolicy.UPDATE, request)

        // Recordatorio de actividad diaria: alineado a la próxima ~7pm, se repite cada 24h.
        val eveningRequest = PeriodicWorkRequestBuilder<ReminderWorker>(24, TimeUnit.HOURS)
            .setInitialDelay(millisUntilNextEveningCheck(), TimeUnit.MILLISECONDS)
            .build()
        workManager.enqueueUniquePeriodicWork(EVENING_WORK_NAME, ExistingPeriodicWorkPolicy.UPDATE, eveningRequest)

        invoke.resolve(JSObject())
    }

    @Command
    fun cancelReminders(invoke: Invoke) {
        val workManager = WorkManager.getInstance(activity.applicationContext)
        workManager.cancelUniqueWork(UNIQUE_WORK_NAME)
        workManager.cancelUniqueWork(EVENING_WORK_NAME)
        invoke.resolve(JSObject())
    }

    // ── Backup semanal automatico ─────────────────────────────────────────
    // Corre por WorkManager aunque la app este cerrada. El JS deja aqui el JSON
    // del backup; el worker solo lo copia a la carpeta elegida por el usuario.

    @Command
    fun syncBackupSnapshot(invoke: Invoke) {
        val args = invoke.parseArgs(SyncSnapshotArgs::class.java)
        File(activity.filesDir, BACKUP_SNAPSHOT_FILE).writeText(args.snapshot)
        invoke.resolve(JSObject())
    }

    /** Abre el selector de carpetas de Android (SAF) y conserva el permiso sobre la elegida. */
    @Command
    fun pickBackupFolder(invoke: Invoke) {
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT_TREE).apply {
            addFlags(
                Intent.FLAG_GRANT_READ_URI_PERMISSION or
                    Intent.FLAG_GRANT_WRITE_URI_PERMISSION or
                    Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION,
            )
        }
        startActivityForResult(invoke, intent, "onBackupFolderPicked")
    }

    @ActivityCallback
    fun onBackupFolderPicked(invoke: Invoke, result: ActivityResult) {
        val uri = result.data?.data
        if (uri == null) {
            invoke.resolve(JSObject().put("cancelled", true))
            return
        }
        // Sin esto el permiso se pierde al reiniciar y el backup de fondo fallaria
        // silenciosamente la proxima semana.
        activity.contentResolver.takePersistableUriPermission(
            uri,
            Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION,
        )
        backupPrefs().edit().putString(BACKUP_DEST_URI_KEY, uri.toString()).apply()
        invoke.resolve(
            JSObject()
                .put("cancelled", false)
                .put("uri", uri.toString())
                .put("label", folderLabel(uri)),
        )
    }

    @Command
    fun scheduleWeeklyBackup(invoke: Invoke) {
        val args = invoke.parseArgs(ScheduleBackupArgs::class.java)
        backupPrefs().edit()
            .putInt(BACKUP_DAY_KEY, args.day.coerceIn(0, 6))
            .putInt(BACKUP_HOUR_KEY, args.hour.coerceIn(0, 23))
            .apply()

        // Despierta cada 6h y el worker decide si toca: WorkManager no garantiza
        // un instante exacto, asi que comprobar la ventana es mas fiable que
        // pedir una ejecucion puntual.
        val request = PeriodicWorkRequestBuilder<BackupWorker>(6, TimeUnit.HOURS).build()
        WorkManager.getInstance(activity.applicationContext)
            .enqueueUniquePeriodicWork(BACKUP_WORK_NAME, ExistingPeriodicWorkPolicy.UPDATE, request)
        invoke.resolve(JSObject())
    }

    @Command
    fun cancelWeeklyBackup(invoke: Invoke) {
        WorkManager.getInstance(activity.applicationContext).cancelUniqueWork(BACKUP_WORK_NAME)
        invoke.resolve(JSObject())
    }

    /** "Probar backup ahora": ejecuta el MISMO camino que el worker semanal. */
    @Command
    fun runBackupNow(invoke: Invoke) {
        val dest = backupPrefs().getString(BACKUP_DEST_URI_KEY, null)
        if (dest == null) {
            invoke.resolve(JSObject().put("ok", false).put("error", "no-folder"))
            return
        }
        // IO fuera del hilo principal.
        Thread {
            val error = BackupWorker.runBackup(activity.applicationContext, Uri.parse(dest))
            invoke.resolve(JSObject().put("ok", error == null).put("error", error))
        }.start()
    }

    @Command
    fun getBackupStatus(invoke: Invoke) {
        val prefs = backupPrefs()
        val dest = prefs.getString(BACKUP_DEST_URI_KEY, null)
        val ret = JSObject()
            .put("hasFolder", dest != null)
            .put("folderLabel", dest?.let { folderLabel(Uri.parse(it)) })
            .put("day", prefs.getInt(BACKUP_DAY_KEY, 1))
            .put("hour", prefs.getInt(BACKUP_HOUR_KEY, 3))
            .put("lastSuccessAt", prefs.getLong(BACKUP_LAST_SUCCESS_KEY, 0L))
            .put("lastAttemptAt", prefs.getLong(BACKUP_LAST_ATTEMPT_KEY, 0L))
            .put("lastError", prefs.getString(BACKUP_LAST_ERROR_KEY, null))
            .put("hasSnapshot", File(activity.filesDir, BACKUP_SNAPSHOT_FILE).exists())
        // El permiso sobre la carpeta puede revocarse (el usuario la borra, quita
        // el permiso, se desmonta la SD). Reportamos el estado real, no el guardado.
        ret.put(
            "folderWritable",
            dest != null && DocumentFile.fromTreeUri(activity, Uri.parse(dest))?.canWrite() == true,
        )
        invoke.resolve(ret)
    }

    private fun backupPrefs() = activity.getSharedPreferences(BACKUP_PREFS, Context.MODE_PRIVATE)

    private fun folderLabel(uri: Uri): String? =
        DocumentFile.fromTreeUri(activity, uri)?.name

    private fun millisUntilNextEveningCheck(): Long {
        val target = Calendar.getInstance().apply {
            set(Calendar.HOUR_OF_DAY, EVENING_CHECK_HOUR)
            set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
            if (before(Calendar.getInstance())) add(Calendar.DAY_OF_MONTH, 1)
        }
        return target.timeInMillis - System.currentTimeMillis()
    }
}
