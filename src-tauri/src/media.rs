use std::{path::PathBuf, sync::Mutex};
use tauri::{
    webview::{NewWindowResponse, PermissionResponse},
    Emitter, EventTarget, LogicalPosition, LogicalSize, Manager, Rect, State, Url, Webview,
    WebviewBuilder, WebviewUrl,
};

pub struct MediaState {
    pub active: Mutex<Option<String>>,
    pub directory: PathBuf,
    pub origins: Vec<String>,
}

fn local_caller(caller: &Webview) -> Result<(), String> {
    let url = caller.url().map_err(|_| "Invalid caller")?;
    if caller.label() == "main"
        && url.scheme() == "https"
        && url.host_str() == Some("tauri.localhost")
        && url.port().is_none()
    {
        Ok(())
    } else {
        Err("Only the local app can control playback".into())
    }
}

fn label(session: &str) -> Result<String, String> {
    if session.len() != 32 || !session.bytes().all(|byte| byte.is_ascii_hexdigit()) {
        return Err("Invalid player session".into());
    }
    Ok(format!("media-{session}"))
}

fn allowed(url: &Url, origins: &[String]) -> bool {
    let host = url.host_str().unwrap_or_default();
    if url.scheme() != "https"
        || !url.username().is_empty()
        || url.password().is_some()
        || url.port().is_some()
        || !host.contains('.')
        || host.contains(':')
        || host.parse::<std::net::IpAddr>().is_ok()
        || [".local", ".localhost", ".internal"]
            .iter()
            .any(|suffix| host.ends_with(suffix))
    {
        return false;
    }
    #[cfg(feature = "automation")]
    if url.origin().ascii_serialization() == "https://media.example" {
        return true;
    }
    origins.contains(&url.origin().ascii_serialization())
}

fn bounds(x: f64, y: f64, width: f64, height: f64) -> Result<Rect, String> {
    if ![x, y, width, height].iter().all(|value| value.is_finite())
        || x.abs() > 100_000.0
        || y.abs() > 100_000.0
        || !(1.0..=10_000.0).contains(&width)
        || !(1.0..=10_000.0).contains(&height)
    {
        return Err("Invalid player bounds".into());
    }
    Ok(Rect {
        position: LogicalPosition::new(x, y).into(),
        size: LogicalSize::new(width, height).into(),
    })
}

pub fn close_active(app: &tauri::AppHandle) {
    if let Some(state) = app.try_state::<MediaState>() {
        if let Ok(mut active) = state.active.lock() {
            if let Some(label) = active.take() {
                if let Some(view) = app.get_webview(&label) {
                    let _ = view.close();
                }
            }
        }
    }
}

#[tauri::command]
pub async fn media_open(
    app: tauri::AppHandle,
    caller: Webview,
    state: State<'_, MediaState>,
    session: String,
    url: String,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
) -> Result<(), String> {
    local_caller(&caller)?;
    let label = label(&session)?;
    let url = Url::parse(&url).map_err(|_| "Invalid player URL")?;
    if !allowed(&url, &state.origins) {
        return Err("This player origin is not configured".into());
    }
    let rectangle = bounds(x, y, width, height)?;
    let previous = state
        .active
        .lock()
        .map_err(|_| "Player is busy")?
        .replace(label.clone());
    if let Some(previous) = previous {
        if let Some(view) = app.get_webview(&previous) {
            let _ = view.close();
        }
    }
    let window = app.get_window("main").ok_or("App window is unavailable")?;
    std::fs::create_dir_all(&state.directory).map_err(|_| "Could not prepare player storage")?;
    let origins = state.origins.clone();
    let player_path = url.path().to_string();
    let emitter = app.clone();
    let event_session = session.clone();
    let builder = WebviewBuilder::new(
        &label,
        WebviewUrl::External(Url::parse("about:blank").unwrap()),
    )
    .data_directory(state.directory.clone())
    .initialization_script_for_all_frames(include_str!("../../resources/player-guard.js"))
    .on_navigation(move |url| {
        url.as_str() == "about:blank" || allowed(url, &origins) && url.path() == player_path
    })
    .on_new_window(|_, _| NewWindowResponse::Deny)
    .on_permission_request(|_, _| PermissionResponse::Deny)
    .on_download(|_, _| false)
    .on_page_load(move |_, payload| {
        if payload.url().scheme() == "https"
            && matches!(payload.event(), tauri::webview::PageLoadEvent::Finished)
        {
            let _ = emitter.emit_to(
                EventTarget::webview("main"),
                "media-loaded",
                event_session.clone(),
            );
        }
    });
    #[cfg(feature = "automation")]
    let builder = builder.additional_browser_args(
        "--remote-debugging-port=9224 --remote-debugging-address=127.0.0.1 --disable-gpu",
    );
    let view = window
        .add_child(builder, rectangle.position, rectangle.size)
        .map_err(|_| "Could not create the isolated player")?;
    if state.active.lock().map_err(|_| "Player is busy")?.as_ref() != Some(&label) {
        let _ = view.close();
        return Err("Player request was replaced".into());
    }
    if let Err(error) = crate::privacy::install(&view, url, state.origins.clone()).await {
        let _ = view.close();
        return Err(error);
    }
    Ok(())
}

#[tauri::command]
pub async fn media_resize(
    caller: Webview,
    app: tauri::AppHandle,
    state: State<'_, MediaState>,
    session: String,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
    visible: bool,
) -> Result<(), String> {
    local_caller(&caller)?;
    let label = label(&session)?;
    let rectangle = bounds(x, y, width, height)?;
    if state.active.lock().map_err(|_| "Player is busy")?.as_ref() != Some(&label) {
        return Ok(());
    }
    if let Some(view) = app.get_webview(&label) {
        if visible {
            view.set_bounds(rectangle)
                .map_err(|_| "Could not resize player")?;
            view.show().map_err(|_| "Could not show player")?;
        } else {
            view.hide().map_err(|_| "Could not hide player")?;
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn media_close(
    caller: Webview,
    app: tauri::AppHandle,
    state: State<'_, MediaState>,
    session: String,
) -> Result<(), String> {
    local_caller(&caller)?;
    let label = label(&session)?;
    {
        let mut active = state.active.lock().map_err(|_| "Player is busy")?;
        if active.as_ref() == Some(&label) {
            *active = None;
        }
    }
    if let Some(view) = app.get_webview(&label) {
        view.close().map_err(|_| "Could not close player")?;
    }
    Ok(())
}
