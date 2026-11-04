fn main() {
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&[
            "library_load",
            "library_save",
            "library_clear",
            "cache_load",
            "cache_save",
        ]),
    ))
    .expect("Could not prepare application permissions");
}
