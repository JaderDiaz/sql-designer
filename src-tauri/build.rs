use chrono::Local;

/// Compila el contenedor Tauri e inyecta la fecha de compilación como
/// variable de entorno `SQL_DESIGNER_BUILD_DATE` con formato `AAAA.MM.DD`,
/// que es lo que la Bienvenida muestra junto a la versión (FR-002).
fn main() {
    let date = Local::now().format("%Y.%m.%d");
    println!("cargo:rustc-env=SQL_DESIGNER_BUILD_DATE={date}");
    println!("cargo:rerun-if-changed=build.rs");
    tauri_build::build();
}
