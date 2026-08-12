import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { craftBinaryNotFoundMessage, resolveCraftBinary as resolveCraftNativeBinary } from 'craft-native'

export * from './invites'
export * from './updater'
export * from './support'

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
  systemTray?: boolean
  hideDockIcon?: boolean
  menubarOnly?: boolean
}

export type CraftLauncher = (command: string[]) => void | Promise<void>

/**
 * Locate the `craft` binary.
 *
 * Craft owns this contract. An explicit path or `CRAFT_BIN` wins, then the
 * pantry-installed `craft` on PATH. Keeping this as a direct delegation avoids
 * Stacks drifting back into checkout and node_modules probing.
 */
export function resolveCraftBinary(explicit: string | undefined = process.env.CRAFT_BIN): string {
  return resolveCraftNativeBinary(explicit)
}

export type CraftBinaryLocator = (binary: string) => string | null

export function resolveCraftExecutable(
  explicit: string | undefined = process.env.CRAFT_BIN,
  findOnPath: CraftBinaryLocator = binary => Bun.which(binary),
): string {
  const resolved = resolveCraftBinary(explicit)
  if (resolved !== 'craft') return resolved

  const executable = findOnPath(resolved)
  if (!executable) throw new Error(craftBinaryNotFoundMessage(resolved))
  return executable
}

/**
 * The launcher entrypoint `buddy build:desktop` compiles into the native
 * bundle.
 *
 * Inside this monorepo the TypeScript source is right there. A consumer app
 * only has the published package, which ships `dist/launcher.js` — so resolve
 * whichever exists rather than assuming the monorepo layout, which is what
 * previously made desktop builds impossible outside this repo.
 */
export function resolveDesktopLauncher(): string {
  const here = dirname(fileURLToPath(import.meta.url))
  const candidates = [
    // Monorepo: src/index.ts sits next to src/launcher.ts.
    join(here, 'launcher.ts'),
    // Published package: dist/index.js sits next to dist/launcher.js.
    join(here, 'launcher.js'),
  ]

  const launcher = candidates.find(candidate => existsSync(candidate))
  if (!launcher) {
    throw new Error(
      'Desktop launcher entrypoint not found. Reinstall @stacksjs/desktop — the package must ship dist/launcher.js.',
    )
  }

  return launcher
}

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
    resolveCraftBinary(options.craftBin),
    resolveDevWindowUrl(port, options),
    '--title',
    options.title || 'Stacks',
    '--width',
    String(options.width || 1400),
    '--height',
    String(options.height || 900),
  ]

  if (options.hotReload !== false) command.push('--hot-reload')
  if (options.devTools === false) command.push('--no-devtools')
  if (options.darkMode) command.push('--dark')
  if (options.systemTray) command.push('--system-tray')
  if (options.hideDockIcon) command.push('--hide-dock-icon')
  if (options.menubarOnly) command.push('--menubar-only')

  return command
}

export function createUpdateManifestUrl(baseUrl: string, channel = 'stable'): string {
  if (!/^[a-z0-9-]+$/i.test(channel))
    throw new Error('Update channel may only contain letters, numbers, and hyphens')
  return new URL(`/desktop/updates/${channel}.json`, /^https?:\/\//.test(baseUrl) ? baseUrl : `https://${baseUrl}`).toString()
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
