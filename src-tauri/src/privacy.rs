use std::{collections::HashSet, sync::OnceLock};
use tauri::Url;

fn hosts() -> &'static HashSet<&'static str> {
    static HOSTS: OnceLock<HashSet<&'static str>> = OnceLock::new();
    HOSTS.get_or_init(|| {
        include_str!("../../resources/network-blocklist.txt")
            .lines()
            .collect()
    })
}

pub fn blocked(value: &str, player_origins: &[String]) -> bool {
    let Ok(url) = Url::parse(value) else {
        return true;
    };
    if !matches!(url.scheme(), "https" | "http") {
        return false;
    }
    let Some(host) = url.host_str() else {
        return true;
    };
    let host = host.trim_end_matches('.');
    if !host.contains('.')
        || host.ends_with(".local")
        || host.ends_with(".localhost")
        || host.ends_with(".internal")
        || host
            .trim_matches(['[', ']'])
            .parse::<std::net::IpAddr>()
            .is_ok()
    {
        return true;
    }
    if player_origins.contains(&url.origin().ascii_serialization()) {
        return false;
    }
    let mut suffix = host;
    loop {
        if hosts().contains(suffix) {
            return true;
        }
        let Some((_, rest)) = suffix.split_once('.') else {
            return false;
        };
        suffix = rest;
    }
}

#[cfg(windows)]
pub async fn install(
    view: &tauri::Webview,
    target: Url,
    origins: Vec<String>,
) -> Result<(), String> {
    use webview2_com::Microsoft::Web::WebView2::Win32::*;
    use webview2_com::{take_pwstr, WebResourceRequestedEventHandler};
    use windows::core::{w, Interface, HSTRING, PWSTR};
    let (sender, receiver) = std::sync::mpsc::sync_channel(1);
    view.with_webview(move |platform| {
        let result = (|| -> windows::core::Result<()> {
            unsafe {
                let webview = platform.controller().CoreWebView2()?;
                let environment = platform.environment();
                // Restrict script dialogs without changing SmartScreen or browser security.
                webview
                    .Settings()?
                    .SetAreDefaultScriptDialogsEnabled(false)?;
                for filter in [w!("https://*"), w!("http://*")] {
                    if let Ok(modern) = webview.cast::<ICoreWebView2_22>() {
                        modern.AddWebResourceRequestedFilterWithRequestSourceKinds(
                            filter,
                            COREWEBVIEW2_WEB_RESOURCE_CONTEXT_ALL,
                            COREWEBVIEW2_WEB_RESOURCE_REQUEST_SOURCE_KINDS_ALL,
                        )?;
                    } else {
                        webview.AddWebResourceRequestedFilter(
                            filter,
                            COREWEBVIEW2_WEB_RESOURCE_CONTEXT_ALL,
                        )?;
                    }
                }
                let mut token = 0;
                webview.add_WebResourceRequested(
                    &WebResourceRequestedEventHandler::create(Box::new(move |_, args| {
                        if let Some(args) = args {
                            let request = args.Request()?;
                            let mut uri = PWSTR::null();
                            request.Uri(&mut uri)?;
                            if blocked(&take_pwstr(uri), &origins) {
                                let response = environment.CreateWebResourceResponse(
                                    None,
                                    403,
                                    w!("Blocked by player protection"),
                                    w!("Cache-Control: no-store\r\nContent-Length: 0\r\n"),
                                )?;
                                args.SetResponse(&response)?;
                            }
                        }
                        Ok(())
                    })),
                    &mut token,
                )?;
                // Navigate only after interception is installed, so the first ad request is covered.
                webview.Navigate(&HSTRING::from(target.as_str()))?;
            }
            Ok(())
        })();
        let _ = sender.send(result.map_err(|_| "Could not enable player protection".to_string()));
    })
    .map_err(|_| "Could not initialize player protection".to_string())?;
    tauri::async_runtime::spawn_blocking(move || {
        receiver
            .recv_timeout(std::time::Duration::from_secs(10))
            .map_err(|_| "Player protection initialization timed out".to_string())
    })
    .await
    .map_err(|_| "Player protection initialization failed".to_string())??
}

#[cfg(not(windows))]
pub async fn install(
    _view: &tauri::Webview,
    _target: Url,
    _origins: Vec<String>,
) -> Result<(), String> {
    Err("Native request filtering is currently supported on Windows".into())
}
