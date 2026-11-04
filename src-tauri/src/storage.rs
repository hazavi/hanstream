use rusqlite::{params, Connection, OptionalExtension};
use serde_json::Value;
use std::{path::Path, sync::{Arc, Mutex}, time::{Duration, SystemTime, UNIX_EPOCH}};
use tauri::State;

#[derive(Clone)]
pub struct Storage(Arc<Mutex<Connection>>);

fn now() -> i64 {
    SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_millis() as i64
}

impl Storage {
    pub fn open(directory: &Path) -> Result<Self, Box<dyn std::error::Error>> {
        std::fs::create_dir_all(directory)?;
        let connection = Connection::open(directory.join("library.sqlite3"))?;
        connection.busy_timeout(Duration::from_secs(2))?;
        connection.execute_batch(
            "PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL; PRAGMA foreign_keys=ON;
             PRAGMA trusted_schema=OFF; PRAGMA secure_delete=ON;
             CREATE TABLE IF NOT EXISTS library_profile (id INTEGER PRIMARY KEY CHECK(id=1), body TEXT NOT NULL, updated_at INTEGER NOT NULL);
             CREATE TABLE IF NOT EXISTS content_cache (cache_key TEXT PRIMARY KEY, body TEXT NOT NULL, expires_at INTEGER NOT NULL, accessed_at INTEGER NOT NULL);
             CREATE INDEX IF NOT EXISTS cache_expiry ON content_cache(expires_at);"
        )?;
        connection.execute("DELETE FROM content_cache WHERE expires_at < ?1", [now()])?;
        Ok(Self(Arc::new(Mutex::new(connection))))
    }

    async fn run<T: Send + 'static>(&self, work: impl FnOnce(&Connection) -> Result<T, String> + Send + 'static) -> Result<T, String> {
        let database = self.0.clone();
        tauri::async_runtime::spawn_blocking(move || {
            let connection = database.lock().map_err(|_| "Local storage is busy".to_string())?;
            work(&connection)
        }).await.map_err(|_| "Local storage operation failed".to_string())?
    }
}

fn valid_profile(value: &Value) -> bool {
    value.is_object() && ["watchlist", "continueWatching", "topRankings"].iter().all(|key| {
        value.get(key).and_then(Value::as_array).is_some_and(|items| items.len() <= 1000)
    })
}

#[tauri::command]
pub async fn library_load(storage: State<'_, Storage>) -> Result<Option<Value>, String> {
    storage.run(|connection| {
        let body: Option<String> = connection.query_row("SELECT body FROM library_profile WHERE id=1", [], |row| row.get(0)).optional().map_err(|_| "Could not read saved library")?;
        body.map(|body| serde_json::from_str(&body).map_err(|_| "Saved library needs recovery".to_string())).transpose()
    }).await
}

#[tauri::command]
pub async fn library_save(storage: State<'_, Storage>, profile: Value) -> Result<(), String> {
    if !valid_profile(&profile) { return Err("Invalid library format".into()); }
    let body = serde_json::to_string(&profile).map_err(|_| "Invalid library format")?;
    if body.len() > 1_000_000 { return Err("Library exceeds its storage limit".into()); }
    storage.run(move |connection| {
        connection.execute("INSERT INTO library_profile(id,body,updated_at) VALUES(1,?1,?2) ON CONFLICT(id) DO UPDATE SET body=excluded.body,updated_at=excluded.updated_at", params![body,now()]).map_err(|_| "Could not save the library")?;
        Ok(())
    }).await
}

#[tauri::command]
pub async fn library_clear(storage: State<'_, Storage>) -> Result<(), String> {
    storage.run(|connection| {
        connection.execute_batch("DELETE FROM library_profile; DELETE FROM content_cache; PRAGMA wal_checkpoint(TRUNCATE);").map_err(|_| "Could not delete saved data")?;
        Ok(())
    }).await
}

#[tauri::command]
pub async fn cache_load(storage: State<'_, Storage>, key: String) -> Result<Option<Value>, String> {
    if key.len() > 4096 { return Err("Invalid cache key".into()); }
    storage.run(move |connection| {
        let body: Option<String> = connection.query_row("SELECT body FROM content_cache WHERE cache_key=?1 AND expires_at>?2", params![key,now()], |row| row.get(0)).optional().map_err(|_| "Cache read failed")?;
        if body.is_some() { let _ = connection.execute("UPDATE content_cache SET accessed_at=?2 WHERE cache_key=?1", params![key,now()]); }
        Ok(body.and_then(|body| serde_json::from_str(&body).ok()))
    }).await
}

#[tauri::command]
pub async fn cache_save(storage: State<'_, Storage>, key: String, value: Value, expires_at: i64) -> Result<(), String> {
    let body = serde_json::to_string(&value).map_err(|_| "Invalid cache entry")?;
    if key.len() > 4096 || body.len() > 2_000_000 || expires_at <= now() || expires_at > now() + 86_400_000 { return Err("Invalid cache limits".into()); }
    storage.run(move |connection| {
        connection.execute("INSERT INTO content_cache(cache_key,body,expires_at,accessed_at) VALUES(?1,?2,?3,?4) ON CONFLICT(cache_key) DO UPDATE SET body=excluded.body,expires_at=excluded.expires_at,accessed_at=excluded.accessed_at", params![key,body,expires_at,now()]).map_err(|_| "Cache write failed")?;
        connection.execute("DELETE FROM content_cache WHERE expires_at<?1", [now()]).map_err(|_| "Cache cleanup failed")?;
        loop {
            let (count, size): (i64,i64) = connection.query_row("SELECT COUNT(*),COALESCE(SUM(LENGTH(body)),0) FROM content_cache", [], |row| Ok((row.get(0)?,row.get(1)?))).map_err(|_| "Cache size check failed")?;
            if count <= 100 && size <= 20_000_000 { break; }
            connection.execute("DELETE FROM content_cache WHERE cache_key IN (SELECT cache_key FROM content_cache ORDER BY accessed_at LIMIT 1)", []).map_err(|_| "Cache cleanup failed")?;
        }
        Ok(())
    }).await
}
