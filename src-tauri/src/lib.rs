use tauri::Manager;

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

/// Guarda un backup en la carpeta de documentos de la app (sin diálogo, ideal para Android).
/// Devuelve la ruta donde se guardó el archivo.
#[tauri::command]
fn save_backup_auto(app: tauri::AppHandle, json: String) -> Result<String, String> {
    let doc_dir = app.path().document_dir().map_err(|e: tauri::Error| e.to_string())?;
    let backup_dir = doc_dir.join("backups");
    std::fs::create_dir_all(&backup_dir).map_err(|e| e.to_string())?;
    let today = chrono::Utc::now().format("%Y-%m-%d").to_string();
    let filename = format!("sharky-backup-{}.json", today);
    let path = backup_dir.join(&filename);
    std::fs::write(&path, &json).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

/// Archivo (foto/PDF de recibo) recibido vía "Compartir" desde otra app.
/// Lo escribe `MainActivity.kt` en `{cache_dir}/shared/` cuando llega un
/// intent `ACTION_SEND`; este lado lo consume una sola vez (lo borra al leerlo).
#[derive(serde::Serialize)]
struct SharedFile {
    #[serde(rename = "dataUrl")]
    data_url: String,
    #[serde(rename = "mimeType")]
    mime_type: String,
    name: String,
}

#[derive(serde::Deserialize)]
struct SharedFileMarker {
    path: String,
    #[serde(rename = "mimeType")]
    mime_type: String,
    name: String,
}

/// Lee y consume el recibo compartido pendiente (si hay alguno).
/// Devuelve `None` si el usuario no compartió nada hacia la app.
#[tauri::command]
fn take_pending_shared_file(app: tauri::AppHandle) -> Result<Option<SharedFile>, String> {
    use base64::Engine;

    let cache_dir = app.path().app_cache_dir().map_err(|e: tauri::Error| e.to_string())?;
    let shared_dir = cache_dir.join("shared");
    let marker_path = shared_dir.join("pending.json");
    if !marker_path.exists() {
        return Ok(None);
    }

    let marker_json = std::fs::read_to_string(&marker_path).map_err(|e| e.to_string())?;
    let marker: SharedFileMarker = serde_json::from_str(&marker_json).map_err(|e| e.to_string())?;
    let bytes = std::fs::read(&marker.path).map_err(|e| e.to_string())?;
    let encoded = base64::engine::general_purpose::STANDARD.encode(&bytes);
    let data_url = format!("data:{};base64,{}", marker.mime_type, encoded);

    let _ = std::fs::remove_file(&marker_path);
    let _ = std::fs::remove_file(&marker.path);

    Ok(Some(SharedFile {
        data_url,
        mime_type: marker.mime_type,
        name: marker.name,
    }))
}

const SECURE_STORAGE_SERVICE: &str = "com.sharky.finanzas";
extern crate chrono;
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

#[cfg(any(target_os = "linux", windows))]
use tauri_plugin_deep_link::DeepLinkExt;

#[cfg(any(target_os = "linux", windows))]
fn register_desktop_deep_links(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    app.deep_link().register_all()?;
    Ok(())
}

#[cfg(not(any(target_os = "linux", windows)))]
fn register_desktop_deep_links(_app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    Ok(())
}

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
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_biometric::init())
        .plugin(tauri_plugin_notification::init())
        .setup(|app| register_desktop_deep_links(app))
        .on_page_load(|webview, _| {
            let _ = webview.eval(DESKTOP_PWA_CACHE_RESET_SCRIPT);
        })
        .invoke_handler(tauri::generate_handler![
            write_backup,
            read_backup,
            save_backup_auto,
            secure_storage_set,
            secure_storage_get,
            secure_storage_remove,
            take_pending_shared_file,
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
