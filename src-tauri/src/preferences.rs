use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

use crate::logging::SCOPE_PREFERENCES;

/// Versión del formato que esta build sabe leer (data-model.md).
pub const FORMAT_VERSION: u32 = 1;

/// Tamaño mínimo de ventana en píxeles lógicos (FR-013).
pub const MIN_WIDTH: u32 = 820;
/// Alto mínimo de ventana en píxeles lógicos (FR-013).
pub const MIN_HEIGHT: u32 = 500;

/// Preferencia de tema. `System` sigue al sistema operativo (FR-007).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Theme {
    #[default]
    System,
    Light,
    Dark,
}

/// Motor por defecto de los modelos nuevos (FR-004, RS-10).
///
/// Solo fija el motor **inicial** de Nuevo modelo: el motor de cada modelo
/// viaja dentro de su archivo.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Engine {
    #[default]
    Postgres,
    Mysql,
    Sqlite,
}

/// Geometría recordada de la ventana (FR-018).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct WindowGeometry {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

/// Preferencias de la instalación. Un único registro, propiedad de Rust.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Preferences {
    pub format_version: u32,
    pub theme: Theme,
    pub show_welcome_on_start: bool,
    pub window: Option<WindowGeometry>,
    pub last_model_path: Option<String>,
    pub engine: Engine,
    pub last_folder: Option<String>,
}

impl Default for Preferences {
    fn default() -> Self {
        Self {
            format_version: FORMAT_VERSION,
            theme: Theme::System,
            show_welcome_on_start: true,
            window: None,
            last_model_path: None,
            engine: Engine::Postgres,
            last_folder: None,
        }
    }
}

/// Cambio parcial que acepta `preferences_update`. Los campos ausentes no se tocan.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PreferencesPatch {
    pub theme: Option<Theme>,
    pub show_welcome_on_start: Option<bool>,
    pub engine: Option<Engine>,
    /// Carpeta inicial del diálogo Nuevo modelo. `null` la olvida.
    #[serde(default, deserialize_with = "double_option")]
    pub last_folder: Option<Option<String>>,
    /// Último modelo usado; se escribe al abrir y al guardar. `null` lo olvida.
    #[serde(default, deserialize_with = "double_option")]
    pub last_model_path: Option<Option<String>>,
}

/// Distingue «campo ausente» de «campo a `null`» en un parche.
///
/// Sin esto las dos cosas llegarían como `None` y no habría forma de olvidar
/// una ruta: ausente es `None` y deja el valor anterior, `null` es
/// `Some(None)` y lo borra.
fn double_option<'de, D>(deserializer: D) -> Result<Option<Option<String>>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    Option::<String>::deserialize(deserializer).map(Some)
}

/// Resultado de la lectura: las preferencias y si hubo que recuperarse.
///
/// `recovered_reason` es un código estable (`missing`, `empty`, `invalid_json`,
/// `future_version`, `unreadable`) para que la interfaz decida si avisa:
/// un primer arranque sin archivo no es un fallo que merezca aviso (FR-016).
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PreferencesLoadResult {
    pub preferences: Preferences,
    pub recovered: bool,
    pub recovered_reason: Option<String>,
}

impl PreferencesLoadResult {
    /// Resultado de recuperación: valores por defecto más la causa.
    fn recovered(reason: &str) -> Self {
        Self {
            preferences: Preferences::default(),
            recovered: true,
            recovered_reason: Some(reason.to_string()),
        }
    }
}

/// Ruta del archivo de preferencias dentro del directorio de configuración.
///
/// @param config_dir Directorio de configuración de la aplicación.
pub fn file_path(config_dir: &Path) -> PathBuf {
    config_dir.join("preferences.json")
}

/// Lee las preferencias sin fallar nunca (FR-016).
///
/// Pasos: si el archivo no existe, devuelve los valores por defecto; si existe
/// pero está vacío, no es JSON válido o declara una versión futura, guarda una
/// copia `.bak`, registra la causa con ámbito `preferences` y devuelve los
/// valores por defecto; si es legible, valida campo a campo y conserva los
/// válidos aunque alguno sobre.
///
/// @param path Ruta del archivo de preferencias.
/// @returns Preferencias usables y la causa de la recuperación, si hubo.
pub fn load_from(path: &Path) -> PreferencesLoadResult {
    let raw = match fs::read_to_string(path) {
        Ok(raw) => raw,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            return PreferencesLoadResult::recovered("missing")
        }
        Err(error) => {
            log::warn!(target: SCOPE_PREFERENCES, "preferencias ilegibles en {path:?}: {error}");
            return PreferencesLoadResult::recovered("unreadable");
        }
    };

    if raw.trim().is_empty() {
        backup(path, &raw);
        log::warn!(target: SCOPE_PREFERENCES, "archivo de preferencias vacío en {path:?}");
        return PreferencesLoadResult::recovered("empty");
    }

    let value: serde_json::Value = match serde_json::from_str(&raw) {
        Ok(value) => value,
        Err(error) => {
            backup(path, &raw);
            log::warn!(target: SCOPE_PREFERENCES, "preferencias dañadas en {path:?}: {error}");
            return PreferencesLoadResult::recovered("invalid_json");
        }
    };

    let format_version = value.get("formatVersion").and_then(serde_json::Value::as_u64);
    match format_version {
        Some(version) if version as u32 == FORMAT_VERSION => {}
        Some(version) if version as u32 > FORMAT_VERSION => {
            backup(path, &raw);
            log::warn!(
                target: SCOPE_PREFERENCES,
                "preferencias de una versión futura ({version}) en {path:?}"
            );
            return PreferencesLoadResult::recovered("future_version");
        }
        _ => {
            backup(path, &raw);
            log::warn!(target: SCOPE_PREFERENCES, "`formatVersion` ausente o inválida en {path:?}");
            return PreferencesLoadResult::recovered("invalid_json");
        }
    }

    PreferencesLoadResult {
        preferences: from_value_field_by_field(&value),
        recovered: false,
        recovered_reason: None,
    }
}

/// Reconstruye las preferencias campo a campo: un campo inválido cae a su
/// valor por defecto sin descartar los demás (invariante de data-model.md).
fn from_value_field_by_field(value: &serde_json::Value) -> Preferences {
    let defaults = Preferences::default();

    let theme = match value.get("theme").and_then(serde_json::Value::as_str) {
        Some("system") => Theme::System,
        Some("light") => Theme::Light,
        Some("dark") => Theme::Dark,
        Some(other) => {
            log::warn!(target: SCOPE_PREFERENCES, "tema desconocido «{other}»; se usa «system»");
            Theme::System
        }
        None => defaults.theme,
    };

    let show_welcome_on_start = value
        .get("showWelcomeOnStart")
        .and_then(serde_json::Value::as_bool)
        .unwrap_or(defaults.show_welcome_on_start);

    let window = value
        .get("window")
        .and_then(|window| serde_json::from_value::<WindowGeometry>(window.clone()).ok());

    let last_model_path = optional_path(value, "lastModelPath");

    // `engine` y `lastFolder` llegan con el Incremento 1: un archivo del
    // Incremento 0 no los trae y caen a su valor por defecto sin recuperación,
    // por eso `formatVersion` sigue en 1 (research.md R18).
    let engine = match value.get("engine").and_then(serde_json::Value::as_str) {
        Some("postgres") => Engine::Postgres,
        Some("mysql") => Engine::Mysql,
        Some("sqlite") => Engine::Sqlite,
        Some(other) => {
            log::warn!(target: SCOPE_PREFERENCES, "motor desconocido «{other}»; se usa «postgres»");
            Engine::Postgres
        }
        None => defaults.engine,
    };

    let last_folder = optional_path(value, "lastFolder");

    Preferences {
        format_version: FORMAT_VERSION,
        theme,
        show_welcome_on_start,
        window,
        last_model_path,
        engine,
        last_folder,
    }
}

/// Lee una ruta opcional, tratando el texto en blanco como ausente.
fn optional_path(value: &serde_json::Value, key: &str) -> Option<String> {
    value
        .get(key)
        .and_then(serde_json::Value::as_str)
        .filter(|path| !path.trim().is_empty())
        .map(str::to_string)
}

/// Guarda una copia del archivo original antes de reemplazarlo por los
/// valores por defecto, para que el usuario no pierda lo que tenía.
fn backup(path: &Path, raw: &str) {
    let backup_path = path.with_extension("json.bak");
    if let Some(parent) = backup_path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    if let Err(error) = fs::write(&backup_path, raw) {
        log::warn!(target: SCOPE_PREFERENCES, "no se pudo copiar a {backup_path:?}: {error}");
    }
}

/// Escribe las preferencias de forma atómica: archivo temporal y renombrado.
///
/// @param path Ruta definitiva del archivo.
/// @param preferences Preferencias completas a persistir.
/// @returns El motivo del fallo si no se pudo escribir; nunca deja un archivo a medias.
pub fn save_to(path: &Path, preferences: &Preferences) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| format!("no se pudo crear {parent:?}: {error}"))?;
    }

    let contents = serde_json::to_string_pretty(preferences)
        .map_err(|error| format!("no se pudo serializar las preferencias: {error}"))?;

    let temporary = path.with_extension("json.tmp");
    fs::write(&temporary, contents)
        .map_err(|error| format!("no se pudo escribir {temporary:?}: {error}"))?;
    fs::rename(&temporary, path).map_err(|error| {
        let _ = fs::remove_file(&temporary);
        format!("no se pudo renombrar a {path:?}: {error}")
    })
}

/// Aplica un cambio parcial sobre las preferencias actuales.
///
/// @param current Preferencias ya cargadas.
/// @param patch Campos a modificar; los ausentes se conservan.
pub fn apply_patch(current: &Preferences, patch: &PreferencesPatch) -> Preferences {
    let mut next = current.clone();
    if let Some(theme) = patch.theme {
        next.theme = theme;
    }
    if let Some(show_welcome_on_start) = patch.show_welcome_on_start {
        next.show_welcome_on_start = show_welcome_on_start;
    }
    if let Some(engine) = patch.engine {
        next.engine = engine;
    }
    if let Some(last_folder) = patch.last_folder.clone() {
        next.last_folder = last_folder;
    }
    if let Some(last_model_path) = patch.last_model_path.clone() {
        next.last_model_path = last_model_path;
    }
    next.format_version = FORMAT_VERSION;
    next
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Directorio temporal propio de cada prueba, sin dependencias externas.
    fn temp_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("sql-designer-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).expect("directorio temporal");
        dir
    }

    #[test]
    fn archivo_ausente_devuelve_valores_por_defecto() {
        let path = temp_dir("ausente").join("preferences.json");
        let result = load_from(&path);
        assert_eq!(result.preferences, Preferences::default());
        assert!(result.recovered);
        assert_eq!(result.recovered_reason.as_deref(), Some("missing"));
    }

    #[test]
    fn archivo_danado_deja_copia_bak_y_valores_por_defecto() {
        let dir = temp_dir("danado");
        let path = file_path(&dir);
        fs::write(&path, "{ esto no es json").expect("escribir");

        let result = load_from(&path);

        assert!(result.recovered);
        assert_eq!(result.recovered_reason.as_deref(), Some("invalid_json"));
        assert_eq!(result.preferences.theme, Theme::System);
        let backup = fs::read_to_string(dir.join("preferences.json.bak")).expect("copia .bak");
        assert_eq!(backup, "{ esto no es json");
    }

    #[test]
    fn version_futura_se_trata_como_no_legible() {
        let dir = temp_dir("futura");
        let path = file_path(&dir);
        fs::write(&path, r#"{"formatVersion":2,"theme":"dark"}"#).expect("escribir");

        let result = load_from(&path);

        assert!(result.recovered);
        assert_eq!(result.recovered_reason.as_deref(), Some("future_version"));
        assert_eq!(result.preferences, Preferences::default());
        assert!(dir.join("preferences.json.bak").exists());
    }

    #[test]
    fn tema_invalido_no_descarta_los_demas_campos() {
        let dir = temp_dir("tema");
        let path = file_path(&dir);
        fs::write(
            &path,
            r#"{"formatVersion":1,"theme":"neon","showWelcomeOnStart":false,
                "window":{"x":10,"y":20,"width":1280,"height":800},
                "lastModelPath":"/tmp/modelo.yaml"}"#,
        )
        .expect("escribir");

        let result = load_from(&path);

        assert!(!result.recovered);
        assert_eq!(result.preferences.theme, Theme::System);
        assert!(!result.preferences.show_welcome_on_start);
        assert_eq!(
            result.preferences.window,
            Some(WindowGeometry { x: 10, y: 20, width: 1280, height: 800 })
        );
        assert_eq!(result.preferences.last_model_path.as_deref(), Some("/tmp/modelo.yaml"));
    }

    #[test]
    fn guardar_y_volver_a_leer_devuelve_lo_mismo() {
        let dir = temp_dir("ida-vuelta");
        let path = file_path(&dir);
        let preferences = Preferences {
            format_version: FORMAT_VERSION,
            theme: Theme::Dark,
            show_welcome_on_start: false,
            window: Some(WindowGeometry { x: 0, y: 0, width: MIN_WIDTH, height: MIN_HEIGHT }),
            last_model_path: None,
            engine: Engine::Mysql,
            last_folder: Some("/Users/x/Proyectos".to_string()),
        };

        save_to(&path, &preferences).expect("guardar");
        let result = load_from(&path);

        assert!(!result.recovered);
        assert_eq!(result.preferences, preferences);
        assert!(!path.with_extension("json.tmp").exists());
    }

    #[test]
    fn escritura_fallida_devuelve_el_motivo() {
        // Un directorio en lugar de un archivo: el renombrado no puede completarse.
        let dir = temp_dir("fallo");
        let path = dir.join("preferences.json");
        fs::create_dir_all(&path).expect("directorio en la ruta del archivo");

        let error = save_to(&path, &Preferences::default()).expect_err("debe fallar");

        assert!(error.contains("no se pudo"), "mensaje inesperado: {error}");
    }

    #[test]
    fn el_parche_solo_cambia_lo_que_trae() {
        let current = Preferences::default();
        let patch = PreferencesPatch { theme: Some(Theme::Light), ..Default::default() };

        let next = apply_patch(&current, &patch);

        assert_eq!(next.theme, Theme::Light);
        assert!(next.show_welcome_on_start);
        assert_eq!(next.engine, Engine::Postgres);
    }

    #[test]
    fn un_archivo_del_incremento_0_carga_con_los_valores_nuevos_por_defecto() {
        // Sin `engine` ni `lastFolder`, y sin subir `formatVersion`: no es una
        // recuperación, es un archivo anterior que sigue siendo válido (R18).
        let dir = temp_dir("incremento-0");
        let path = file_path(&dir);
        fs::write(
            &path,
            r#"{ "formatVersion": 1, "theme": "dark", "showWelcomeOnStart": false, "window": null, "lastModelPath": null }"#,
        )
        .expect("escritura");

        let result = load_from(&path);

        assert!(!result.recovered);
        assert_eq!(result.preferences.theme, Theme::Dark);
        assert!(!result.preferences.show_welcome_on_start);
        assert_eq!(result.preferences.engine, Engine::Postgres);
        assert_eq!(result.preferences.last_folder, None);
    }

    #[test]
    fn el_parche_distingue_olvidar_una_ruta_de_no_tocarla() {
        let current = Preferences {
            last_folder: Some("/Users/x/Proyectos".to_string()),
            last_model_path: Some("/Users/x/Proyectos/modelo.yaml".to_string()),
            ..Default::default()
        };

        let sin_tocar: PreferencesPatch =
            serde_json::from_str(r#"{ "engine": "sqlite" }"#).expect("parche");
        let next = apply_patch(&current, &sin_tocar);
        assert_eq!(next.engine, Engine::Sqlite);
        assert_eq!(next.last_folder.as_deref(), Some("/Users/x/Proyectos"));

        let olvidar: PreferencesPatch =
            serde_json::from_str(r#"{ "lastModelPath": null }"#).expect("parche");
        let next = apply_patch(&current, &olvidar);
        assert_eq!(next.last_model_path, None);
        assert_eq!(next.last_folder.as_deref(), Some("/Users/x/Proyectos"));
    }
}
