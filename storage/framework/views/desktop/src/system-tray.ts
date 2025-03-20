import {defaultWindowIcon} from "@tauri-apps/api/app";
import {TrayIcon, TrayIconOptions} from "@tauri-apps/api/tray";
import {Menu} from "@tauri-apps/api/menu";

const menu: Menu = {
  items: [
    {
      id: 'quit',
      text: 'Quit'
    }
  ]
}

export const systemTrayIconDefaults: TrayIconOptions = {
  icon: await defaultWindowIcon() || undefined,
  menu,
  showMenuOnLeftClick: false,
}

await TrayIcon.new(systemTrayIconDefaults)
