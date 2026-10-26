use serde::Serialize;

use crate::preferences::{WindowGeometry, MIN_HEIGHT, MIN_WIDTH};

/// Área utilizable de un monitor, en píxeles lógicos.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct MonitorArea {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

impl MonitorArea {
    /// ¿El punto cae dentro de este monitor?
    fn contains(&self, x: i32, y: i32) -> bool {
        x >= self.x
            && y >= self.y
            && x < self.x.saturating_add(self.width as i32)
            && y < self.y.saturating_add(self.height as i32)
    }
}

/// Resultado de restaurar la geometría (contrato `window_apply_saved_geometry`).
#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GeometryApplyResult {
    pub applied: bool,
    pub clamped: bool,
}

/// Recorta una geometría guardada al área visible de los monitores conectados.
///
/// Pasos: fuerza el tamaño mínimo de 820 × 500 (FR-013); busca el monitor que
/// contiene el centro de la ventana y, si no hay ninguno, usa el principal;
/// reduce el tamaño si no cabe en ese monitor y mueve la posición hasta que la
/// ventana entre completa.
///
/// @param geometry Geometría recordada en las preferencias.
/// @param monitors Monitores conectados; puede estar vacío.
/// @param primary Monitor principal, al que se reposiciona lo que no cabe.
/// @returns La geometría usable y si hubo que corregirla.
pub fn clamp_to_monitors(
    geometry: WindowGeometry,
    monitors: &[MonitorArea],
    primary: MonitorArea,
) -> (WindowGeometry, bool) {
    let mut result = geometry;

    result.width = result.width.max(MIN_WIDTH);
    result.height = result.height.max(MIN_HEIGHT);

    let center_x = result.x.saturating_add(result.width as i32 / 2);
    let center_y = result.y.saturating_add(result.height as i32 / 2);

    let target = monitors
        .iter()
        .copied()
        .find(|monitor| monitor.contains(center_x, center_y))
        .unwrap_or(primary);

    result.width = result.width.min(target.width).max(MIN_WIDTH);
    result.height = result.height.min(target.height).max(MIN_HEIGHT);

    let max_x = target.x + (target.width as i32 - result.width as i32).max(0);
    let max_y = target.y + (target.height as i32 - result.height as i32).max(0);
    result.x = result.x.clamp(target.x, max_x);
    result.y = result.y.clamp(target.y, max_y);

    (result, result != geometry)
}

/// Tamaño de la ventana cuando se ve la Bienvenida, en píxeles lógicos.
///
/// Alto por encima del mínimo de 820 × 500: Nuevo modelo tiene cinco bloques
/// desde que el nombre del archivo se puede cambiar a mano, y a 500 el pie de
/// la hoja quedaba fuera de la ventana.
pub const WELCOME_SIZE: (f64, f64) = (820.0, 580.0);

/// Tamaño mínimo de la ventana cuando se trabaja en el Editor.
pub const EDITOR_MIN_SIZE: (f64, f64) = (900.0, 600.0);

/// Convierte píxeles físicos a lógicos antes de comparar con el mínimo.
///
/// `tauri-plugin-window-state` guarda el tamaño en píxeles físicos, así que
/// sin dividir por el factor de escala una pantalla Retina parece el doble de
/// grande de lo que es (anotado en `research.md` §3).
///
/// @param value Medida en píxeles físicos.
/// @param scale_factor Factor de escala del monitor, mayor que cero.
pub fn to_logical(value: u32, scale_factor: f64) -> u32 {
    if scale_factor <= 0.0 {
        return value;
    }
    (f64::from(value) / scale_factor).round() as u32
}

/// Rectángulo de ventana en píxeles lógicos.
///
/// Se usa para llevar la ventana de una pantalla a otra: el cambio de modo no
/// salta, recorre el camino entre el rectángulo de partida y el de destino.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Rect {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

/// Cuánto dura el paso de una pantalla a otra, en milisegundos.
///
/// Es el `--duration-base` de Aura más un poco: la ventana recorre bastante
/// más camino que un elemento de la interfaz y con 260 ms se siente brusca.
pub const MODE_ANIM_MS: u64 = 300;

/// Cada cuánto se mueve la ventana mientras dura el cambio, en milisegundos.
///
/// Doce milisegundos dan unos 83 fotogramas por segundo: por encima de lo que
/// se nota y por debajo de lo que satura al compositor con ventanas grandes.
pub const MODE_ANIM_STEP_MS: u64 = 12;

/// Cuántos pasos tiene el cambio de modo, al menos uno.
pub fn mode_anim_steps() -> u32 {
    ((MODE_ANIM_MS / MODE_ANIM_STEP_MS) as u32).max(1)
}

/// Curva de salida de Aura (`--easing-out`): arranca rápido y frena al final.
///
/// @param progress Avance entre 0 y 1; fuera de ese rango se recorta.
pub fn ease_out(progress: f64) -> f64 {
    let progress = progress.clamp(0.0, 1.0);
    1.0 - (1.0 - progress).powi(3)
}

/// Punto del camino entre dos rectángulos.
///
/// @param from Rectángulo de partida.
/// @param to Rectángulo de destino.
/// @param progress Avance ya pasado por la curva, entre 0 y 1.
pub fn lerp_rect(from: Rect, to: Rect, progress: f64) -> Rect {
    let progress = progress.clamp(0.0, 1.0);
    let mix = |a: f64, b: f64| a + (b - a) * progress;
    Rect {
        x: mix(from.x, to.x),
        y: mix(from.y, to.y),
        width: mix(from.width, to.width),
        height: mix(from.height, to.height),
    }
}

/// Rectángulo de ese tamaño centrado dentro de un área.
///
/// @param area Área de trabajo del monitor.
/// @param width Ancho que se quiere, recortado al del área.
/// @param height Alto que se quiere, recortado al del área.
pub fn centered_in(area: Rect, width: f64, height: f64) -> Rect {
    let width = width.min(area.width);
    let height = height.min(area.height);
    Rect {
        x: area.x + (area.width - width) / 2.0,
        y: area.y + (area.height - height) / 2.0,
        width,
        height,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const PRIMARY: MonitorArea = MonitorArea { x: 0, y: 0, width: 1920, height: 1080 };
    const SECONDARY: MonitorArea = MonitorArea { x: 1920, y: 0, width: 1920, height: 1080 };


    #[test]
    fn rectangulo_dentro_del_area_queda_intacto() {
        let geometry = WindowGeometry { x: 100, y: 80, width: 1440, height: 900 };

        let (result, clamped) = clamp_to_monitors(geometry, &[PRIMARY, SECONDARY], PRIMARY);

        assert_eq!(result, geometry);
        assert!(!clamped);
    }

    #[test]
    fn rectangulo_fuera_se_reposiciona_al_monitor_principal() {
        // Geometría de un monitor que ya no está conectado.
        let geometry = WindowGeometry { x: 4000, y: 2000, width: 1440, height: 900 };

        let (result, clamped) = clamp_to_monitors(geometry, &[PRIMARY], PRIMARY);

        assert!(clamped);
        assert!(result.x >= PRIMARY.x && result.y >= PRIMARY.y);
        assert!(result.x + result.width as i32 <= PRIMARY.width as i32);
        assert!(result.y + result.height as i32 <= PRIMARY.height as i32);
    }

    #[test]
    fn tamano_mayor_que_el_area_se_recorta() {
        let geometry = WindowGeometry { x: 0, y: 0, width: 4000, height: 3000 };

        let (result, clamped) = clamp_to_monitors(geometry, &[PRIMARY], PRIMARY);

        assert!(clamped);
        assert_eq!(result.width, PRIMARY.width);
        assert_eq!(result.height, PRIMARY.height);
    }

    #[test]
    fn nunca_baja_del_minimo() {
        let geometry = WindowGeometry { x: 10, y: 10, width: 320, height: 200 };

        let (result, clamped) = clamp_to_monitors(geometry, &[PRIMARY], PRIMARY);

        assert!(clamped);
        assert_eq!(result.width, MIN_WIDTH);
        assert_eq!(result.height, MIN_HEIGHT);
    }

    #[test]
    fn el_minimo_manda_sobre_un_monitor_mas_pequeno() {
        let small = MonitorArea { x: 0, y: 0, width: 640, height: 400 };
        let geometry = WindowGeometry { x: 0, y: 0, width: 640, height: 400 };

        let (result, _) = clamp_to_monitors(geometry, &[small], small);

        assert_eq!(result.width, MIN_WIDTH);
        assert_eq!(result.height, MIN_HEIGHT);
    }

    #[test]
    fn la_ventana_del_segundo_monitor_se_queda_en_el_segundo() {
        let geometry = WindowGeometry { x: 2000, y: 100, width: 1440, height: 900 };

        let (result, clamped) = clamp_to_monitors(geometry, &[PRIMARY, SECONDARY], PRIMARY);

        assert_eq!(result, geometry);
        assert!(!clamped);
    }

    #[test]
    fn los_pixeles_fisicos_se_convierten_a_logicos() {
        assert_eq!(to_logical(2880, 2.0), 1440);
        assert_eq!(to_logical(1440, 1.0), 1440);
        assert_eq!(to_logical(1440, 0.0), 1440);
    }

    #[test]
    fn la_curva_de_salida_va_de_cero_a_uno_sin_retroceder() {
        assert_eq!(ease_out(0.0), 0.0);
        assert_eq!(ease_out(1.0), 1.0);
        assert_eq!(ease_out(-1.0), 0.0);
        assert_eq!(ease_out(2.0), 1.0);

        let mut previous = 0.0;
        for step in 1..=20 {
            let value = ease_out(f64::from(step) / 20.0);
            assert!(value >= previous, "la curva retrocede en {step}");
            previous = value;
        }
        // Arranca rápido: a mitad de camino ya ha recorrido más de la mitad.
        assert!(ease_out(0.5) > 0.5);
    }

    #[test]
    fn el_camino_entre_dos_rectangulos_empieza_y_acaba_donde_debe() {
        let from = Rect { x: 0.0, y: 0.0, width: 820.0, height: 580.0 };
        let to = Rect { x: 100.0, y: 50.0, width: 1620.0, height: 1000.0 };

        assert_eq!(lerp_rect(from, to, 0.0), from);
        assert_eq!(lerp_rect(from, to, 1.0), to);

        let half = lerp_rect(from, to, 0.5);
        assert_eq!(half.x, 50.0);
        assert_eq!(half.width, 1220.0);
    }

    #[test]
    fn el_rectangulo_centrado_reparte_el_sobrante_por_igual() {
        let area = Rect { x: 0.0, y: 25.0, width: 1920.0, height: 1055.0 };

        let rect = centered_in(area, 820.0, 580.0);

        assert_eq!(rect.width, 820.0);
        assert_eq!(rect.x, 550.0);
        assert_eq!(rect.y - area.y, area.height - rect.height - (rect.y - area.y));
    }

    #[test]
    fn el_rectangulo_centrado_nunca_pasa_del_area() {
        let area = Rect { x: 0.0, y: 0.0, width: 700.0, height: 500.0 };

        let rect = centered_in(area, 820.0, 580.0);

        assert_eq!(rect.width, 700.0);
        assert_eq!(rect.height, 500.0);
        assert_eq!(rect.x, 0.0);
    }

    #[test]
    fn el_cambio_de_modo_tiene_pasos_de_sobra_para_verse_fluido() {
        assert!(mode_anim_steps() >= 20);
    }
}
