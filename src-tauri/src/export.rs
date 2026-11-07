use std::io::Write;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc,
};
use tauri::{Manager, State, Webview};
use tauri_plugin_dialog::DialogExt;

#[derive(Default)]
pub struct ExportState(Arc<AtomicBool>);
struct ExportPermit(Arc<AtomicBool>);
impl Drop for ExportPermit {
    fn drop(&mut self) {
        self.0.store(false, Ordering::Release);
    }
}

#[tauri::command]
pub async fn library_export(
    app: tauri::AppHandle,
    caller: Webview,
    state: State<'_, ExportState>,
    content: String,
    filename: String,
) -> Result<bool, String> {
    let url = caller.url().map_err(|_| "Invalid export caller")?;
    if caller.label() != "main"
        || url.scheme() != "https"
        || url.host_str() != Some("tauri.localhost")
        || url.port().is_some()
    {
        return Err("Only the local app can export a library".into());
    }
    if content.len() > 1_000_000
        || filename.len() > 80
        || !filename.starts_with("hanstream-library-")
        || !filename.ends_with(".json")
        || !filename
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'.')
    {
        return Err("Invalid library export".into());
    }
    let envelope: serde_json::Value =
        serde_json::from_str(&content).map_err(|_| "Invalid library export")?;
    if envelope.get("format").and_then(|v| v.as_str()) != Some("hanstream-library")
        || envelope.get("version").and_then(|v| v.as_u64()) != Some(1)
        || !envelope
            .get("profile")
            .is_some_and(crate::storage::valid_profile)
    {
        return Err("Invalid library export".into());
    }
    state
        .inner()
        .0
        .compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
        .map_err(|_| "A library export dialog is already open")?;
    let permit = ExportPermit(state.inner().0.clone());
    tauri::async_runtime::spawn_blocking(move || {
        let _permit = permit;
        let window = app
            .get_webview_window("main")
            .ok_or("App window is unavailable")?;
        // The path comes exclusively from this native user-facing dialog.
        // No generic filesystem command or caller-supplied path is exposed.
        let selected = app
            .dialog()
            .file()
            .set_parent(&window)
            .set_title("Export library")
            .set_file_name(&filename)
            .add_filter("HanStream library", &["json"])
            .blocking_save_file();
        let Some(file) = selected else {
            return Ok(false);
        };
        let path = file.into_path().map_err(|_| "Choose a local JSON file")?;
        if !path.is_absolute()
            || !path
                .extension()
                .and_then(|v| v.to_str())
                .is_some_and(|v| v.eq_ignore_ascii_case("json"))
        {
            return Err("Choose a file with a .json extension".into());
        }
        let parent = path.parent().ok_or("Choose a local JSON file")?;
        let mut backup = tempfile::Builder::new()
            .prefix(".hanstream-export-")
            .tempfile_in(parent)
            .map_err(|_| "Library could not be saved to the selected folder")?;
        backup
            .write_all(content.as_bytes())
            .map_err(|_| "Library export could not be written")?;
        backup
            .as_file()
            .sync_all()
            .map_err(|_| "Library export could not be saved")?;
        backup
            .persist(path)
            .map_err(|_| "Library could not replace the selected file")?;
        Ok(true)
    })
    .await
    .map_err(|_| "Library export could not finish".to_string())?
}
