#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod identity;
mod logging;
mod preferences;
mod window_state;

use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::{Emitter, Manager, WindowEvent};

use commands::PreferencesState;
use logging::SCOPE_STARTUP;

/// Identificador del elemento de menú que abre Ajustes (FR-020).
const MENU_PREFERENCES: &str = "preferences";

/// Evento que las tres vías de FR-020 comparten para abrir Ajustes.
const EVENT_PREFERENCES_OPEN: &str = "preferences://open";

/// Arranca la aplicación.
///
/// Pasos: registra el plugin de registro local y el de estado de ventana
/// limitado a tamaño y posición; resuelve la ruta de las preferencias y las
/// carga en memoria; construye el menú nativo con Ajustes; y expone los
/// comandos de `contracts/commands.md`. Un fallo de arranque se registra pero
/// no impide que la ventana abra (FR-019).
fn main() {
    tauri::Builder::default()
        .plugin(logging::plugin())
        .plugin(
            tauri_plugin_window_state::Builder::default()
                // Sin la bandera de maximizado: la ventana no recuerda si quedó
                // maximizada, solo tamaño y posición (FR-018).
                .with_state_flags(
                    tauri_plugin_window_state::StateFlags::SIZE
                        | tauri_plugin_window_state::StateFlags::POSITION,
                )
                .build(),
        )
        .setup(|app| {
            let config_dir = app.path().app_config_dir().unwrap_or_else(|error| {
                log::error!(target: SCOPE_STARTUP, "sin directorio de configuración: {error}");
                std::env::temp_dir()
            });
            let state = PreferencesState::new(preferences::file_path(&config_dir));

            let loaded = preferences::load_from(&state.path);
            if loaded.recovered {
                log::warn!(
                    target: SCOPE_STARTUP,
                    "preferencias recuperadas por defecto ({})",
                    loaded.recovered_reason.clone().unwrap_or_default()
                );
            }
            if let Ok(mut current) = state.current.lock() {
                *current = loaded.preferences;
            }
            app.manage(state);

            if let Err(error) = install_menu(app.handle()) {
                log::warn!(target: SCOPE_STARTUP, "no se pudo construir el menú nativo: {error}");
            }

            // En Windows la ventana va sin decoración porque la barra de título
            // la dibuja `src/components/layout/Titlebar.tsx`; en macOS se
            // conservan los botones nativos con la barra superpuesta.
            #[cfg(target_os = "windows")]
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_decorations(false);
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { .. } = event {
                if let Some(state) = window.try_state::<PreferencesState>() {
                    commands::remember_geometry(window, &state);
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::app_identity,
            commands::platform_info,
            commands::preferences_load,
            commands::preferences_update,
            commands::window_apply_saved_geometry,
            commands::window_controls,
        ])
        .run(tauri::generate_context!())
        .expect("error irrecuperable al arrancar SQL Designer");
}

/// Construye el menú nativo con el elemento Ajustes y su acelerador.
///
/// El elemento emite `preferences://open` en lugar de abrir nada por su
/// cuenta, para que atajo, menú y control visible converjan en una sola
/// acción del almacén (FR-020).
fn install_menu(app: &tauri::AppHandle) -> tauri::Result<()> {
    let preferences_item = MenuItem::with_id(
        app,
        MENU_PREFERENCES,
        "Ajustes…",
        true,
        Some(if cfg!(target_os = "macos") { "Cmd+," } else { "Ctrl+," }),
    )?;

    let app_menu = Submenu::with_items(
        app,
        identity::APP_NAME,
        true,
        &[
            &preferences_item,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::quit(app, Some("Salir"))?,
        ],
    )?;

    let edit_menu = Submenu::with_items(
        app,
        "Edición",
        true,
        &[
            &PredefinedMenuItem::undo(app, Some("Deshacer"))?,
            &PredefinedMenuItem::redo(app, Some("Rehacer"))?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::cut(app, Some("Cortar"))?,
            &PredefinedMenuItem::copy(app, Some("Copiar"))?,
            &PredefinedMenuItem::paste(app, Some("Pegar"))?,
            &PredefinedMenuItem::select_all(app, Some("Seleccionar todo"))?,
        ],
    )?;

    let menu = Menu::with_items(app, &[&app_menu, &edit_menu])?;
    app.set_menu(menu)?;
    app.on_menu_event(|app, event| {
        if event.id() == MENU_PREFERENCES {
            if let Err(error) = app.emit(EVENT_PREFERENCES_OPEN, ()) {
                log::warn!(target: SCOPE_STARTUP, "no se pudo emitir {EVENT_PREFERENCES_OPEN}: {error}");
            }
        }
    });

    Ok(())
}
