use tauri::plugin::TauriPlugin;
use tauri::Wry;
use tauri_plugin_log::{Builder, RotationStrategy, Target, TargetKind};

/// Ámbitos de registro de este incremento (FR-019).
pub const SCOPE_STARTUP: &str = "startup";
/// Ámbito de los errores al leer o escribir preferencias.
pub const SCOPE_PREFERENCES: &str = "preferences";
/// Ámbito de los errores de geometría y de tema de la ventana.
pub const SCOPE_WINDOW_STATE: &str = "window-state";
/// Ámbito de las medidas de SC-001 y SC-003, apagadas salvo que se pidan.
pub const SCOPE_MEASURE: &str = "medidas";

/// Registro local de avisos y errores, sin ningún destino de red
/// (principio I de la constitución).
///
/// Escribe en el directorio de logs de la aplicación, rota por tamaño y
/// conserva solo los niveles `warn` y `error`: nada de trazas de uso. La
/// única excepción es el ámbito `medidas`, que admite `info` y solo escribe
/// cuando se arranca con `SQL_DESIGNER_MEDIR=1` para la verificación manual.
pub fn plugin() -> TauriPlugin<Wry> {
    Builder::new()
        .level(log::LevelFilter::Warn)
        .level_for(SCOPE_MEASURE, log::LevelFilter::Info)
        .max_file_size(512 * 1024)
        .rotation_strategy(RotationStrategy::KeepOne)
        .targets([
            Target::new(TargetKind::LogDir { file_name: Some("sql-designer".into()) }),
            Target::new(TargetKind::Stderr),
        ])
        .build()
}
