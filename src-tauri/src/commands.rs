use std::path::{Path, PathBuf};
use std::sync::Mutex;

use serde::Serialize;
use tauri::{AppHandle, Manager, Runtime, State, WebviewWindow, Window};

use crate::files::{self, BuiltModelPath, FileStamp, ModelReadResult, ModelWriteResult, PathStat};
use crate::identity::AppIdentity;
use crate::logging::{SCOPE_MEASURE, SCOPE_PREFERENCES, SCOPE_RECENTS, SCOPE_WINDOW_STATE};
use crate::places::{self, Place, PlaceSources};
use crate::recents::{self, RecentEntry, RecentEntryInput, RecentListEntry};
use crate::measure::{self, StartupClock};
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
    pub fn new(code: &str, message: impl Into<String>) -> Self {
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

/// Lista de recientes viva del proceso: la ruta del archivo y la copia en memoria.
pub struct RecentsState {
    pub path: PathBuf,
    pub current: Mutex<Vec<RecentEntry>>,
}

impl RecentsState {
    /// @param path Ruta de `recents.json` dentro del directorio de configuración.
    pub fn new(path: PathBuf) -> Self {
        Self { path, current: Mutex::new(Vec::new()) }
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

/// Anota en el registro los milisegundos de arranque hasta la Bienvenida (SC-001).
///
/// No hace nada salvo que la aplicación se haya arrancado con
/// `SQL_DESIGNER_MEDIR=1`, y solo informa la primera vez de cada ejecución.
///
/// @param splash Si llegó a verse la pantalla de carga; queda anotado porque
/// cambia lo que mide el número.
/// @returns Los milisegundos anotados, o `None` si la medida está apagada o
/// ya se informó.
#[tauri::command]
pub fn measure_startup_ready(clock: State<'_, StartupClock>, splash: bool) -> Option<u128> {
    if !measure::enabled() {
        return None;
    }
    let millis = clock.elapsed_once()?;
    let visto = if splash { "sí" } else { "no" };
    log::info!(target: SCOPE_MEASURE, "SC-001 bienvenida lista en {millis} ms (pantalla de carga: {visto})");
    Some(millis)
}

/// Anota en el registro los milisegundos del cambio de tema (SC-003).
///
/// Como [`measure_startup_ready`], calla salvo que las medidas estén
/// encendidas.
///
/// @param millis Milisegundos entre la elección en Ajustes y el primer
/// fotograma ya pintado con el tema nuevo.
#[tauri::command]
pub fn measure_theme_applied(millis: f64) {
    if !measure::enabled() {
        return;
    }
    log::info!(target: SCOPE_MEASURE, "SC-003 tema aplicado en {millis:.0} ms");
}

/// Ubicaciones del usuario para la barra lateral de los diálogos (FR-007, FR-012).
///
/// Nunca falla: una ubicación que no se puede resolver simplemente no se
/// lista (`research.md` R6).
#[tauri::command]
pub async fn fs_user_places<R: Runtime>(app: AppHandle<R>) -> Vec<Place> {
    let resolver = app.path();
    let home = resolver.home_dir().ok();
    let sources = PlaceSources {
        desktop: resolver.desktop_dir().ok(),
        documents: resolver.document_dir().ok(),
        downloads: resolver.download_dir().ok(),
        icloud: places::icloud_path(home.as_ref()),
        home,
        root: Some(places::root_path()),
    };
    places::build_places(&sources)
}

/// Anota los milisegundos que tardó en abrirse un modelo (SC-002).
///
/// Como el resto de las medidas, calla salvo que el binario se haya arrancado
/// con `SQL_DESIGNER_MEDIR=1` (`research.md` R15).
///
/// @param millis Tiempo entre la orden de abrir y el modelo pintado.
/// @param tables Número de tablas del modelo, que es lo que hace variar la medida.
/// @returns Los milisegundos anotados, o `None` si la medida está apagada.
#[tauri::command]
pub fn measure_model_opened(millis: f64, tables: u32) -> Option<f64> {
    if !measure::enabled() {
        return None;
    }
    log::info!(target: SCOPE_MEASURE, "SC-002 modelo abierto en {millis:.0} ms ({tables} tablas)");
    Some(millis)
}

/// Anota los milisegundos que tardó en guardarse un modelo (SC-003).
///
/// @param millis Tiempo entre el atajo de guardar y el archivo ya escrito.
/// @param tables Número de tablas del modelo.
/// @returns Los milisegundos anotados, o `None` si la medida está apagada.
#[tauri::command]
pub fn measure_model_saved(millis: f64, tables: u32) -> Option<f64> {
    if !measure::enabled() {
        return None;
    }
    log::info!(target: SCOPE_MEASURE, "SC-003 modelo guardado en {millis:.0} ms ({tables} tablas)");
    Some(millis)
}

/// Arma la ruta final del archivo del modelo y dice si ya existe (FR-002, FR-003).
///
/// El frontend nunca concatena separadores ni añade la extensión: el nombre
/// llega saneado por `src/lib/model/slug.ts` y la ruta la arma Rust
/// (`research.md` R9).
///
/// @param folder Carpeta elegida para el modelo.
/// @param file_stem Nombre del archivo sin extensión.
#[tauri::command]
pub async fn path_build_model(
    folder: String,
    file_stem: String,
) -> Result<BuiltModelPath, AppError> {
    files::build_model_path(Path::new(&folder), &file_stem)
}

/// Lee el archivo del modelo como texto, con su sello (FR-013, FR-015).
///
/// Rust no interpreta el YAML: un archivo que no parsea vuelve bien de aquí y
/// es la validación del frontend la que decide (FR-016, `research.md` R1).
///
/// @param path Ruta absoluta del archivo del modelo.
#[tauri::command]
pub async fn model_read(path: String) -> Result<ModelReadResult, AppError> {
    files::read_model(Path::new(&path))
}

/// Escribe el archivo del modelo de forma atómica (FR-021 a FR-025).
///
/// @param path Ruta absoluta del archivo.
/// @param text Contenido completo que se guarda.
/// @param expected_stamp Sello de la última lectura o escritura; ausente al crear.
/// @param force `true` para sobrescribir tras confirmar un `model_stale`.
#[tauri::command]
pub async fn model_write(
    path: String,
    text: String,
    expected_stamp: Option<FileStamp>,
    force: Option<bool>,
) -> Result<ModelWriteResult, AppError> {
    files::write_model(Path::new(&path), &text, expected_stamp, force.unwrap_or(false))
}

/// Estado en disco de varias rutas, de una sola llamada (FR-031).
///
/// Nunca falla: una ruta inaccesible vuelve como `exists: false`.
///
/// @param paths Rutas absolutas a consultar.
#[tauri::command]
pub async fn model_stat(paths: Vec<String>) -> Vec<PathStat> {
    files::stat_paths(&paths)
}

/// Lista de recientes con el estado del archivo ya resuelto (FR-029, FR-031).
///
/// No falla por un `recents.json` dañado: devuelve la lista vacía y deja la
/// causa en el registro.
#[tauri::command]
pub async fn recents_list(state: State<'_, RecentsState>) -> Result<Vec<RecentListEntry>, AppError> {
    let entries = {
        let current = state
            .current
            .lock()
            .map_err(|error| AppError::new("recents_write_failed", error.to_string()))?;
        current.clone()
    };
    Ok(recents::with_disk_state(&entries))
}

/// Registra o actualiza una entrada de recientes y la pone primera (FR-029, FR-032).
///
/// @param entry Datos cacheados del modelo que se acaba de usar.
#[tauri::command]
pub async fn recents_touch(
    state: State<'_, RecentsState>,
    entry: RecentEntryInput,
) -> Result<Vec<RecentListEntry>, AppError> {
    let entries = {
        let mut current = state
            .current
            .lock()
            .map_err(|error| AppError::new("recents_write_failed", error.to_string()))?;
        recents::touch(&mut current, entry, recents::now_ms())
    };
    persist_recents(&state, &entries)?;
    Ok(recents::with_disk_state(&entries))
}

/// Quita una entrada de recientes; el archivo no se toca (FR-034).
///
/// @param path Ruta de la entrada que sale de la lista.
#[tauri::command]
pub async fn recents_remove(
    state: State<'_, RecentsState>,
    path: String,
) -> Result<Vec<RecentListEntry>, AppError> {
    let entries = {
        let mut current = state
            .current
            .lock()
            .map_err(|error| AppError::new("recents_write_failed", error.to_string()))?;
        recents::remove(&mut current, &path)
    };
    persist_recents(&state, &entries)?;
    Ok(recents::with_disk_state(&entries))
}

/// Persiste la lista de recientes y traduce el fallo al código del contrato.
fn persist_recents(state: &RecentsState, entries: &[RecentEntry]) -> Result<(), AppError> {
    if let Err(error) = recents::save_to(&state.path, entries) {
        log::error!(target: SCOPE_RECENTS, "no se pudieron guardar los recientes: {error}");
        return Err(AppError::new("recents_write_failed", error));
    }
    Ok(())
}
