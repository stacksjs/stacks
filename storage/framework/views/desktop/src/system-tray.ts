import { TrayIcon } from "@tauri-apps/api/tray";
import {defaultWindowIcon} from "@tauri-apps/api/app";
import { Menu } from '@tauri-apps/api/menu';
// import { invoke } from '@tauri-apps/api/core';

// export const testCall = () => {
//   // Invoke the command
//   invoke('my_custom_command');
// }

export const initSystemTray = async () => {
  const menu = await Menu.new({
    items: [
      {
        id: 'refresh',
        text: 'Refresh',
      },
      {
        id: 'open_terminal',
        text: 'Open Terminal',
      },
      {
        id: 'env_check',
        text: 'Env Check',
      },
      {
        id: 'settings',
        text: 'Settings',
      },
      {
        id: 'check_updates',
        text: 'Check for Updates...',
      },
    ],
  });

  const options = {
    menu,
    icon: await defaultWindowIcon(),
  }
  await TrayIcon.new(options)
}
