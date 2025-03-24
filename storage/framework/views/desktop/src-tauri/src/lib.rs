// mod commands;
#[cfg_attr(mobile, tauri::mobile_entry_point)]

// use tauri::{
//   menu::{Menu, MenuItem},
//   tray::TrayIconBuilder,
// };

pub fn run() {
   tauri::Builder::default()
//    .setup(|app| {
//           let refresh = MenuItem::with_id(app, "refresh", "Refresh", true, None::<&str>)?;
//           let open_terminal = MenuItem::with_id(app, "open_terminal", "Open Terminal", true, None::<&str>)?;
//           let env_check = MenuItem::with_id(app, "env_check", "Env Check", true, None::<&str>)?;
//           let settings = MenuItem::with_id(app, "settings", "Settings", true, None::<&str>)?;
//           let updates = MenuItem::with_id(app, "updates", "Check for Updates", true, None::<&str>)?;
//
//           let menu = Menu::with_items(app, &[
//             &refresh,
//             &open_terminal,
//             &env_check,
//             &settings,
//             &updates,
//           ])?;
//
//           let _tray = TrayIconBuilder::new()
//             .icon(app.default_window_icon().unwrap().clone())
//             .menu(&menu)
//             .show_menu_on_left_click(true)
//             .build(app)?;
//           Ok(())
//
//    })
//    .invoke_handler(tauri::generate_handler![
//       commands::my_custom_command,
//    ])
   .run(tauri::generate_context!())
   .expect("error while running tauri application");
}


