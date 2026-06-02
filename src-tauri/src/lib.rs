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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![write_backup, read_backup])
        .run(tauri::generate_context!())
        .expect("error while running tauri application")
}
