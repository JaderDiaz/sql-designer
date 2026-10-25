use std::path::PathBuf;
use std::sync::Mutex;

use serde::Serialize;
use tauri::{AppHandle, Runtime, State, WebviewWindow, Window};

use crate::identity::AppIdentity;
use crate::logging::{SCOPE_PREFERENCES, SCOPE_WINDOW_STATE};
use crate::preferences::{self, Preferences, PreferencesLoadResult, PreferencesPatch, Theme};
use crate::window_state::{self, GeometryApplyResult, MonitorArea};

/// Error que cruza la frontera hacia TypeScript. Ningún comando entra en
/// pánico: todo fallo viaja como valor (principio III de la constitución).
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppError {
    pub code: String,
    pub message: String,
}

impl AppError {
    /// Construye un error con uno de los códigos del contrato.
    fn new(code: &str, message: impl Into<String>) -> Self {
        Self { code: code.to_string(), message: message.into() }
    }
}

/// Preferencias vivas del proceso: la ruta del archivo y la copia en memoria.
pub struct PreferencesState {
    pub path: PathBuf,
    pub current: Mutex<Preferences>,
}

impl PreferencesState {
    /// @param path Ruta del archivo de preferencias dentro del directorio de configuración.
    pub fn new(path: PathBuf) -> Self {
        Self { path, current: Mutex::new(Preferences::default()) }
    }
}

/// Sistema en ejecución y símbolos de modificador que la interfaz muestra (RS-12).
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlatformInfo {
    pub os: String,
    pub modifier_symbols: ModifierSymbols,
}

/// Símbolos de las teclas modificadoras, resueltos en Rust para no repartir
/// suposiciones de sistema operativo por los componentes.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModifierSymbols {
    pub meta: String,
    pub alt: String,
    pub del: String,
}

/// Identidad del binario: nombre, versión y fecha de compilación (FR-002).
#[tauri::command]
pub fn app_identity<R: Runtime>(app: AppHandle<R>) -> AppIdentity {
    AppIdentity::new(&app.package_info().version.to_string())
}

/// Sistema y símbolos de atajo. En cualquier sistema que no sea macOS se usan
/// los textos de Windows, que son los otros dos soportados por el producto.
#[tauri::command]
pub fn platform_info() -> PlatformInfo {
    if cfg!(target_os = "macos") {
        PlatformInfo {
            os: "macos".to_string(),
            modifier_symbols: ModifierSymbols {
                meta: "⌘".to_string(),
                alt: "⌥".to_string(),
                del: "⌫".to_string(),
            },
        }
    } else {
        PlatformInfo {
            os: "windows".to_string(),
            modifier_symbols: ModifierSymbols {
                meta: "Ctrl".to_string(),
                alt: "Alt".to_string(),
                del: "Supr".to_string(),
            },
        }
    }
}

/// Carga las preferencias al arrancar y las guarda en memoria (FR-016).
///
/// Un archivo ilegible no es un error: vuelve como `recovered` con su causa.
#[tauri::command]
pub fn preferences_load(
    state: State<'_, PreferencesState>,
) -> Result<PreferencesLoadResult, AppError> {
    let result = preferences::load_from(&state.path);
    let mut current = state
        .current
        .lock()
        .map_err(|error| AppError::new("preferences_unreadable", error.to_string()))?;
    *current = result.preferences.clone();
    Ok(result)
}

/// Guarda un cambio parcial de preferencias (FR-008, FR-009).
///
/// Pasos: aplica el parche sobre la copia en memoria, escribe de forma
/// atómica, y si la escritura falla deja en memoria el valor anterior y
/// devuelve `preferences_write_failed` para que la pantalla avise.
#[tauri::command]
pub fn preferences_update<R: Runtime>(
    window: WebviewWindow<R>,
    state: State<'_, PreferencesState>,
    patch: PreferencesPatch,
) -> Result<Preferences, AppError> {
    let mut current = state
        .current
        .lock()
        .map_err(|error| AppError::new("preferences_write_failed", error.to_string()))?;

    let next = preferences::apply_patch(&current, &patch);
    if let Err(error) = preferences::save_to(&state.path, &next) {
        log::error!(target: SCOPE_PREFERENCES, "no se pudieron guardar las preferencias: {error}");
        return Err(AppError::new("preferences_write_failed", error));
    }

    *current = next.clone();
    apply_native_theme(&window, next.theme);
    Ok(next)
}

/// Avisa al sistema del tema elegido para que el cromo nativo acompañe a la
/// interfaz; con «Sistema» se devuelve la decisión al sistema operativo.
fn apply_native_theme<R: Runtime>(window: &WebviewWindow<R>, theme: Theme) {
    let native = match theme {
        Theme::System => None,
        Theme::Light => Some(tauri::Theme::Light),
        Theme::Dark => Some(tauri::Theme::Dark),
    };
    if let Err(error) = window.set_theme(native) {
        log::warn!(target: SCOPE_WINDOW_STATE, "no se pudo aplicar el tema nativo: {error}");
    }
}

/// Restaura tamaño y posición recordados, recortados al área visible (FR-018).
///
/// Pasos: lee la geometría de las preferencias; si no hay ninguna, deja la
/// ventana centrada con su tamaño por defecto; si hay, la recorta a los
/// monitores conectados y la aplica, informando si hubo que corregirla.
#[tauri::command]
pub fn window_apply_saved_geometry<R: Runtime>(
    window: WebviewWindow<R>,
    state: State<'_, PreferencesState>,
) -> Result<GeometryApplyResult, AppError> {
    let geometry = {
        let current = state
            .current
            .lock()
            .map_err(|error| AppError::new("window_state_failed", error.to_string()))?;
        current.window
    };

    let Some(geometry) = geometry else {
        return Ok(GeometryApplyResult { applied: false, clamped: false });
    };

    let monitors = logical_monitors(&window)?;
    let primary = primary_monitor(&window)?;
    let (clamped_geometry, clamped) = window_state::clamp_to_monitors(geometry, &monitors, primary);

    window
        .set_size(tauri::LogicalSize::new(clamped_geometry.width, clamped_geometry.height))
        .map_err(|error| AppError::new("window_state_failed", error.to_string()))?;
    window
        .set_position(tauri::LogicalPosition::new(clamped_geometry.x, clamped_geometry.y))
        .map_err(|error| AppError::new("window_state_failed", error.to_string()))?;

    if clamped {
        log::warn!(
            target: SCOPE_WINDOW_STATE,
            "geometría recordada fuera del área visible; se recortó a {clamped_geometry:?}"
        );
    }

    Ok(GeometryApplyResult { applied: true, clamped })
}

/// Monitores conectados en píxeles lógicos.
fn logical_monitors<R: Runtime>(window: &WebviewWindow<R>) -> Result<Vec<MonitorArea>, AppError> {
    let monitors = window
        .available_monitors()
        .map_err(|error| AppError::new("window_state_failed", error.to_string()))?;
    Ok(monitors.iter().map(to_logical_area).collect())
}

/// Monitor principal, o el primero disponible si el sistema no declara uno.
fn primary_monitor<R: Runtime>(window: &WebviewWindow<R>) -> Result<MonitorArea, AppError> {
    if let Ok(Some(monitor)) = window.primary_monitor() {
        return Ok(to_logical_area(&monitor));
    }
    window
        .available_monitors()
        .ok()
        .and_then(|monitors| monitors.first().map(to_logical_area))
        .ok_or_else(|| AppError::new("window_state_failed", "sin monitores conectados"))
}

/// Pasa un monitor de píxeles físicos a lógicos (`research.md` §3).
fn to_logical_area(monitor: &tauri::Monitor) -> MonitorArea {
    let scale = monitor.scale_factor();
    let position = monitor.position();
    let size = monitor.size();
    MonitorArea {
        x: window_state::to_logical(position.x.unsigned_abs(), scale) as i32
            * position.x.signum().max(-1),
        y: window_state::to_logical(position.y.unsigned_abs(), scale) as i32
            * position.y.signum().max(-1),
        width: window_state::to_logical(size.width, scale),
        height: window_state::to_logical(size.height, scale),
    }
}

/// Acciones de los controles propios de la barra de título (FR-012).
///
/// En macOS solo se usa `start_drag`: minimizar, maximizar y cerrar son los
/// botones nativos del sistema.
#[tauri::command]
pub fn window_controls<R: Runtime>(
    window: WebviewWindow<R>,
    action: String,
) -> Result<(), AppError> {
    let result = match action.as_str() {
        "minimize" => window.minimize(),
        "toggle_maximize" => {
            if window.is_maximized().unwrap_or(false) {
                window.unmaximize()
            } else {
                window.maximize()
            }
        }
        "close" => window.close(),
        "start_drag" => window.start_dragging(),
        other => {
            return Err(AppError::new(
                "window_state_failed",
                format!("acción de ventana desconocida: {other}"),
            ))
        }
    };

    result.map_err(|error| AppError::new("window_state_failed", error.to_string()))
}

/// Guarda la geometría actual de la ventana en las preferencias.
///
/// Se llama al cerrar: el plugin de estado de ventana ya persiste su propio
/// archivo, pero las preferencias son la fuente que lee `window_apply_saved_geometry`.
pub fn remember_geometry<R: Runtime>(window: &Window<R>, state: &PreferencesState) {
    let Ok(scale) = window.scale_factor() else { return };
    let Ok(position) = window.outer_position() else { return };
    let Ok(size) = window.inner_size() else { return };

    let geometry = crate::preferences::WindowGeometry {
        x: window_state::to_logical(position.x.unsigned_abs(), scale) as i32
            * position.x.signum().max(-1),
        y: window_state::to_logical(position.y.unsigned_abs(), scale) as i32
            * position.y.signum().max(-1),
        width: window_state::to_logical(size.width, scale),
        height: window_state::to_logical(size.height, scale),
    };

    let Ok(mut current) = state.current.lock() else { return };
    current.window = Some(geometry);
    if let Err(error) = preferences::save_to(&state.path, &current) {
        log::warn!(target: SCOPE_WINDOW_STATE, "no se pudo guardar la geometría: {error}");
    }
}
