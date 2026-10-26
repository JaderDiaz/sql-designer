use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::files::{self, FileStamp};
use crate::logging::SCOPE_RECENTS;

/// Lista de modelos recientes, propiedad de Rust.
///
/// Vive en `recents.json`, junto a `preferences.json`, con la forma de
/// `contracts/recents.schema.json`. Guarda un caché del nombre, el motor y el
/// número de tablas de cada modelo para que la Bienvenida pinte la lista sin
/// leer diez archivos (`research.md` R5).

/// Versión del formato que esta build sabe leer.
pub const FORMAT_VERSION: u32 = 1;

/// Número máximo de entradas: al pasar de aquí sale la más antigua (FR-029).
pub const MAX_ENTRIES: usize = 10;

/// Nombre del archivo dentro del directorio de configuración.
const FILE_NAME: &str = "recents.json";

/// Una entrada de la lista de recientes.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecentEntry {
    /// Ruta absoluta del archivo. Es la identidad de la entrada.
    pub path: String,
    /// Nombre del modelo cacheado en la última lectura o escritura.
    pub name: String,
    /// Motor cacheado.
    pub engine: String,
    /// Número de tablas cacheado.
    pub tables: u32,
    /// Marca de tiempo del último uso; ordena la lista.
    pub used_at_ms: u64,
    /// Sello del archivo cuando se cachearon los campos anteriores.
    pub stamp: Option<FileStamp>,
    /// `true` si la última validación falló.
    pub invalid: bool,
}

/// Lo que llega de la interfaz al registrar un uso; la marca la pone Rust.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecentEntryInput {
    pub path: String,
    pub name: String,
    pub engine: String,
    pub tables: u32,
    pub stamp: Option<FileStamp>,
    pub invalid: bool,
}

/// Una entrada con el estado del archivo en disco ya resuelto.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecentListEntry {
    #[serde(flatten)]
    pub entry: RecentEntry,
    /// Si el archivo sigue en su sitio.
    pub exists: bool,
    /// Sello real del disco, para compararlo con el cacheado.
    pub disk_stamp: Option<FileStamp>,
}

/// Ruta del archivo de recientes dentro del directorio de configuración.
///
/// @param config_dir Directorio de configuración de la aplicación.
pub fn file_path(config_dir: &Path) -> PathBuf {
    config_dir.join(FILE_NAME)
}

/// Marca de tiempo actual en milisegundos.
///
/// Un reloj que el sistema no sepa dar cuenta como 0: la entrada queda al
/// final de la lista, pero no se pierde.
pub fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|elapsed| elapsed.as_millis() as u64)
        .unwrap_or(0)
}

/// Lee la lista de recientes del disco.
///
/// No falla nunca: un archivo ausente, vacío, que no es JSON o de una versión
/// futura deja una copia `.bak`, devuelve la lista vacía y anota la causa en el
/// registro. Las entradas se reconstruyen campo a campo, de modo que una
/// entrada rota no se lleva por delante a las demás.
///
/// @param path Ruta del archivo de recientes.
pub fn load_from(path: &Path) -> Vec<RecentEntry> {
    let raw = match fs::read_to_string(path) {
        Ok(raw) => raw,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Vec::new(),
        Err(error) => {
            log::warn!(target: SCOPE_RECENTS, "no se pudo leer {path:?}: {error}");
            return Vec::new();
        }
    };

    if raw.trim().is_empty() {
        backup(path, &raw, "vacío");
        return Vec::new();
    }

    let value: serde_json::Value = match serde_json::from_str(&raw) {
        Ok(value) => value,
        Err(error) => {
            backup(path, &raw, &format!("no es JSON válido: {error}"));
            return Vec::new();
        }
    };

    let format_version = value
        .get("formatVersion")
        .and_then(serde_json::Value::as_u64)
        .unwrap_or(u64::from(FORMAT_VERSION));
    if format_version > u64::from(FORMAT_VERSION) {
        backup(path, &raw, "es de una versión más nueva");
        return Vec::new();
    }

    let Some(entries) = value.get("entries").and_then(serde_json::Value::as_array) else {
        backup(path, &raw, "no trae la lista de entradas");
        return Vec::new();
    };

    let mut list: Vec<RecentEntry> = entries.iter().filter_map(entry_from_value).collect();
    sort_and_trim(&mut list);
    list
}

/// Reconstruye una entrada campo a campo; `None` si le falta lo esencial.
fn entry_from_value(value: &serde_json::Value) -> Option<RecentEntry> {
    let path = value.get("path").and_then(serde_json::Value::as_str)?;
    if path.trim().is_empty() {
        return None;
    }
    let name = value.get("name").and_then(serde_json::Value::as_str).unwrap_or("").to_string();
    let engine =
        value.get("engine").and_then(serde_json::Value::as_str).unwrap_or("postgres").to_string();
    let tables = value
        .get("tables")
        .and_then(serde_json::Value::as_u64)
        .map(|tables| tables.min(u64::from(u32::MAX)) as u32)
        .unwrap_or(0);
    let used_at_ms = value.get("usedAtMs").and_then(serde_json::Value::as_u64).unwrap_or(0);
    let stamp = value
        .get("stamp")
        .and_then(|stamp| serde_json::from_value::<FileStamp>(stamp.clone()).ok());
    let invalid = value.get("invalid").and_then(serde_json::Value::as_bool).unwrap_or(false);

    Some(RecentEntry { path: path.to_string(), name, engine, tables, used_at_ms, stamp, invalid })
}

/// Deja la lista de más reciente a más antigua y recorta a {@link MAX_ENTRIES}.
fn sort_and_trim(list: &mut Vec<RecentEntry>) {
    list.sort_by(|left, right| right.used_at_ms.cmp(&left.used_at_ms));
    list.truncate(MAX_ENTRIES);
}

/// Guarda una copia del archivo antes de empezar de cero con la lista vacía.
fn backup(path: &Path, raw: &str, reason: &str) {
    log::warn!(target: SCOPE_RECENTS, "{path:?} {reason}; se guarda copia y se empieza vacío");
    let backup_path = path.with_extension("json.bak");
    if let Err(error) = fs::write(&backup_path, raw) {
        log::warn!(target: SCOPE_RECENTS, "no se pudo copiar a {backup_path:?}: {error}");
    }
}

/// Escribe la lista de forma atómica: temporal y renombrado.
///
/// @param path Ruta del archivo de recientes.
/// @param entries Lista completa a persistir, ya ordenada y recortada.
/// @returns El motivo del fallo si no se pudo escribir.
pub fn save_to(path: &Path, entries: &[RecentEntry]) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| format!("no se pudo crear {parent:?}: {error}"))?;
    }

    let document = serde_json::json!({ "formatVersion": FORMAT_VERSION, "entries": entries });
    let contents = serde_json::to_string_pretty(&document)
        .map_err(|error| format!("no se pudo serializar los recientes: {error}"))?;

    let temporary = path.with_extension("json.tmp");
    fs::write(&temporary, contents)
        .map_err(|error| format!("no se pudo escribir {temporary:?}: {error}"))?;
    fs::rename(&temporary, path).map_err(|error| {
        let _ = fs::remove_file(&temporary);
        format!("no se pudo renombrar a {path:?}: {error}")
    })
}

/// Registra o actualiza una entrada y la pone primera.
///
/// Una ruta ya presente se actualiza en sitio en lugar de duplicarse; al pasar
/// de {@link MAX_ENTRIES} sale la más antigua (FR-029, FR-032).
///
/// @param entries Lista actual.
/// @param input Entrada que llega de la interfaz.
/// @param used_at_ms Marca de tiempo del uso.
pub fn touch(
    entries: &mut Vec<RecentEntry>,
    input: RecentEntryInput,
    used_at_ms: u64,
) -> Vec<RecentEntry> {
    entries.retain(|entry| entry.path != input.path);
    entries.push(RecentEntry {
        path: input.path,
        name: input.name,
        engine: input.engine,
        tables: input.tables,
        used_at_ms,
        stamp: input.stamp,
        invalid: input.invalid,
    });
    sort_and_trim(entries);
    entries.clone()
}

/// Quita una entrada de la lista. El archivo no se toca (FR-034).
///
/// @param entries Lista actual.
/// @param path Ruta de la entrada que sale.
pub fn remove(entries: &mut Vec<RecentEntry>, path: &str) -> Vec<RecentEntry> {
    entries.retain(|entry| entry.path != path);
    entries.clone()
}

/// Añade a cada entrada el estado real del archivo en el disco.
///
/// @param entries Lista cacheada.
pub fn with_disk_state(entries: &[RecentEntry]) -> Vec<RecentListEntry> {
    let paths: Vec<String> = entries.iter().map(|entry| entry.path.clone()).collect();
    let stats = files::stat_paths(&paths);
    entries
        .iter()
        .zip(stats)
        .map(|(entry, stat)| RecentListEntry {
            entry: entry.clone(),
            exists: stat.exists,
            disk_stamp: stat.stamp,
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Directorio temporal propio de cada prueba.
    fn temp_dir(name: &str) -> PathBuf {
        let dir =
            std::env::temp_dir().join(format!("sql-designer-recents-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).expect("directorio temporal");
        dir
    }

    /// Entrada de ejemplo con la ruta dada.
    fn input(path: &str) -> RecentEntryInput {
        RecentEntryInput {
            path: path.to_string(),
            name: format!("Modelo {path}"),
            engine: "postgres".to_string(),
            tables: 6,
            stamp: Some(FileStamp { modified_ms: 10, size_bytes: 20 }),
            invalid: false,
        }
    }

    #[test]
    fn insertar_la_undecima_descarta_la_mas_antigua() {
        let mut entries = Vec::new();
        for index in 0..MAX_ENTRIES {
            touch(&mut entries, input(&format!("/modelos/{index}.yaml")), index as u64 + 1);
        }

        let list = touch(&mut entries, input("/modelos/nuevo.yaml"), 100);

        assert_eq!(list.len(), MAX_ENTRIES);
        assert_eq!(list[0].path, "/modelos/nuevo.yaml");
        assert!(!list.iter().any(|entry| entry.path == "/modelos/0.yaml"));
    }

    #[test]
    fn una_ruta_repetida_se_actualiza_y_sube() {
        let mut entries = Vec::new();
        touch(&mut entries, input("/modelos/a.yaml"), 1);
        touch(&mut entries, input("/modelos/b.yaml"), 2);

        let mut repetida = input("/modelos/a.yaml");
        repetida.name = "Nombre nuevo".to_string();
        repetida.tables = 12;
        let list = touch(&mut entries, repetida, 3);

        assert_eq!(list.len(), 2);
        assert_eq!(list[0].path, "/modelos/a.yaml");
        assert_eq!(list[0].name, "Nombre nuevo");
        assert_eq!(list[0].tables, 12);
    }

    #[test]
    fn quitar_una_entrada_deja_las_demas() {
        let mut entries = Vec::new();
        touch(&mut entries, input("/modelos/a.yaml"), 1);
        touch(&mut entries, input("/modelos/b.yaml"), 2);

        let list = remove(&mut entries, "/modelos/a.yaml");

        assert_eq!(list.len(), 1);
        assert_eq!(list[0].path, "/modelos/b.yaml");
    }

    #[test]
    fn un_archivo_ausente_devuelve_lista_vacia_sin_copia() {
        let dir = temp_dir("ausente");

        let list = load_from(&file_path(&dir));

        assert!(list.is_empty());
        assert!(!dir.join("recents.json.bak").exists());
    }

    #[test]
    fn un_archivo_danado_deja_copia_bak_y_lista_vacia() {
        let dir = temp_dir("danado");
        let path = file_path(&dir);
        fs::write(&path, "{ esto no es json").expect("escritura");

        let list = load_from(&path);

        assert!(list.is_empty());
        assert_eq!(fs::read_to_string(dir.join("recents.json.bak")).expect("copia"), "{ esto no es json");
    }

    #[test]
    fn una_version_futura_no_se_lee() {
        let dir = temp_dir("futuro");
        let path = file_path(&dir);
        fs::write(&path, r#"{ "formatVersion": 2, "entries": [] }"#).expect("escritura");

        let list = load_from(&path);

        assert!(list.is_empty());
        assert!(dir.join("recents.json.bak").exists());
    }

    #[test]
    fn la_ida_y_vuelta_conserva_las_entradas_en_orden() {
        let dir = temp_dir("ida-vuelta");
        let path = file_path(&dir);
        let mut entries = Vec::new();
        touch(&mut entries, input("/modelos/a.yaml"), 1);
        touch(&mut entries, input("/modelos/b.yaml"), 2);

        save_to(&path, &entries).expect("escritura");
        let list = load_from(&path);

        assert_eq!(list, entries);
        assert_eq!(list[0].path, "/modelos/b.yaml");
    }

    #[test]
    fn una_entrada_sin_ruta_se_descarta_sin_tirar_las_demas() {
        let dir = temp_dir("entrada-rota");
        let path = file_path(&dir);
        fs::write(
            &path,
            r#"{ "formatVersion": 1, "entries": [ { "name": "sin ruta" }, { "path": "/modelos/a.yaml", "usedAtMs": 5 } ] }"#,
        )
        .expect("escritura");

        let list = load_from(&path);

        assert_eq!(list.len(), 1);
        assert_eq!(list[0].path, "/modelos/a.yaml");
        assert_eq!(list[0].engine, "postgres");
    }

    #[test]
    fn with_disk_state_marca_el_archivo_que_ya_no_esta() {
        let dir = temp_dir("estado-disco");
        let presente = dir.join("modelo.yaml");
        fs::write(&presente, "formatVersion: 1\n").expect("escritura");
        let mut entries = Vec::new();
        touch(&mut entries, input(&presente.to_string_lossy()), 2);
        touch(&mut entries, input("/no/existe.yaml"), 1);

        let list = with_disk_state(&entries);

        assert!(list[0].exists);
        assert!(list[0].disk_stamp.is_some());
        assert!(!list[1].exists);
        assert!(list[1].disk_stamp.is_none());
    }
}
