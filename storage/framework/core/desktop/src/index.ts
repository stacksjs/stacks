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

// let _desktop: Desktop | undefined

// export async function getDesktop(): Promise<Desktop> {
//   if (_desktop) return _desktop

//   const tauri = await import('@tauri-apps/api')
//   _desktop = {
//     app: tauri.app,
//     core: tauri.core,
//     dpi: tauri.dpi,
//     event: tauri.event,
//     image: tauri.image,
//     menu: tauri.menu,
//     mocks: tauri.mocks,
//     path: tauri.path,
//     tray: tauri.tray,
//     webview: tauri.webview,
//     webviewWindow: tauri.webviewWindow,
//     window: tauri.window,
//   }

//   return _desktop
// }

export interface OpenDevWindowOptions {
  url?: string
  title?: string
  width?: number
  height?: number
  darkMode?: boolean
  hotReload?: boolean
  nativeSidebar?: boolean
  sidebarWidth?: number
  sidebarConfig?: unknown
  devTools?: boolean
  craftBin?: string
}

export type CraftLauncher = (command: string[]) => void | Promise<void>

export function resolveDevWindowUrl(port: number, options: OpenDevWindowOptions = {}): string {
  if (!Number.isInteger(port) || port < 1 || port > 65_535)
    throw new RangeError(`Invalid desktop development port: ${port}`)

  const configured = options.url || process.env.APP_URL
  if (!configured)
    return `https://stacks.test`

  const withProtocol = /^https?:\/\//.test(configured) ? configured : `https://${configured}`
  return new URL(withProtocol).toString().replace(/\/$/, '')
}

export function craftDevCommand(port: number, options: OpenDevWindowOptions = {}): string[] {
  const command = [
    options.craftBin || process.env.CRAFT_BIN || 'craft',
    resolveDevWindowUrl(port, options),
    '--title',
    options.title || 'Stacks',
    '--width',
    String(options.width || 1400),
    '--height',
    String(options.height || 900),
  ]

  if (options.hotReload !== false) command.push('--hot-reload')
  if (options.devTools !== false) command.push('--dev-tools')
  if (options.darkMode) command.push('--dark-mode')

  return command
}

async function launchCraft(command: string[]): Promise<void> {
  const process = Bun.spawn(command, {
    stdin: 'inherit',
    stdout: 'inherit',
    stderr: 'inherit',
  })

  process.unref()
}

export async function openDevWindow(
  port: number,
  options: OpenDevWindowOptions = {},
  launcher: CraftLauncher = launchCraft,
): Promise<boolean> {
  await launcher(craftDevCommand(port, options))
  return true
}
