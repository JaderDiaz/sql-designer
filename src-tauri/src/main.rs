#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod files;
mod identity;
mod logging;
mod measure;
mod places;
mod preferences;
mod recents;
mod system;
mod window_state;

use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::{Emitter, Manager, WindowEvent};

use commands::{CloseGuard, PreferencesState, RecentsState};
use logging::SCOPE_STARTUP;
use measure::StartupClock;

/// Identificador del elemento de menú que abre Ajustes (FR-020).
const MENU_PREFERENCES: &str = "preferences";

/// Evento que las tres vías de FR-020 comparten para abrir Ajustes.
const EVENT_PREFERENCES_OPEN: &str = "preferences://open";

/// Evento con el que la ventana pide permiso para cerrarse (FR-028).
const EVENT_CLOSE_REQUESTED: &str = "window://close-requested";

/// Identificadores de los elementos del menú Archivo.
///
/// La interfaz no tiene menús del navegador —se desactivan para que no salgan
/// los del sistema—, así que las acciones del modelo viven en el menú nativo,
/// que es donde un usuario de macOS las busca.
const MENU_NEW_MODEL: &str = "archivo://nuevo-modelo";
const MENU_OPEN_MODEL: &str = "archivo://abrir-modelo";
const MENU_SAVE_MODEL: &str = "archivo://guardar";
const MENU_CLOSE_MODEL: &str = "archivo://cerrar-modelo";

/// Evento con la acción elegida en el menú Archivo; lleva el identificador.
const EVENT_MENU_ACTION: &str = "menu://action";

/// Arranca la aplicación.
///
/// Pasos: registra el plugin de registro local y el de estado de ventana
/// limitado a tamaño y posición; resuelve la ruta de las preferencias y las
/// carga en memoria; construye el menú nativo con Ajustes; y expone los
/// comandos de `contracts/commands.md`. Un fallo de arranque se registra pero
/// no impide que la ventana abra (FR-019).
fn main() {
    // Primera línea del proceso: es el origen de la medida de SC-001.
    let startup_clock = StartupClock::new();

    let builder = tauri::Builder::default().plugin(logging::plugin());

    // Servidor de WebDriver para el recorrido automatizado de `quickstart.md`.
    // Solo existe con `--features webdriver`: abre automatización por HTTP en
    // 127.0.0.1:4445 y no debe entrar en una compilación de publicación.
    //
    // Va después del registro: `tauri-plugin-wdio` instala su propio `log`, y
    // si se adelanta, el nuestro ya no puede instalarse y el arranque revienta.
    #[cfg(feature = "webdriver")]
    let builder = builder
        .plugin(tauri_plugin_wdio_webdriver::init())
        .plugin(tauri_plugin_wdio::init());

    builder
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
        .setup(move |app| {
            app.manage(startup_clock);

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

            let recents_state = RecentsState::new(recents::file_path(&config_dir));
            let recent_entries = recents::load_from(&recents_state.path);
            if let Ok(mut current) = recents_state.current.lock() {
                *current = recent_entries;
            }
            app.manage(recents_state);
            app.manage(CloseGuard::default());

            if let Err(error) = install_menu(app.handle()) {
                log::warn!(target: SCOPE_STARTUP, "no se pudo construir el menú nativo: {error}");
            }

            // La ventana va sin decoración en los dos sistemas: el marco, los
            // controles de cerrar y minimizar y el arrastre los dibuja
            // `src/components/layout/AppShell.tsx` con `Titlebar`. En Windows
            // se repite aquí porque la configuración puede llegar pisada por
            // un perfil de usuario anterior.
            #[cfg(target_os = "windows")]
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_decorations(false);
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                if let Some(state) = window.try_state::<PreferencesState>() {
                    commands::remember_geometry(window, &state);
                }
                // Con cambios sin guardar el cierre se para aquí y se pregunta
                // en la interfaz; esta vuelve con `window_controls('close')`
                // cuando hay respuesta (FR-028). Si no hay nada que preguntar,
                // la propia interfaz contesta cerrando al instante.
                if let Some(state) = window.try_state::<commands::CloseGuard>() {
                    if state.is_armed() {
                        api.prevent_close();
                        let _ = window.emit(EVENT_CLOSE_REQUESTED, ());
                    }
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
            commands::measure_startup_ready,
            commands::measure_theme_applied,
            commands::measure_model_opened,
            commands::measure_model_saved,
            commands::fs_user_places,
            commands::path_build_model,
            commands::fs_list_directory,
            commands::fs_create_directory,
            commands::reveal_in_file_manager,
            commands::clipboard_write_text,
            commands::trash_move,
            commands::window_set_close_guard,
            commands::window_apply_mode,
            commands::model_read,
            commands::model_write,
            commands::model_stat,
            commands::recents_list,
            commands::recents_touch,
            commands::recents_remove,
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

    let file_menu = Submenu::with_items(
        app,
        "Archivo",
        true,
        &[
            &MenuItem::with_id(app, MENU_NEW_MODEL, "Nuevo modelo…", true, Some(accelerator("N")))?,
            &MenuItem::with_id(app, MENU_OPEN_MODEL, "Abrir modelo…", true, Some(accelerator("O")))?,
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(app, MENU_SAVE_MODEL, "Guardar", true, Some(accelerator("S")))?,
            &MenuItem::with_id(app, MENU_CLOSE_MODEL, "Cerrar modelo", true, Some(accelerator("W")))?,
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

    let menu = Menu::with_items(app, &[&app_menu, &file_menu, &edit_menu])?;
    app.set_menu(menu)?;
    app.on_menu_event(|app, event| {
        let id = event.id().as_ref();
        if id == MENU_PREFERENCES {
            if let Err(error) = app.emit(EVENT_PREFERENCES_OPEN, ()) {
                log::warn!(target: SCOPE_STARTUP, "no se pudo emitir {EVENT_PREFERENCES_OPEN}: {error}");
            }
            return;
        }
        if matches!(id, MENU_NEW_MODEL | MENU_OPEN_MODEL | MENU_SAVE_MODEL | MENU_CLOSE_MODEL) {
            if let Err(error) = app.emit(EVENT_MENU_ACTION, id) {
                log::warn!(target: SCOPE_STARTUP, "no se pudo emitir {EVENT_MENU_ACTION}: {error}");
            }
        }
    });

    Ok(())
}

/// Acelerador de un elemento del menú, con el modificador de cada sistema.
///
/// @param key Tecla del atajo, sin modificador.
fn accelerator(key: &str) -> String {
    format!("{}+{key}", if cfg!(target_os = "macos") { "Cmd" } else { "Ctrl" })
}
