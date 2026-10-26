use std::fs::{self, Metadata};
use std::io;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

use serde::{Deserialize, Serialize};

use crate::commands::AppError;

/// Núcleo del disco: leer y escribir el archivo del modelo y mirar su estado.
///
/// Rust es el dueño del disco y no interpreta el YAML (`research.md` R1): aquí
/// solo viajan texto y sellos. Todo comando que use estas funciones se declara
/// `async fn` en `commands.rs`, para que Tauri lo saque del hilo principal
/// (principio III, FR-042).

/// Extensión de los archivos de modelo.
pub const MODEL_EXTENSION: &str = "yaml";

/// Nombres de archivo que Windows reserva y no se pueden usar.
const RESERVED_STEMS: [&str; 22] = [
    "con", "prn", "aux", "nul", "com1", "com2", "com3", "com4", "com5", "com6", "com7", "com8",
    "com9", "lpt1", "lpt2", "lpt3", "lpt4", "lpt5", "lpt6", "lpt7", "lpt8", "lpt9",
];

/// Sello del archivo en disco: identifica la versión que se leyó o escribió.
///
/// Guardar compara el sello esperado con el real para no pisar un cambio hecho
/// por fuera (FR-025).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileStamp {
    pub modified_ms: u64,
    pub size_bytes: u64,
}

/// Texto del archivo del modelo con el sello de la lectura.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelReadResult {
    pub text: String,
    pub stamp: FileStamp,
}

/// Sello del archivo después de escribirlo.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelWriteResult {
    pub stamp: FileStamp,
}

/// Estado en disco de una ruta consultada.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PathStat {
    pub path: String,
    pub exists: bool,
    pub stamp: Option<FileStamp>,
}

/// Qué se lista de una carpeta.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ListOnly {
    /// Solo carpetas: el diálogo Elegir carpeta.
    Folders,
    /// Carpetas y archivos de modelo: el diálogo Abrir modelo.
    Models,
    /// Todo lo que haya, sin filtrar por tipo.
    All,
}

/// Una entrada de carpeta tal como viaja al frontend.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DirectoryEntry {
    pub name: String,
    pub path: String,
    pub is_directory: bool,
    pub size_bytes: u64,
    pub modified_ms: u64,
    /// `true` para los `.yaml`.
    pub is_model: bool,
}

/// Nombre y ruta reales de una carpeta recién creada, ya desambiguados.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatedDirectory {
    pub name: String,
    pub path: String,
}

/// Ruta final de un archivo de modelo y si ya está ocupada.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BuiltModelPath {
    pub path: String,
    pub file_name: String,
    pub exists: bool,
}

/// Saca el sello de los metadatos de un archivo.
///
/// Una fecha de modificación que el sistema no sepa dar cuenta como 0: el
/// sello sigue sirviendo para comparar, porque el tamaño también entra.
pub fn stamp_of(metadata: &Metadata) -> FileStamp {
    let modified_ms = metadata
        .modified()
        .ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map(|elapsed| elapsed.as_millis() as u64)
        .unwrap_or(0);
    FileStamp { modified_ms, size_bytes: metadata.len() }
}

/// Traduce un error del sistema de archivos a un código del contrato.
///
/// @param error Error que devolvió el sistema.
/// @param fallback Código que se usa cuando no es «no existe» ni «denegado».
fn to_app_error(error: &io::Error, fallback: &str) -> AppError {
    match error.kind() {
        io::ErrorKind::NotFound => AppError::new("path_not_found", "La ruta ya no existe."),
        io::ErrorKind::PermissionDenied => {
            AppError::new("path_denied", "El sistema no da acceso a esa ruta.")
        }
        _ => AppError::new(fallback, error.to_string()),
    }
}

/// Lee el archivo del modelo como texto, con su sello.
///
/// Un archivo que no parsea no es un error aquí: el texto vuelve bien y la
/// validación del frontend decide (FR-016).
///
/// @param path Ruta absoluta del archivo.
pub fn read_model(path: &Path) -> Result<ModelReadResult, AppError> {
    let metadata = fs::metadata(path).map_err(|error| to_app_error(&error, "model_read_failed"))?;
    if !metadata.is_file() {
        return Err(AppError::new("model_read_failed", "La ruta no es un archivo."));
    }
    let text = fs::read_to_string(path).map_err(|error| to_app_error(&error, "model_read_failed"))?;
    Ok(ModelReadResult { text, stamp: stamp_of(&metadata) })
}

/// Ruta del archivo temporal que se usa para escribir de forma atómica.
///
/// Vive en el mismo directorio que el destino, porque renombrar entre
/// sistemas de archivos distintos no es atómico.
fn temporary_path(path: &Path) -> PathBuf {
    let name = path.file_name().map(|name| name.to_string_lossy().to_string()).unwrap_or_default();
    let parent = path.parent().unwrap_or_else(|| Path::new("."));
    parent.join(format!(".{name}.{}.tmp", std::process::id()))
}

/// Escribe el archivo del modelo de forma atómica.
///
/// Pasos: comprueba el sello esperado contra el disco y se detiene con
/// `model_stale` si no coincide; escribe el texto en un temporal del mismo
/// directorio; y lo renombra sobre el destino, de modo que un fallo a mitad
/// nunca deja el archivo anterior truncado (FR-022, FR-025).
///
/// @param path Ruta absoluta del archivo del modelo.
/// @param text Contenido completo que se quiere guardar.
/// @param expected_stamp Sello de la última lectura o escritura; `None` cuando
/// se está creando el archivo.
/// @param force `true` para sobrescribir aunque el sello no coincida, después
/// de que el usuario lo haya confirmado.
pub fn write_model(
    path: &Path,
    text: &str,
    expected_stamp: Option<FileStamp>,
    force: bool,
) -> Result<ModelWriteResult, AppError> {
    let parent = path.parent().unwrap_or_else(|| Path::new("."));
    if !parent.is_dir() {
        return Err(AppError::new("path_not_found", "La carpeta de destino ya no existe."));
    }

    let current = match fs::metadata(path) {
        Ok(metadata) => Some(stamp_of(&metadata)),
        Err(error) if error.kind() == io::ErrorKind::NotFound => None,
        Err(error) => return Err(to_app_error(&error, "model_write_failed")),
    };

    if !force {
        match (expected_stamp, current) {
            // Crear: el archivo no puede estar ya ocupado.
            (None, Some(_)) => {
                return Err(AppError::new("path_exists", "Ya hay un archivo con ese nombre."))
            }
            // Guardar: el archivo tiene que seguir siendo el que se leyó.
            (Some(expected), Some(found)) if expected != found => {
                return Err(AppError::new(
                    "model_stale",
                    "El archivo cambió en el disco desde la última vez que se leyó.",
                ))
            }
            (Some(_), None) => {
                return Err(AppError::new("path_not_found", "El archivo ya no está en su sitio."))
            }
            _ => {}
        }
    }

    let temporary = temporary_path(path);
    fs::write(&temporary, text).map_err(|error| {
        let _ = fs::remove_file(&temporary);
        to_app_error(&error, "model_write_failed")
    })?;

    if let Err(error) = fs::rename(&temporary, path) {
        let _ = fs::remove_file(&temporary);
        return Err(to_app_error(&error, "model_write_failed"));
    }

    let metadata = fs::metadata(path).map_err(|error| to_app_error(&error, "model_write_failed"))?;
    Ok(ModelWriteResult { stamp: stamp_of(&metadata) })
}

/// Mira el estado de varias rutas de una sola vez.
///
/// Nunca falla: una ruta inaccesible vuelve como `exists: false`, que es lo
/// que la Bienvenida necesita para marcar un reciente que ya no está (FR-031).
///
/// @param paths Rutas absolutas a consultar.
pub fn stat_paths(paths: &[String]) -> Vec<PathStat> {
    paths
        .iter()
        .map(|path| match fs::metadata(Path::new(path)) {
            Ok(metadata) if metadata.is_file() => {
                PathStat { path: path.clone(), exists: true, stamp: Some(stamp_of(&metadata)) }
            }
            _ => PathStat { path: path.clone(), exists: false, stamp: None },
        })
        .collect()
}

/// Arma la ruta final del archivo del modelo y dice si ya existe.
///
/// El frontend nunca concatena separadores ni añade la extensión
/// (`research.md` R9): el nombre llega ya saneado por `src/lib/model/slug.ts`
/// y aquí se rechaza lo que el sistema de archivos no acepta.
///
/// @param folder Carpeta elegida para el modelo.
/// @param file_stem Nombre del archivo sin extensión.
pub fn build_model_path(folder: &Path, file_stem: &str) -> Result<BuiltModelPath, AppError> {
    if file_stem.is_empty() {
        return Err(AppError::new("path_invalid", "El nombre del archivo está vacío."));
    }
    if file_stem.contains('/') || file_stem.contains('\\') || file_stem.contains(':') {
        return Err(AppError::new(
            "path_invalid",
            "El nombre del archivo no puede llevar separadores de ruta.",
        ));
    }
    if RESERVED_STEMS.contains(&file_stem.to_ascii_lowercase().as_str()) {
        return Err(AppError::new(
            "path_invalid",
            "Ese nombre está reservado por el sistema operativo.",
        ));
    }

    let file_name = format!("{file_stem}.{MODEL_EXTENSION}");
    let path = folder.join(&file_name);
    Ok(BuiltModelPath {
        path: path.to_string_lossy().to_string(),
        file_name,
        exists: path.exists(),
    })
}

/// ¿Es un archivo de modelo por su extensión?
///
/// La comparación no distingue mayúsculas: `MODELO.YAML` también es un modelo.
///
/// @param path Ruta del archivo.
fn is_model_file(path: &Path) -> bool {
    path.extension()
        .map(|extension| extension.to_string_lossy().to_ascii_lowercase() == MODEL_EXTENSION)
        .unwrap_or(false)
}

/// Compara dos nombres con orden natural e insensible a mayúsculas.
///
/// «Modelo 2» va antes que «Modelo 10», que es lo que espera cualquiera que
/// mire una lista de archivos; comparar como texto los pondría al revés.
///
/// @param left Un nombre.
/// @param right El otro nombre.
fn natural_cmp(left: &str, right: &str) -> std::cmp::Ordering {
    let mut a = left.chars().flat_map(char::to_lowercase).peekable();
    let mut b = right.chars().flat_map(char::to_lowercase).peekable();

    loop {
        match (a.peek().copied(), b.peek().copied()) {
            (None, None) => return left.cmp(right),
            (None, Some(_)) => return std::cmp::Ordering::Less,
            (Some(_), None) => return std::cmp::Ordering::Greater,
            (Some(x), Some(y)) if x.is_ascii_digit() && y.is_ascii_digit() => {
                // Los dígitos seguidos se comparan como número, no como texto.
                let mut nx = String::new();
                while a.peek().copied().is_some_and(|c| c.is_ascii_digit()) {
                    nx.push(a.next().unwrap_or_default());
                }
                let mut ny = String::new();
                while b.peek().copied().is_some_and(|c| c.is_ascii_digit()) {
                    ny.push(b.next().unwrap_or_default());
                }
                let vx: u128 = nx.trim_start_matches('0').parse().unwrap_or(0);
                let vy: u128 = ny.trim_start_matches('0').parse().unwrap_or(0);
                match vx.cmp(&vy) {
                    std::cmp::Ordering::Equal => {}
                    other => return other,
                }
            }
            (Some(x), Some(y)) => {
                a.next();
                b.next();
                match x.cmp(&y) {
                    std::cmp::Ordering::Equal => {}
                    other => return other,
                }
            }
        }
    }
}

/// Lista el contenido de una carpeta, ya filtrado y ordenado.
///
/// Las carpetas van primero y luego los archivos, cada grupo con orden natural
/// insensible a mayúsculas. Se omiten los ocultos (nombre que empieza por `.`)
/// y lo que el sistema no deja leer: una entrada ilegible no tumba el listado
/// (principio III).
///
/// @param path Carpeta que se lista.
/// @param only Qué se quiere ver: solo carpetas, carpetas y modelos, o todo.
pub fn list_directory(path: &Path, only: ListOnly) -> Result<Vec<DirectoryEntry>, AppError> {
    let metadata = fs::metadata(path).map_err(|error| to_app_error(&error, "path_denied"))?;
    if !metadata.is_dir() {
        return Err(AppError::new("path_not_a_directory", "La ruta no es una carpeta."));
    }

    let reader = fs::read_dir(path).map_err(|error| to_app_error(&error, "path_denied"))?;
    let mut entries: Vec<DirectoryEntry> = Vec::new();

    for item in reader {
        let Ok(item) = item else { continue };
        let name = item.file_name().to_string_lossy().to_string();
        if name.starts_with('.') {
            continue;
        }
        let Ok(metadata) = item.metadata() else { continue };
        let is_directory = metadata.is_dir();
        let entry_path = item.path();
        let is_model = !is_directory && is_model_file(&entry_path);

        let keep = match only {
            ListOnly::Folders => is_directory,
            ListOnly::Models => is_directory || is_model,
            ListOnly::All => is_directory || metadata.is_file(),
        };
        if !keep {
            continue;
        }

        let stamp = stamp_of(&metadata);
        entries.push(DirectoryEntry {
            name,
            path: entry_path.to_string_lossy().to_string(),
            is_directory,
            size_bytes: stamp.size_bytes,
            modified_ms: stamp.modified_ms,
            is_model,
        });
    }

    entries.sort_by(|left, right| {
        right
            .is_directory
            .cmp(&left.is_directory)
            .then_with(|| natural_cmp(&left.name, &right.name))
    });
    Ok(entries)
}

/// Crea una carpeta dentro de otra y devuelve su nombre real.
///
/// Si el nombre ya está ocupado se numera (` 2`, ` 3`, …) hasta encontrar uno
/// libre: la numeración la decide Rust, no la interfaz (FR-010).
///
/// @param parent Carpeta donde se crea la nueva.
/// @param name Nombre pedido, sin separadores de ruta.
pub fn create_directory(parent: &Path, name: &str) -> Result<CreatedDirectory, AppError> {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Err(AppError::new("path_invalid", "El nombre de la carpeta está vacío."));
    }
    if trimmed.contains('/') || trimmed.contains('\\') || trimmed.contains(':') {
        return Err(AppError::new(
            "path_invalid",
            "El nombre de la carpeta no puede llevar separadores de ruta.",
        ));
    }
    if !parent.is_dir() {
        return Err(AppError::new("path_not_found", "La carpeta de destino ya no existe."));
    }

    for attempt in 1..=1_000 {
        let candidate =
            if attempt == 1 { trimmed.to_string() } else { format!("{trimmed} {attempt}") };
        let path = parent.join(&candidate);
        match fs::create_dir(&path) {
            Ok(()) => {
                return Ok(CreatedDirectory {
                    name: candidate,
                    path: path.to_string_lossy().to_string(),
                })
            }
            Err(error) if error.kind() == io::ErrorKind::AlreadyExists => continue,
            Err(error) => return Err(to_app_error(&error, "path_denied")),
        }
    }

    Err(AppError::new("path_invalid", "No queda ningún nombre libre para esa carpeta."))
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Directorio temporal propio de cada prueba, sin dependencias externas.
    fn temp_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("sql-designer-files-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).expect("directorio temporal");
        dir
    }

    /// Sello real del archivo que hay en el disco.
    fn stamp_on_disk(path: &Path) -> FileStamp {
        stamp_of(&fs::metadata(path).expect("metadatos"))
    }

    #[test]
    fn escribir_y_leer_devuelve_el_mismo_texto() {
        let dir = temp_dir("ida-vuelta");
        let path = dir.join("modelo.yaml");

        let written = write_model(&path, "formatVersion: 1\n", None, false).expect("escritura");
        let read = read_model(&path).expect("lectura");

        assert_eq!(read.text, "formatVersion: 1\n");
        assert_eq!(read.stamp, written.stamp);
    }

    #[test]
    fn crear_sobre_un_archivo_existente_devuelve_path_exists() {
        let dir = temp_dir("repetido");
        let path = dir.join("modelo.yaml");
        write_model(&path, "uno", None, false).expect("primera escritura");

        let error = write_model(&path, "dos", None, false).expect_err("debe rechazar");

        assert_eq!(error.code, "path_exists");
        assert_eq!(fs::read_to_string(&path).expect("lectura"), "uno");
    }

    #[test]
    fn un_sello_obsoleto_no_escribe_y_devuelve_model_stale() {
        let dir = temp_dir("sello");
        let path = dir.join("modelo.yaml");
        write_model(&path, "uno", None, false).expect("primera escritura");
        let obsoleto = FileStamp { modified_ms: 1, size_bytes: 1 };

        let error = write_model(&path, "dos", Some(obsoleto), false).expect_err("debe rechazar");

        assert_eq!(error.code, "model_stale");
        assert_eq!(fs::read_to_string(&path).expect("lectura"), "uno");
    }

    #[test]
    fn con_force_se_sobrescribe_aunque_el_sello_no_coincida() {
        let dir = temp_dir("force");
        let path = dir.join("modelo.yaml");
        write_model(&path, "uno", None, false).expect("primera escritura");
        let obsoleto = FileStamp { modified_ms: 1, size_bytes: 1 };

        write_model(&path, "dos", Some(obsoleto), true).expect("sobrescritura");

        assert_eq!(fs::read_to_string(&path).expect("lectura"), "dos");
    }

    #[test]
    fn guardar_con_el_sello_vigente_actualiza_el_archivo() {
        let dir = temp_dir("vigente");
        let path = dir.join("modelo.yaml");
        write_model(&path, "uno", None, false).expect("primera escritura");
        let vigente = stamp_on_disk(&path);

        let result = write_model(&path, "dos largo", Some(vigente), false).expect("escritura");

        assert_eq!(fs::read_to_string(&path).expect("lectura"), "dos largo");
        assert_eq!(result.stamp, stamp_on_disk(&path));
    }

    #[test]
    fn leer_un_archivo_que_no_esta_devuelve_path_not_found() {
        let dir = temp_dir("ausente");

        let error = read_model(&dir.join("no-esta.yaml")).expect_err("debe fallar");

        assert_eq!(error.code, "path_not_found");
    }

    #[test]
    fn guardar_en_una_carpeta_borrada_devuelve_path_not_found() {
        let dir = temp_dir("carpeta-borrada");
        let path = dir.join("sub").join("modelo.yaml");

        let error = write_model(&path, "uno", None, false).expect_err("debe fallar");

        assert_eq!(error.code, "path_not_found");
    }

    #[test]
    fn un_fallo_de_escritura_no_deja_el_archivo_anterior_truncado() {
        let dir = temp_dir("sin-truncar");
        let path = dir.join("modelo.yaml");
        write_model(&path, "contenido anterior", None, false).expect("primera escritura");
        // El destino pasa a ser un directorio: el renombrado falla y el
        // archivo anterior tiene que seguir intacto.
        let ocupado = dir.join("ocupado.yaml");
        fs::create_dir_all(&ocupado).expect("directorio ocupado");

        let error = write_model(&ocupado, "nuevo", None, true).expect_err("debe fallar");

        // El código depende del sistema: renombrar encima de un directorio da
        // «acceso denegado» en Windows y un error sin traducción propia en
        // macOS. Lo que importa y es igual en los dos es que la escritura
        // falla, el archivo anterior sigue entero y el temporal no se queda.
        assert!(
            error.code == "model_write_failed" || error.code == "path_denied",
            "código inesperado: {}",
            error.code
        );
        assert_eq!(fs::read_to_string(&path).expect("lectura"), "contenido anterior");
        assert!(!dir.join(format!(".ocupado.yaml.{}.tmp", std::process::id())).exists());
    }

    #[test]
    fn stat_paths_no_falla_con_rutas_inaccesibles() {
        let dir = temp_dir("stat");
        let presente = dir.join("modelo.yaml");
        write_model(&presente, "uno", None, false).expect("escritura");
        let ausente = dir.join("no-esta.yaml");

        let stats = stat_paths(&[
            presente.to_string_lossy().to_string(),
            ausente.to_string_lossy().to_string(),
        ]);

        assert_eq!(stats.len(), 2);
        assert!(stats[0].exists);
        assert_eq!(stats[0].stamp, Some(stamp_on_disk(&presente)));
        assert!(!stats[1].exists);
        assert!(stats[1].stamp.is_none());
    }

    /// Crea una carpeta con contenido variado para las pruebas del listado.
    fn fixture_dir(name: &str) -> PathBuf {
        let dir = temp_dir(name);
        fs::create_dir(dir.join("Zeta")).expect("carpeta");
        fs::create_dir(dir.join("alfa")).expect("carpeta");
        fs::create_dir(dir.join(".oculta")).expect("carpeta");
        fs::write(dir.join("modelo 2.yaml"), "a").expect("archivo");
        fs::write(dir.join("modelo 10.yaml"), "a").expect("archivo");
        fs::write(dir.join("MODELO.YAML"), "a").expect("archivo");
        fs::write(dir.join("notas.txt"), "a").expect("archivo");
        fs::write(dir.join(".oculto.yaml"), "a").expect("archivo");
        dir
    }

    /// Nombres de las entradas, en el orden en el que vinieron.
    fn names(entries: &[DirectoryEntry]) -> Vec<String> {
        entries.iter().map(|entry| entry.name.clone()).collect()
    }

    #[test]
    fn listar_solo_carpetas_deja_fuera_los_archivos_y_los_ocultos() {
        let dir = fixture_dir("listar-carpetas");

        let entries = list_directory(&dir, ListOnly::Folders).expect("listado");

        assert_eq!(names(&entries), vec!["alfa", "Zeta"]);
    }

    #[test]
    fn listar_modelos_trae_carpetas_y_yaml_sin_distinguir_mayusculas() {
        let dir = fixture_dir("listar-modelos");

        let entries = list_directory(&dir, ListOnly::Models).expect("listado");

        assert_eq!(
            names(&entries),
            vec!["alfa", "Zeta", "modelo 2.yaml", "modelo 10.yaml", "MODELO.YAML"]
        );
        assert!(entries.iter().filter(|entry| !entry.is_directory).all(|entry| entry.is_model));
    }

    #[test]
    fn listar_todo_trae_tambien_los_que_no_son_modelos() {
        let dir = fixture_dir("listar-todo");

        let entries = list_directory(&dir, ListOnly::All).expect("listado");

        assert_eq!(
            names(&entries),
            vec!["alfa", "Zeta", "modelo 2.yaml", "modelo 10.yaml", "MODELO.YAML", "notas.txt"]
        );
        let notas = entries.iter().find(|entry| entry.name == "notas.txt").expect("notas");
        assert!(!notas.is_model);
        assert_eq!(notas.size_bytes, 1);
    }

    #[test]
    fn listar_una_ruta_que_no_esta_devuelve_path_not_found() {
        let dir = temp_dir("listar-ausente");

        let error = list_directory(&dir.join("no-esta"), ListOnly::All).expect_err("debe fallar");

        assert_eq!(error.code, "path_not_found");
    }

    #[test]
    fn listar_un_archivo_devuelve_path_not_a_directory() {
        let dir = temp_dir("listar-archivo");
        let path = dir.join("modelo.yaml");
        fs::write(&path, "a").expect("archivo");

        let error = list_directory(&path, ListOnly::All).expect_err("debe fallar");

        assert_eq!(error.code, "path_not_a_directory");
    }

    #[test]
    fn listar_mil_entradas_devuelve_las_mil_en_orden_natural() {
        // El comando es `async` (ver `commands::fs_list_directory`), así que
        // esta prueba solo comprueba que el listado aguanta el volumen de
        // FR-042 y no reordena como texto.
        let dir = temp_dir("listar-mil");
        for index in 1..=1_000 {
            fs::write(dir.join(format!("modelo {index}.yaml")), "a").expect("archivo");
        }

        let entries = list_directory(&dir, ListOnly::Models).expect("listado");

        assert_eq!(entries.len(), 1_000);
        assert_eq!(entries[0].name, "modelo 1.yaml");
        assert_eq!(entries[1].name, "modelo 2.yaml");
        assert_eq!(entries[999].name, "modelo 1000.yaml");
    }

    #[test]
    fn crear_una_carpeta_libre_usa_el_nombre_pedido() {
        let dir = temp_dir("crear-libre");

        let created = create_directory(&dir, "carpeta sin título").expect("carpeta");

        assert_eq!(created.name, "carpeta sin título");
        assert!(dir.join("carpeta sin título").is_dir());
    }

    #[test]
    fn crear_dos_veces_el_mismo_nombre_lo_numera() {
        let dir = temp_dir("crear-repetido");

        create_directory(&dir, "carpeta sin título").expect("primera");
        let segunda = create_directory(&dir, "carpeta sin título").expect("segunda");
        let tercera = create_directory(&dir, "carpeta sin título").expect("tercera");

        assert_eq!(segunda.name, "carpeta sin título 2");
        assert_eq!(tercera.name, "carpeta sin título 3");
    }

    #[test]
    fn crear_una_carpeta_con_separadores_devuelve_path_invalid() {
        let dir = temp_dir("crear-separador");

        assert_eq!(create_directory(&dir, "").expect_err("vacío").code, "path_invalid");
        assert_eq!(
            create_directory(&dir, "sub/otra").expect_err("separador").code,
            "path_invalid"
        );
    }

    #[test]
    fn crear_una_carpeta_sin_padre_devuelve_path_not_found() {
        let dir = temp_dir("crear-sin-padre");

        let error = create_directory(&dir.join("no-esta"), "nueva").expect_err("debe fallar");

        assert_eq!(error.code, "path_not_found");
    }

    #[test]
    fn build_model_path_anade_la_extension_y_dice_si_existe() {
        let dir = temp_dir("ruta");

        let built = build_model_path(&dir, "livy-reservas").expect("ruta");
        assert_eq!(built.file_name, "livy-reservas.yaml");
        assert!(!built.exists);

        write_model(Path::new(&built.path), "uno", None, false).expect("escritura");
        let again = build_model_path(&dir, "livy-reservas").expect("ruta");
        assert!(again.exists);
    }

    #[test]
    fn build_model_path_rechaza_nombres_imposibles() {
        let dir = temp_dir("ruta-invalida");

        assert_eq!(build_model_path(&dir, "").expect_err("vacío").code, "path_invalid");
        assert_eq!(
            build_model_path(&dir, "sub/modelo").expect_err("separador").code,
            "path_invalid"
        );
        assert_eq!(build_model_path(&dir, "con").expect_err("reservado").code, "path_invalid");
    }
}
