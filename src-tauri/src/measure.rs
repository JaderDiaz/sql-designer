use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Instant;

/// Variable de entorno que enciende las medidas de SC-001 y SC-003.
///
/// Apagadas por defecto: el registro local guarda fallos, no trazas de uso
/// (principio I de la constitución). Se encienden solo para la verificación
/// manual de `quickstart.md`, con `SQL_DESIGNER_MEDIR=1`.
pub const ENV_FLAG: &str = "SQL_DESIGNER_MEDIR";

/// Indica si esta ejecución debe anotar las medidas en el registro.
pub fn enabled() -> bool {
    enabled_from(std::env::var(ENV_FLAG).ok().as_deref())
}

/// Regla de decisión de [`enabled`], aislada para poder probarla.
///
/// @param value Valor de la variable de entorno, o `None` si no está puesta.
/// @returns `true` salvo que falte, esté vacía o valga `0`.
fn enabled_from(value: Option<&str>) -> bool {
    matches!(value, Some(value) if !value.is_empty() && value != "0")
}

/// Reloj de arranque: marca el instante en que empezó el proceso, que es el
/// origen de SC-001 («la Bienvenida lista en 2 segundos o menos»).
pub struct StartupClock {
    started: Instant,
    reported: AtomicBool,
}

impl StartupClock {
    /// Crea el reloj. Debe construirse en la primera línea de `main`.
    pub fn new() -> Self {
        Self { started: Instant::now(), reported: AtomicBool::new(false) }
    }

    /// Milisegundos transcurridos desde el arranque, una sola vez.
    ///
    /// @returns Los milisegundos la primera vez; `None` en las siguientes,
    /// para que una recarga de la interfaz no falsee la medida.
    pub fn elapsed_once(&self) -> Option<u128> {
        if self.reported.swap(true, Ordering::SeqCst) {
            return None;
        }
        Some(self.started.elapsed().as_millis())
    }
}

impl Default for StartupClock {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn el_reloj_solo_informa_la_primera_vez() {
        let clock = StartupClock::new();
        assert!(clock.elapsed_once().is_some());
        assert!(clock.elapsed_once().is_none());
    }

    #[test]
    fn las_medidas_estan_apagadas_salvo_peticion_expresa() {
        assert!(!enabled_from(None));
        assert!(!enabled_from(Some("")));
        assert!(!enabled_from(Some("0")));
        assert!(enabled_from(Some("1")));
        assert!(enabled_from(Some("si")));
    }
}
