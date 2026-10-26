use std::path::{Path, PathBuf};

use serde::Serialize;

/// Ubicaciones del usuario que la barra lateral de los diálogos de archivo
/// ofrece (FR-007, FR-012).
///
/// Solo se listan las que existen de verdad (`research.md` R6): una máquina
/// sin iCloud Drive o sin carpeta de Descargas no debe enseñar una ubicación
/// que no lleva a ninguna parte.

/// Nombre que se muestra cuando no se puede averiguar el del volumen.
const ROOT_FALLBACK_LABEL: &str = "Disco de inicio";

/// Una ubicación de la barra lateral.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Place {
    pub id: String,
    pub label: String,
    /// Nombre del icono de lucide-react.
    pub icon: String,
    /// `None` en la ubicación virtual «Recientes», que no es una carpeta.
    pub path: Option<String>,
    pub can_create_folder: bool,
}

/// Carpetas que el sistema resuelve y de las que salen las ubicaciones.
#[derive(Debug, Clone, Default)]
pub struct PlaceSources {
    pub home: Option<PathBuf>,
    pub desktop: Option<PathBuf>,
    pub documents: Option<PathBuf>,
    pub downloads: Option<PathBuf>,
    pub icloud: Option<PathBuf>,
    pub root: Option<PathBuf>,
}

/// Construye una ubicación con ruta si la carpeta existe.
fn folder(
    id: &str,
    label: &str,
    icon: &str,
    path: Option<&PathBuf>,
    can_create_folder: bool,
) -> Option<Place> {
    let path = path?;
    if !path.is_dir() {
        return None;
    }
    Some(Place {
        id: id.to_string(),
        label: label.to_string(),
        icon: icon.to_string(),
        path: Some(path.to_string_lossy().to_string()),
        can_create_folder,
    })
}

/// Nombre del volumen de arranque, para la última ubicación de la lista.
///
/// En macOS el volumen tiene el nombre que le puso el usuario, y la forma de
/// averiguarlo es buscar en `/Volumes` la entrada que apunta a la raíz. En
/// Windows se usa la letra de la unidad del sistema.
pub fn root_label(root: &Path) -> String {
    if cfg!(target_os = "windows") {
        let letter = root.to_string_lossy().trim_end_matches(['\\', '/']).to_string();
        return format!("Disco local ({letter})");
    }

    let Ok(entries) = std::fs::read_dir("/Volumes") else {
        return ROOT_FALLBACK_LABEL.to_string();
    };
    for entry in entries.flatten() {
        if std::fs::canonicalize(entry.path()).is_ok_and(|resolved| resolved == Path::new("/")) {
            return entry.file_name().to_string_lossy().to_string();
        }
    }
    ROOT_FALLBACK_LABEL.to_string()
}

/// Arma la lista de ubicaciones en el orden en que se muestran.
///
/// «Recientes» va primero y es virtual: su contenido lo compone el frontend
/// con `recents_list`, así que no trae ruta. La raíz del volumen no deja crear
/// carpetas, porque el sistema no lo permite sin permisos de administrador.
///
/// @param sources Carpetas que resolvió el sistema; las que no existan se
/// quedan fuera de la lista.
pub fn build_places(sources: &PlaceSources) -> Vec<Place> {
    let mut places = vec![Place {
        id: "recents".to_string(),
        label: "Recientes".to_string(),
        icon: "clock".to_string(),
        path: None,
        can_create_folder: false,
    }];

    let candidates = [
        folder("desktop", "Escritorio", "monitor", sources.desktop.as_ref(), true),
        folder("documents", "Documentos", "file-text", sources.documents.as_ref(), true),
        folder("downloads", "Descargas", "circle-arrow-down", sources.downloads.as_ref(), true),
        folder("home", "Inicio", "folder", sources.home.as_ref(), true),
        folder("icloud", "iCloud Drive", "cloud", sources.icloud.as_ref(), true),
    ];
    places.extend(candidates.into_iter().flatten());

    if let Some(root) = sources.root.as_ref() {
        if root.is_dir() {
            places.push(Place {
                id: "root".to_string(),
                label: root_label(root),
                icon: "hard-drive".to_string(),
                path: Some(root.to_string_lossy().to_string()),
                can_create_folder: false,
            });
        }
    }

    places
}

/// Ruta de iCloud Drive en macOS; en los demás sistemas no hay ninguna.
pub fn icloud_path(home: Option<&PathBuf>) -> Option<PathBuf> {
    if !cfg!(target_os = "macos") {
        return None;
    }
    Some(home?.join("Library/Mobile Documents/com~apple~CloudDocs"))
}

/// Raíz del volumen del sistema: `/` en macOS, la unidad del sistema en Windows.
pub fn root_path() -> PathBuf {
    if cfg!(target_os = "windows") {
        let drive = std::env::var("SystemDrive").unwrap_or_else(|_| "C:".to_string());
        return PathBuf::from(format!("{drive}\\"));
    }
    PathBuf::from("/")
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    /// Directorio temporal propio de cada prueba.
    fn temp_dir(name: &str) -> PathBuf {
        let dir =
            std::env::temp_dir().join(format!("sql-designer-places-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).expect("directorio temporal");
        dir
    }

    #[test]
    fn recientes_va_primero_y_no_tiene_ruta() {
        let places = build_places(&PlaceSources::default());

        assert_eq!(places[0].id, "recents");
        assert_eq!(places[0].path, None);
        assert!(!places[0].can_create_folder);
    }

    #[test]
    fn una_ubicacion_que_no_existe_no_se_lista() {
        let dir = temp_dir("inexistente");
        let sources = PlaceSources {
            documents: Some(dir.clone()),
            downloads: Some(dir.join("no-existe")),
            ..Default::default()
        };

        let places = build_places(&sources);

        assert!(places.iter().any(|place| place.id == "documents"));
        assert!(!places.iter().any(|place| place.id == "downloads"));
    }

    #[test]
    fn un_archivo_en_lugar_de_una_carpeta_tampoco_se_lista() {
        let dir = temp_dir("archivo");
        let file = dir.join("no-soy-carpeta");
        fs::write(&file, "x").expect("escritura");

        let places = build_places(&PlaceSources { desktop: Some(file), ..Default::default() });

        assert!(!places.iter().any(|place| place.id == "desktop"));
    }

    #[test]
    fn la_raiz_del_volumen_no_deja_crear_carpetas() {
        let places = build_places(&PlaceSources { root: Some(root_path()), ..Default::default() });

        let root = places.iter().find(|place| place.id == "root").expect("raíz");
        assert!(!root.can_create_folder);
        assert!(!root.label.is_empty());
    }

    #[test]
    fn las_carpetas_del_usuario_dejan_crear_carpetas() {
        let dir = temp_dir("usuario");

        let places = build_places(&PlaceSources { home: Some(dir), ..Default::default() });

        let home = places.iter().find(|place| place.id == "home").expect("inicio");
        assert!(home.can_create_folder);
        assert_eq!(home.icon, "folder");
    }

    #[test]
    fn icloud_solo_existe_en_macos() {
        let home = PathBuf::from("/Users/x");

        let path = icloud_path(Some(&home));

        if cfg!(target_os = "macos") {
            assert_eq!(path, Some(home.join("Library/Mobile Documents/com~apple~CloudDocs")));
        } else {
            assert_eq!(path, None);
        }
    }
}
