import { app, core, dpi, event, image, menu, mocks, path, tray, webview, webviewWindow, window } from '@tauri-apps/api'

export interface Desktop {
  app: typeof app
  core: typeof core
  dpi: typeof dpi
  event: typeof event
  image: typeof image
  menu: typeof menu
  mocks: typeof mocks
  path: typeof path
  tray: typeof tray
  webview: typeof webview
  webviewWindow: typeof webviewWindow
  window: typeof window
}

export const desktop: Desktop = {
  app,
  core,
  dpi,
  event,
  image,
  menu,
  mocks,
  path,
  tray,
  webview,
  webviewWindow,
  window,
}

export interface OpenDevWindowOptions {
  title?: string
  width?: number
  height?: number
  darkMode?: boolean
  hotReload?: boolean
  nativeSidebar?: boolean
  sidebarWidth?: number
  sidebarConfig?: unknown
}

export async function openDevWindow(_port: number, _options?: OpenDevWindowOptions): Promise<boolean> {
  return false
}
