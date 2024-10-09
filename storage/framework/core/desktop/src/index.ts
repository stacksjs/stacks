import * as app from '@tauri-apps/api/app'

import * as clipboard from '@tauri-apps/api/clipboard'
import * as dialog from '@tauri-apps/api/dialog'
import * as event from '@tauri-apps/api/event'
import * as fs from '@tauri-apps/api/fs'
import * as globalShortcut from '@tauri-apps/api/globalShortcut'
import * as http from '@tauri-apps/api/http'
import * as mocks from '@tauri-apps/api/mocks'
import * as notification from '@tauri-apps/api/notification'
import * as os from '@tauri-apps/api/os'
import * as path from '@tauri-apps/api/path'
import * as process from '@tauri-apps/api/process'
import { open as shellOpen } from '@tauri-apps/api/shell'
import * as shell from '@tauri-apps/api/shell'
import * as tauri from '@tauri-apps/api/tauri'
import * as updater from '@tauri-apps/api/updater'
import * as window from '@tauri-apps/api/window'

export const desktop = {
  app,
  event,
  clipboard,
  dialog,
  fs,
  globalShortcut,
  http,
  mocks,
  notification,
  os,
  path,
  process,
  shell,
  tauri,
  updater,
  window,
}

export async function openShell(link: string) {
  await shellOpen(link)
}

export * from './system-tray'
