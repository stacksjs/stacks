import * as shell from '@tauri-apps/api/shell'
import { open as shellOpen } from '@tauri-apps/api/shell'

export * from '@tauri-apps/api/app'
export * from '@tauri-apps/api/event'
export * from '@tauri-apps/api/clipboard'
export * from '@tauri-apps/api/dialog'
export * from '@tauri-apps/api/fs'
export * from '@tauri-apps/api/globalShortcut'
export * from '@tauri-apps/api/http'
export * from '@tauri-apps/api/mocks'
export * from '@tauri-apps/api/notification'
export * from '@tauri-apps/api/os'
export * from '@tauri-apps/api/path'
export * from '@tauri-apps/api/process'
export * from '@tauri-apps/api/tauri'
export * from '@tauri-apps/api/updater'
export * from '@tauri-apps/api/window'

export const {
  // list all the properties you want to exclude
  open,
  ...rest
} = shell

export async function openShell(link: string) {
  await shellOpen(link)
}
