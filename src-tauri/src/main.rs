#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::webview::{DownloadEvent, NewWindowResponse, PermissionResponse};
use tauri::Manager;
mod storage;

fn main() {
    let builder = tauri::Builder::default();
    #[cfg(feature = "signed-updates")]
    let builder = builder.plugin(tauri_plugin_updater::Builder::new().build());

    builder
        .invoke_handler(tauri::generate_handler![storage::library_load, storage::library_save, storage::library_clear, storage::cache_load, storage::cache_save])
        .setup(|app| {
            app.manage(storage::Storage::open(&app.path().app_data_dir()?)?);
            let window = tauri::WebviewWindowBuilder::from_config(app, &app.config().app.windows[0])?
                .on_navigation(|url| {
                    (url.scheme() == "https" && url.host_str() == Some("tauri.localhost") && url.port().is_none())
                        || (url.scheme() == "tauri" && url.host_str() == Some("localhost"))
                })
                .on_new_window(|_, _| NewWindowResponse::Deny)
                .on_permission_request(|_, _| PermissionResponse::Deny)
                .on_download(|_, event| match event {
                    DownloadEvent::Requested { url, .. } => {
                        url.as_str().starts_with("blob:https://tauri.localhost/")
                            || url.as_str().starts_with("blob:tauri://localhost/")
                    }
                    _ => true,
                });
            // CI builds this separate harness; installers never enable this feature.
            #[cfg(feature = "automation")]
            let window = window.additional_browser_args(
                "--remote-debugging-port=9223 --remote-debugging-address=127.0.0.1 --disable-gpu",
            );
            window.build()?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("Could not start the desktop application");
}
