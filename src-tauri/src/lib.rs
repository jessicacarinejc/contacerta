use serde::Serialize;
use sha2::{Digest, Sha256};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct PlatformInfo {
    os: &'static str,
    arch: &'static str,
    family: &'static str,
    mobile: bool,
}

#[tauri::command]
fn platform_info() -> PlatformInfo {
    PlatformInfo {
        os: std::env::consts::OS,
        arch: std::env::consts::ARCH,
        family: std::env::consts::FAMILY,
        mobile: cfg!(mobile),
    }
}

#[tauri::command]
fn secure_hash(value: String) -> String {
    let mut hasher = Sha256::new();
    hasher.update(value.as_bytes());
    hex::encode(hasher.finalize())
}

#[tauri::command]
fn health_check() -> serde_json::Value {
    serde_json::json!({
        "status": "ok",
        "application": "Conta Certa",
        "version": env!("CARGO_PKG_VERSION")
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_file_access::init())
        .setup(|app| {
            #[cfg(mobile)]
            app.handle()
                .plugin(tauri_plugin_biometric::Builder::new().build())?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![platform_info, secure_hash, health_check])
        .run(tauri::generate_context!())
        .expect("erro ao executar o Conta Certa");
}
