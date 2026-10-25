use serde::Serialize;

/// Nombre del producto tal como lo muestra la Bienvenida (FR-002).
pub const APP_NAME: &str = "SQL Designer";

/// Identidad del binario: lo único que la interfaz necesita saber de él.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppIdentity {
    pub name: String,
    pub version: String,
    pub build_date: String,
}

impl AppIdentity {
    /// Construye la identidad a partir de la versión declarada en
    /// `tauri.conf.json` y de la fecha que `build.rs` incrustó al compilar.
    ///
    /// @param version Versión del paquete, que Tauri lee de la configuración.
    pub fn new(version: &str) -> Self {
        Self {
            name: APP_NAME.to_string(),
            version: version.to_string(),
            build_date: env!("SQL_DESIGNER_BUILD_DATE").to_string(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn identidad_lleva_nombre_fijo_y_fecha_de_compilacion() {
        let identity = AppIdentity::new("1.0.0");
        assert_eq!(identity.name, "SQL Designer");
        assert_eq!(identity.version, "1.0.0");
        // Formato AAAA.MM.DD, sin asumir la fecha concreta de la compilación.
        assert_eq!(identity.build_date.len(), 10);
        assert_eq!(identity.build_date.matches('.').count(), 2);
    }
}
