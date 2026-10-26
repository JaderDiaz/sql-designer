use std::path::Path;
use std::process::Command;

use crate::commands::AppError;

/// Salidas al sistema operativo: mostrar un archivo en el gestor, escribir en
/// el portapapeles y mover a la papelera.
///
/// Se usan procesos del sistema en vez de dependencias nuevas donde el sistema
/// ya trae la herramienta (`research.md` R8); la papelera sí necesita el crate
/// `trash`, porque no hay orden equivalente que respete poder recuperar.
///
/// Nada de esto entra en pánico: cada fallo vuelve como `AppError` con su
/// código del contrato (principio III).

/// Muestra el archivo seleccionado en el gestor de archivos del sistema.
///
/// macOS: `open -R`. Windows: `explorer /select,`. El `explorer` de Windows
/// devuelve un código distinto de cero incluso cuando abre bien, así que allí
/// solo se comprueba que el proceso haya podido lanzarse.
///
/// @param path Ruta del archivo que se quiere mostrar.
pub fn reveal_in_file_manager(path: &Path) -> Result<(), AppError> {
    if !path.exists() {
        return Err(AppError::new("path_not_found", "La ruta ya no existe."));
    }

    #[cfg(target_os = "macos")]
    let result = Command::new("open").arg("-R").arg(path).status().map(|status| status.success());

    #[cfg(target_os = "windows")]
    let result = Command::new("explorer")
        .arg(format!("/select,{}", path.display()))
        .status()
        .map(|_| true);

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    let result = Command::new("xdg-open")
        .arg(path.parent().unwrap_or(path))
        .status()
        .map(|status| status.success());

    match result {
        Ok(true) => Ok(()),
        Ok(false) => Err(AppError::new(
            "system_command_failed",
            "El gestor de archivos del sistema no pudo abrirse.",
        )),
        Err(error) => Err(AppError::new("system_command_failed", error.to_string())),
    }
}

/// Escribe texto en el portapapeles del sistema.
///
/// macOS: `pbcopy`. Windows: `Set-Clipboard` de PowerShell, sin perfil para
/// que no dependa de la configuración del usuario.
///
/// @param text Texto que queda en el portapapeles.
pub fn clipboard_write_text(text: &str) -> Result<(), AppError> {
    #[cfg(target_os = "macos")]
    let outcome = pipe_to("pbcopy", &[], text);

    #[cfg(target_os = "windows")]
    let outcome = pipe_to(
        "powershell",
        &["-NoProfile", "-Command", "$input | Set-Clipboard"],
        text,
    );

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    let outcome = pipe_to("xclip", &["-selection", "clipboard"], text);

    outcome
}

/// Lanza una orden del sistema y le pasa el texto por la entrada estándar.
///
/// @param program Nombre del ejecutable.
/// @param args Argumentos del ejecutable.
/// @param text Texto que se escribe en su entrada estándar.
fn pipe_to(program: &str, args: &[&str], text: &str) -> Result<(), AppError> {
    use std::io::Write;
    use std::process::Stdio;

    let mut child = Command::new(program)
        .args(args)
        .stdin(Stdio::piped())
        .spawn()
        .map_err(|error| AppError::new("system_command_failed", error.to_string()))?;

    if let Some(stdin) = child.stdin.as_mut() {
        stdin
            .write_all(text.as_bytes())
            .map_err(|error| AppError::new("system_command_failed", error.to_string()))?;
    }

    let status = child
        .wait()
        .map_err(|error| AppError::new("system_command_failed", error.to_string()))?;
    if status.success() {
        Ok(())
    } else {
        Err(AppError::new("system_command_failed", "El portapapeles del sistema no respondió."))
    }
}

/// Mueve el archivo a la papelera del sistema.
///
/// Cuando falla, el archivo sigue donde estaba: nunca se borra como plan B
/// (RS-08). La interfaz solo quita la entrada de recientes si esto sale bien.
///
/// @param path Ruta del archivo que se manda a la papelera.
pub fn trash_move(path: &Path) -> Result<(), AppError> {
    if !path.exists() {
        return Err(AppError::new("path_not_found", "La ruta ya no existe."));
    }
    trash::delete(path).map_err(|error| {
        AppError::new("trash_unavailable", format!("No se pudo usar la papelera: {error}"))
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn mostrar_una_ruta_que_no_esta_devuelve_path_not_found() {
        let path = std::env::temp_dir().join("sql-designer-no-esta.yaml");
        let _ = std::fs::remove_file(&path);

        let error = reveal_in_file_manager(&path).expect_err("debe fallar");

        assert_eq!(error.code, "path_not_found");
    }

    #[test]
    fn mandar_a_la_papelera_una_ruta_que_no_esta_devuelve_path_not_found() {
        let path = std::env::temp_dir().join("sql-designer-papelera-no-esta.yaml");
        let _ = std::fs::remove_file(&path);

        let error = trash_move(&path).expect_err("debe fallar");

        assert_eq!(error.code, "path_not_found");
    }

    #[test]
    fn una_orden_que_no_existe_devuelve_system_command_failed() {
        let error = pipe_to("sql-designer-orden-inexistente", &[], "texto").expect_err("debe fallar");

        assert_eq!(error.code, "system_command_failed");
    }
}
