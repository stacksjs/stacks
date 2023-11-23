// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use tauri::{CustomMenuItem, Menu, MenuItem, Submenu};

#[derive(Clone, serde::Serialize)]
struct Payload {
  message: String,
}

fn main() {
  let npm = CustomMenuItem::new("npm".to_string(), "Npm");
  let redis = CustomMenuItem::new("redis".to_string(), "Redis");
  let deps = Submenu::new("Dependencies", Menu::new().add_item(npm).add_item(redis));

  let settings = CustomMenuItem::new("settings".to_string(), "Settings");
  let quit = CustomMenuItem::new("quit".to_string(), "Quit");
  let file_menu = Submenu::new("File", Menu::new().add_item(settings).add_item(quit));

  let menu = Menu::new()
  .add_native_item(MenuItem::Copy)
  .add_item(CustomMenuItem::new("hide", "Hide"))
  .add_submenu(deps)
  .add_submenu(file_menu);

  tauri::Builder::default()
    .menu(menu)
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}