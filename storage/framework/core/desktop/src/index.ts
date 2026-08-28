import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import process from 'node:process'
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

/** Where an application puts a launcher of its own. */
export const USERLAND_LAUNCHER = 'app/Desktop/launcher.ts'

/**
 * Whether this application supplies its own desktop launcher.
 *
 * The framework launcher opens a Craft window on a URL from `desktop.json`,
 * which is right for a hosted Stacks app and wrong for a local-first one — a
 * disk cleaner, a log viewer, anything whose data is the machine it runs on.
 * Those need to start something locally and open a window on that, and until
 * an app could replace the launcher its only option was to reimplement
 * `build:desktop` and `build:dmg` outside the framework.
 */
export function hasUserlandDesktopLauncher(projectRoot: string = process.cwd()): boolean {
  return existsSync(join(projectRoot, USERLAND_LAUNCHER))
}

/**
 * The launcher entrypoint `buddy build:desktop` compiles into the native
 * bundle.
 *
 * `app/Desktop/launcher.ts` wins when present, the same way anything else
 * under `app/` overrides its framework default. Otherwise: inside this monorepo
 * the TypeScript source is right there, while a consumer app only has the
 * published package, which ships `dist/launcher.js` — so resolve whichever
 * exists rather than assuming the monorepo layout, which is what previously
 * made desktop builds impossible outside this repo.
 */
export function resolveDesktopLauncher(projectRoot: string = process.cwd()): string {
  const userland = join(projectRoot, USERLAND_LAUNCHER)
  if (existsSync(userland))
    return userland

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
      'Desktop launcher entrypoint not found. Reinstall @stacksjs/desktop - the package must ship dist/launcher.js.',
    )
  }

  return launcher
}

/**
 * Keys the bundle itself must control.
 *
 * Letting an app rewrite its own identifier or executable from `Info.plist.json`
 * produces a bundle that does not match what was signed — which fails at
 * launch, long after the build said it succeeded.
 */
export const RESERVED_PLIST_KEYS: ReadonlySet<string> = new Set([
  'CFBundleName',
  'CFBundleDisplayName',
  'CFBundleIdentifier',
  'CFBundleVersion',
  'CFBundleShortVersionString',
  'CFBundleExecutable',
  'CFBundlePackageType',
  'CFBundleInfoDictionaryVersion',
  'CFBundleIconFile',
])

export function xmlEscape(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll('\'', '&apos;')
}

/**
 * Serialise a JSON value as a plist fragment.
 *
 * Applications declare extra `Info.plist` entries as JSON rather than XML so a
 * typo cannot produce a bundle macOS silently refuses to launch. The keys that
 * matter most are the `NS*UsageDescription` strings: they are the sentences a
 * person reads in a permission prompt, and without them macOS shows a generic
 * prompt or refuses the request outright.
 */
export function plistValue(value: unknown, indent = ''): string {
  if (typeof value === 'string') return `<string>${xmlEscape(value)}</string>`
  if (typeof value === 'boolean') return value ? '<true/>' : '<false/>'
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error(`Unsupported Info.plist number: ${value}`)
    return Number.isInteger(value) ? `<integer>${value}</integer>` : `<real>${value}</real>`
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return '<array/>'
    const items = value.map(item => `${indent}  ${plistValue(item, `${indent}  `)}`).join('\n')
    return `<array>\n${items}\n${indent}</array>`
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
    if (entries.length === 0) return '<dict/>'
    const body = entries
      .map(([key, val]) => `${indent}  <key>${xmlEscape(key)}</key>${plistValue(val, `${indent}  `)}`)
      .join('\n')
    return `<dict>\n${body}\n${indent}</dict>`
  }
  throw new Error(`Unsupported Info.plist value: ${JSON.stringify(value) ?? String(value)}`)
}

/**
 * Render an application's declared `Info.plist` entries, dropping any key the
 * bundle must own. Returns the ignored keys so the caller can say so.
 */
export function renderUserlandPlistEntries(
  declared: Record<string, unknown>,
): { xml: string, ignored: string[] } {
  const ignored = Object.keys(declared).filter(key => RESERVED_PLIST_KEYS.has(key))
  const kept = Object.entries(declared).filter(([key]) => !RESERVED_PLIST_KEYS.has(key))

  if (kept.length === 0) return { xml: '', ignored }

  const xml = `\n${kept
    .map(([key, value]) => `  <key>${xmlEscape(key)}</key>${plistValue(value, '  ')}`)
    .join('\n')}`
  return { xml, ignored }
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
