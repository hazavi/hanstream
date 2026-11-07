#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::atomic::{AtomicBool, Ordering};
use tauri::webview::{NewWindowResponse, PermissionResponse};
use tauri::Manager;
mod export;
mod media;
mod privacy;
mod storage;

static ACTIVATE_WHEN_READY: AtomicBool = AtomicBool::new(false);

fn activate_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        if ACTIVATE_WHEN_READY.swap(false, Ordering::AcqRel) {
            let _ = window.unminimize();
            let _ = window.show();
            let _ = window.set_focus();
        }
    }
}

fn main() {
    #[cfg(feature = "automation")]
    {
        // Check the actual embedded rules separately from browser tracking protection.
        assert!(privacy::blocked("https://ad.doubleclick.net/check.js", &[]));
        assert!(privacy::blocked(
            "https://child.ad.doubleclick.net/check.js",
            &[]
        ));
        assert!(!privacy::blocked(
            "https://not-doubleclick.example/check.js",
            &[]
        ));
        assert!(!privacy::blocked("https://content.example/check.js", &[]));
        assert!(!privacy::blocked(
            "https://ad.doubleclick.net/check.js",
            &["https://ad.doubleclick.net".into()]
        ));
        assert!(privacy::blocked("https://203.0.113.1/check.js", &[]));
    }
    // Register first: repeated launches must exit before opening SQLite or WebViews.
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _, _| {
            // Windows can deliver activation while WebView2 is still creating
            // the first window. Keep that request until it is registered.
            ACTIVATE_WHEN_READY.store(true, Ordering::Release);
            activate_main_window(app);
        }))
        .plugin(tauri_plugin_dialog::init());
    #[cfg(feature = "signed-updates")]
    let builder = builder.plugin(tauri_plugin_updater::Builder::new().build());

    builder
        .on_window_event(|window, event| {
            if window.label() == "main"
                && matches!(event, tauri::WindowEvent::CloseRequested { .. })
            {
                // The isolated media surface must not keep the process alive after
                // the only app window closes. Exit also releases SQLite and WebView2.
                media::close_active(window.app_handle());
                window.app_handle().exit(0);
            }
        })
        .invoke_handler(tauri::generate_handler![
            storage::library_load,
            storage::library_save,
            storage::library_clear,
            export::library_export,
            storage::cache_load,
            storage::cache_save,
            media::media_open,
            media::media_resize,
            media::media_close
        ])
        .setup(|app| {
            #[cfg(not(feature = "automation"))]
            let data_directory = app.path().app_data_dir()?;
            #[cfg(feature = "automation")]
            let data_directory = std::path::PathBuf::from(
                std::env::var("HANSTREAM_TEST_DATA_DIR")
                    .expect("Automation requires an isolated data directory"),
            );
            app.manage(storage::Storage::open(&data_directory)?);
            app.manage(export::ExportState::default());
            let origins = app
                .config()
                .plugins
                .0
                .get("media")
                .and_then(|value| value.get("origins"))
                .and_then(|value| value.as_array())
                .map(|values| {
                    values
                        .iter()
                        .filter_map(|value| value.as_str().map(String::from))
                        .collect()
                })
                .unwrap_or_default();
            app.manage(media::MediaState {
                active: std::sync::Mutex::new(None),
                directory: data_directory.join("media-browser"),
                origins,
            });
            let navigation_app = app.handle().clone();
            let window =
                tauri::WebviewWindowBuilder::from_config(app, &app.config().app.windows[0])?
                    .on_navigation(|url| {
                        (url.scheme() == "https"
                            && url.host_str() == Some("tauri.localhost")
                            && url.port().is_none())
                            || (url.scheme() == "tauri" && url.host_str() == Some("localhost"))
                    })
                    .on_new_window(|_, _| NewWindowResponse::Deny)
                    .on_permission_request(|_, _| PermissionResponse::Deny)
                    .on_download(|_, _| false)
                    .on_page_load(move |_, payload| {
                        if matches!(payload.event(), tauri::webview::PageLoadEvent::Started) {
                            media::close_active(&navigation_app);
                        }
                    });
            // CI builds this separate harness; installers never enable this feature.
            #[cfg(feature = "automation")]
            let window = window
                .data_directory(data_directory.join("app-browser"))
                .additional_browser_args(
                "--remote-debugging-port=9223 --remote-debugging-address=127.0.0.1 --disable-gpu",
            );
            window.build()?;
            activate_main_window(app.handle());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("Could not start the desktop application");
}
