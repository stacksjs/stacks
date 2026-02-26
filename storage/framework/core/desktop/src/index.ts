export interface Desktop {
  app: unknown
  core: unknown
  dpi: unknown
  event: unknown
  image: unknown
  menu: unknown
  mocks: unknown
  path: unknown
  tray: unknown
  webview: unknown
  webviewWindow: unknown
  window: unknown
}

let _desktop: Desktop | undefined

export async function getDesktop(): Promise<Desktop> {
  if (_desktop) return _desktop

  const tauri = await import('@tauri-apps/api')
  _desktop = {
    app: tauri.app,
    core: tauri.core,
    dpi: tauri.dpi,
    event: tauri.event,
    image: tauri.image,
    menu: tauri.menu,
    mocks: tauri.mocks,
    path: tauri.path,
    tray: tauri.tray,
    webview: tauri.webview,
    webviewWindow: tauri.webviewWindow,
    window: tauri.window,
  }

  return _desktop
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
