fn main() {
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&[
            "library_load",
            "library_save",
            "library_clear",
            "cache_load",
            "cache_save",
            "media_open",
            "media_resize",
            "media_close",
        ]),
    ))
    .expect("Could not prepare application permissions");
}
