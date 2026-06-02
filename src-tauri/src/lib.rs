/// Escribe el backup a una ruta específica pasada desde JS.
/// El lado JS usa tauri-plugin-dialog para pedir la ruta al usuario.
#[tauri::command]
fn write_backup(path: String, json: String) -> Result<(), String> {
    if let Some(parent) = std::path::Path::new(&path).parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    std::fs::write(&path, json).map_err(|e| e.to_string())
}

/// Lee un backup desde una ruta específica.
#[tauri::command]
fn read_backup(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| e.to_string())
}

const SECURE_STORAGE_SERVICE: &str = "com.sharky.finanzas.supabase";
const DESKTOP_PWA_CACHE_RESET_SCRIPT: &str = r#"
(async () => {
  const resetKey = "sharky-desktop-pwa-reset-v1";
  if (sessionStorage.getItem(resetKey)) return;

  sessionStorage.setItem(resetKey, "1");
  const registrations = await navigator.serviceWorker?.getRegistrations?.() ?? [];
  const cacheNames = await globalThis.caches?.keys?.() ?? [];

  await Promise.all(registrations.map((registration) => registration.unregister()));
  await Promise.all(cacheNames.map((cacheName) => globalThis.caches.delete(cacheName)));

  if (registrations.length || cacheNames.length) {
    globalThis.location.reload();
  }
})().catch(console.error);
"#;

/// Guarda sesiones Supabase en el almacén de credenciales del sistema operativo.
/// El frontend solo recibe el valor mientras el SDK necesita refrescar la sesión.
#[tauri::command]
fn secure_storage_set(key: String, value: String) -> Result<(), String> {
    keyring::Entry::new(SECURE_STORAGE_SERVICE, &key)
        .map_err(|e| e.to_string())?
        .set_password(&value)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn secure_storage_get(key: String) -> Result<Option<String>, String> {
    match keyring::Entry::new(SECURE_STORAGE_SERVICE, &key)
        .map_err(|e| e.to_string())?
        .get_password()
    {
        Ok(value) => Ok(Some(value)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(error) => Err(error.to_string()),
    }
}

#[tauri::command]
fn secure_storage_remove(key: String) -> Result<(), String> {
    match keyring::Entry::new(SECURE_STORAGE_SERVICE, &key)
        .map_err(|e| e.to_string())?
        .delete_credential()
    {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(error) => Err(error.to_string()),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_deep_link::init())
        .setup(|app| {
            #[cfg(any(target_os = "linux", windows))]
            app.deep_link().register_all()?;
            Ok(())
        })
        .on_page_load(|webview, _| {
            let _ = webview.eval(DESKTOP_PWA_CACHE_RESET_SCRIPT);
        })
        .invoke_handler(tauri::generate_handler![
            write_backup,
            read_backup,
            secure_storage_set,
            secure_storage_get,
            secure_storage_remove,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application")
}

#[cfg(test)]
mod tests {
    use super::{secure_storage_get, secure_storage_remove, secure_storage_set};
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn secure_storage_roundtrip() {
        let suffix = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time should be valid")
            .as_nanos();
        let key = format!("sharky-test-{suffix}");
        let secret = "temporary-refresh-token".to_string();

        secure_storage_set(key.clone(), secret.clone()).expect("credential should be written");
        assert_eq!(
            secure_storage_get(key.clone()).expect("credential should be read"),
            Some(secret)
        );
        secure_storage_remove(key.clone()).expect("credential should be removed");
        assert_eq!(
            secure_storage_get(key).expect("missing credential should be handled"),
            None
        );
    }
}
use tauri_plugin_deep_link::DeepLinkExt;
