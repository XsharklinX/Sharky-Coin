const COMMANDS: &[&str] = &[
    "sync_snapshot",
    "schedule_reminders",
    "cancel_reminders",
    // Backup semanal automatico (SAF + WorkManager). Sin listarlos aqui, Tauri
    // no genera permiso ACL para ellos y los invoke() desde JS se rechazan en
    // silencio — por eso el selector de carpeta "no hacia nada".
    "sync_backup_snapshot",
    "pick_backup_folder",
    "schedule_weekly_backup",
    "cancel_weekly_backup",
    "run_backup_now",
    "get_backup_status",
    // Ajusta el color de los iconos de las barras del sistema según el tema.
    "set_system_bars",
    // Notificación persistente de "agregar rápido".
    "set_quick_add_notification",
    // Hoja nativa de compartir (Intent.ACTION_SEND) — el WebView de Android no
    // implementa navigator.share() por su cuenta, así que sin esto el share
    // cae siempre a copiar al portapapeles.
    "share_text",
];

fn main() {
    let result = tauri_plugin::Builder::new(COMMANDS)
        .android_path("android")
        .try_build();

    // when building documentation for Android the plugin build result is always Err() and is irrelevant to the crate documentation build
    if !(cfg!(docsrs) && std::env::var("TARGET").unwrap().contains("android")) {
        result.unwrap();
    }
}
