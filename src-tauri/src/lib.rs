use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use rusqlite::{params, Connection, DatabaseName, OpenFlags, OptionalExtension};
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::{
    fs,
    path::{Path, PathBuf},
    time::Duration,
};
use tauri::Manager;

const DATABASE_FILE: &str = "conta-certa.sqlite3";
const DATABASE_SCHEMA_VERSION: i64 = 1;
const MAX_BACKUP_BYTES: usize = 100 * 1024 * 1024;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct PlatformInfo {
    os: &'static str,
    arch: &'static str,
    family: &'static str,
    mobile: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DatabaseBackupInfo {
    schema_version: i64,
    state_entries: i64,
    has_finance_state: bool,
    has_auth_state: bool,
    updated_at: String,
    byte_size: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DatabaseBackupPayload {
    data_base64: String,
    info: DatabaseBackupInfo,
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

fn database_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let directory = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("Não foi possível localizar a pasta de dados: {error}"))?;
    fs::create_dir_all(&directory)
        .map_err(|error| format!("Não foi possível preparar a pasta de dados: {error}"))?;
    Ok(directory.join(DATABASE_FILE))
}

fn configure_database(connection: &Connection) -> Result<(), String> {
    connection
        .busy_timeout(Duration::from_secs(5))
        .map_err(|error| format!("Falha ao configurar espera do SQLite: {error}"))?;
    connection
        .execute_batch(
            "PRAGMA journal_mode = WAL;
             PRAGMA synchronous = FULL;
             PRAGMA foreign_keys = ON;
             CREATE TABLE IF NOT EXISTS app_meta (
               id INTEGER PRIMARY KEY CHECK (id = 1),
               app_name TEXT NOT NULL,
               schema_version INTEGER NOT NULL,
               created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
               updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
             );
             CREATE TABLE IF NOT EXISTS state_store (
               key TEXT PRIMARY KEY NOT NULL,
               value TEXT NOT NULL,
               updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
             );
             INSERT OR IGNORE INTO app_meta (id, app_name, schema_version)
             VALUES (1, 'Conta Certa', 1);",
        )
        .map_err(|error| format!("Falha ao preparar a base SQLite: {error}"))?;
    Ok(())
}

fn open_database(app: &tauri::AppHandle) -> Result<Connection, String> {
    let connection = Connection::open(database_path(app)?)
        .map_err(|error| format!("Não foi possível abrir a base SQLite: {error}"))?;
    configure_database(&connection)?;
    Ok(connection)
}

fn backup_database_to_path(app: &tauri::AppHandle, destination: &PathBuf) -> Result<(), String> {
    if destination.exists() {
        fs::remove_file(destination)
            .map_err(|error| format!("Não foi possível substituir o backup temporário: {error}"))?;
    }

    let connection = open_database(app)?;
    connection
        .execute_batch("PRAGMA wal_checkpoint(FULL);")
        .map_err(|error| format!("Falha ao consolidar a base SQLite: {error}"))?;
    connection
        .backup(DatabaseName::Main, destination, None)
        .map_err(|error| format!("Falha ao criar o backup SQLite: {error}"))?;
    Ok(())
}

fn inspect_database(path: &PathBuf) -> Result<DatabaseBackupInfo, String> {
    let byte_size = fs::metadata(path)
        .map_err(|error| format!("Não foi possível ler o backup: {error}"))?
        .len();
    if byte_size == 0 || byte_size > MAX_BACKUP_BYTES as u64 {
        return Err("O arquivo de backup está vazio ou ultrapassa 100 MB.".to_string());
    }

    let connection = Connection::open_with_flags(path, OpenFlags::SQLITE_OPEN_READ_ONLY)
        .map_err(|error| format!("O arquivo selecionado não é uma base SQLite válida: {error}"))?;
    connection
        .busy_timeout(Duration::from_secs(5))
        .map_err(|error| format!("Falha ao validar a base SQLite: {error}"))?;

    let integrity: String = connection
        .query_row("PRAGMA integrity_check;", [], |row| row.get(0))
        .map_err(|error| format!("Falha no teste de integridade do backup: {error}"))?;
    if integrity.to_lowercase() != "ok" {
        return Err(format!("A integridade do backup SQLite falhou: {integrity}"));
    }

    let metadata: Option<(String, i64, String)> = connection
        .query_row(
            "SELECT app_name, schema_version, updated_at FROM app_meta WHERE id = 1",
            [],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .optional()
        .map_err(|error| format!("O backup não contém metadados válidos: {error}"))?;

    let Some((app_name, schema_version, updated_at)) = metadata else {
        return Err("O arquivo não é um backup reconhecido do Conta Certa.".to_string());
    };
    if app_name != "Conta Certa" {
        return Err("O arquivo selecionado pertence a outro aplicativo.".to_string());
    }
    if schema_version > DATABASE_SCHEMA_VERSION {
        return Err(format!(
            "Este backup usa uma versão de banco mais nova ({schema_version}) que a suportada ({DATABASE_SCHEMA_VERSION})."
        ));
    }

    let state_entries: i64 = connection
        .query_row("SELECT COUNT(*) FROM state_store", [], |row| row.get(0))
        .map_err(|error| format!("Não foi possível contar os dados do backup: {error}"))?;
    let has_finance_state = connection
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM state_store WHERE key = 'conta-certa-finance-state')",
            [],
            |row| row.get::<_, i64>(0),
        )
        .map(|value| value == 1)
        .map_err(|error| format!("Não foi possível validar os dados financeiros: {error}"))?;
    let has_auth_state = connection
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM state_store WHERE key = 'conta-certa-auth')",
            [],
            |row| row.get::<_, i64>(0),
        )
        .map(|value| value == 1)
        .map_err(|error| format!("Não foi possível validar o perfil do backup: {error}"))?;

    Ok(DatabaseBackupInfo {
        schema_version,
        state_entries,
        has_finance_state,
        has_auth_state,
        updated_at,
        byte_size,
    })
}

fn decode_backup(data_base64: &str) -> Result<Vec<u8>, String> {
    if data_base64.len() > MAX_BACKUP_BYTES.saturating_mul(2) {
        return Err("O backup selecionado ultrapassa o limite de segurança.".to_string());
    }
    let bytes = BASE64
        .decode(data_base64.trim())
        .map_err(|error| format!("O conteúdo do backup está corrompido: {error}"))?;
    if bytes.len() < 16 || bytes.len() > MAX_BACKUP_BYTES {
        return Err("O arquivo de backup está vazio, incompleto ou é grande demais.".to_string());
    }
    if !bytes.starts_with(b"SQLite format 3\0") {
        return Err("O arquivo selecionado não possui o cabeçalho de uma base SQLite.".to_string());
    }
    Ok(bytes)
}

fn temp_database_path(app: &tauri::AppHandle, file_name: &str) -> Result<PathBuf, String> {
    let mut path = database_path(app)?;
    path.set_file_name(file_name);
    Ok(path)
}

fn remove_database_sidecars(path: &Path) {
    for suffix in ["-wal", "-shm"] {
        let sidecar = PathBuf::from(format!("{}{suffix}", path.to_string_lossy()));
        let _ = fs::remove_file(sidecar);
    }
}

#[tauri::command]
fn database_read_state(key: String, app: tauri::AppHandle) -> Result<Option<String>, String> {
    let connection = open_database(&app)?;
    connection
        .query_row(
            "SELECT value FROM state_store WHERE key = ?1",
            params![key],
            |row| row.get(0),
        )
        .optional()
        .map_err(|error| format!("Falha ao ler a base SQLite: {error}"))
}

#[tauri::command]
fn database_write_state(key: String, value: String, app: tauri::AppHandle) -> Result<(), String> {
    if key.trim().is_empty() {
        return Err("A chave de armazenamento não pode ficar vazia.".to_string());
    }
    let connection = open_database(&app)?;
    let transaction = connection
        .unchecked_transaction()
        .map_err(|error| format!("Falha ao iniciar a gravação SQLite: {error}"))?;
    transaction
        .execute(
            "INSERT INTO state_store (key, value, updated_at)
             VALUES (?1, ?2, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
             ON CONFLICT(key) DO UPDATE SET
               value = excluded.value,
               updated_at = excluded.updated_at",
            params![key, value],
        )
        .map_err(|error| format!("Falha ao gravar a base SQLite: {error}"))?;
    transaction
        .execute(
            "UPDATE app_meta SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = 1",
            [],
        )
        .map_err(|error| format!("Falha ao atualizar metadados SQLite: {error}"))?;
    transaction
        .commit()
        .map_err(|error| format!("Falha ao confirmar a gravação SQLite: {error}"))?;
    Ok(())
}

#[tauri::command]
fn database_delete_state(key: String, app: tauri::AppHandle) -> Result<(), String> {
    let connection = open_database(&app)?;
    connection
        .execute("DELETE FROM state_store WHERE key = ?1", params![key])
        .map_err(|error| format!("Falha ao remover dados da base SQLite: {error}"))?;
    connection
        .execute(
            "UPDATE app_meta SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = 1",
            [],
        )
        .map_err(|error| format!("Falha ao atualizar metadados SQLite: {error}"))?;
    Ok(())
}

#[tauri::command]
fn database_backup(app: tauri::AppHandle) -> Result<DatabaseBackupPayload, String> {
    let temporary = temp_database_path(&app, "conta-certa-backup.tmp.sqlite3")?;
    backup_database_to_path(&app, &temporary)?;
    let info = inspect_database(&temporary)?;
    let bytes = fs::read(&temporary)
        .map_err(|error| format!("Não foi possível ler o backup SQLite: {error}"))?;
    let _ = fs::remove_file(&temporary);
    Ok(DatabaseBackupPayload {
        data_base64: BASE64.encode(bytes),
        info,
    })
}

#[tauri::command]
fn database_inspect_backup(
    data_base64: String,
    app: tauri::AppHandle,
) -> Result<DatabaseBackupInfo, String> {
    let bytes = decode_backup(&data_base64)?;
    let temporary = temp_database_path(&app, "conta-certa-inspect.tmp.sqlite3")?;
    if temporary.exists() {
        let _ = fs::remove_file(&temporary);
    }
    fs::write(&temporary, bytes)
        .map_err(|error| format!("Não foi possível preparar a validação do backup: {error}"))?;
    let result = inspect_database(&temporary);
    let _ = fs::remove_file(&temporary);
    result
}

#[tauri::command]
fn database_restore_backup(
    data_base64: String,
    app: tauri::AppHandle,
) -> Result<DatabaseBackupInfo, String> {
    let bytes = decode_backup(&data_base64)?;
    let database = database_path(&app)?;
    let temporary = temp_database_path(&app, "conta-certa-restore.tmp.sqlite3")?;
    let safety = temp_database_path(&app, "conta-certa-before-restore.sqlite3")?;

    if temporary.exists() {
        let _ = fs::remove_file(&temporary);
    }
    fs::write(&temporary, bytes)
        .map_err(|error| format!("Não foi possível preparar o arquivo de restauração: {error}"))?;
    let validated = inspect_database(&temporary)?;

    if database.exists() {
        backup_database_to_path(&app, &safety)?;
    }

    remove_database_sidecars(&database);
    if database.exists() {
        fs::remove_file(&database)
            .map_err(|error| format!("Não foi possível substituir a base atual: {error}"))?;
    }

    if let Err(error) = fs::rename(&temporary, &database) {
        if safety.exists() {
            let _ = fs::copy(&safety, &database);
        }
        return Err(format!(
            "Não foi possível concluir a restauração. A base anterior foi preservada: {error}"
        ));
    }

    let connection = open_database(&app)?;
    drop(connection);
    let restored = inspect_database(&database)?;
    if restored.state_entries != validated.state_entries {
        return Err("A conferência final do backup restaurado não corresponde ao arquivo selecionado.".to_string());
    }
    Ok(restored)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_file_access::init())
        .setup(|_app| {
            #[cfg(mobile)]
            _app.handle().plugin(tauri_plugin_biometric::init())?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            platform_info,
            secure_hash,
            health_check,
            database_read_state,
            database_write_state,
            database_delete_state,
            database_backup,
            database_inspect_backup,
            database_restore_backup
        ])
        .run(tauri::generate_context!())
        .expect("erro ao executar o Conta Certa");
}
