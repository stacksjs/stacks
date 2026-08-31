import { closeSync, existsSync, openSync, readSync, statSync } from 'node:fs'
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

// ── Bundle weight ─────────────────────────────────────────────────────

/**
 * The trailer `bun build --compile` writes into every standalone executable.
 *
 * Present in a Bun single-file binary and absent from a native one, which is
 * what makes it usable to tell the two apart inside a finished bundle.
 */
export const BUN_EXECUTABLE_MARKER = '---- Bun!'

/**
 * How far back from the end of a file to look for that marker.
 *
 * It sits after the embedded module graph, so its distance from the end grows
 * with the payload — measured at ~400 KB for a real app. Eight megabytes is
 * generous enough for a much larger one and still avoids reading eighty
 * megabytes of executable to answer a yes/no question.
 */
const MARKER_SEARCH_BYTES = 8 * 1024 * 1024

/**
 * The floor for "this is a compiled runtime, not a helper script".
 *
 * `bun build --compile` emits 60.5 MB for `console.log("hi")` — the runtime is
 * the file, and the entrypoint is a rounding error on top. Forty is well below
 * that and well above anything else that lands in a bundle.
 */
const RUNTIME_SIZE_FLOOR = 40 * 1024 * 1024

/** One Bun-compiled executable found in a bundle. */
export interface BundledRuntime {
  name: string
  bytes: number
}

/**
 * Whether a file is a Bun standalone executable.
 *
 * Size first because it is a `stat`, then the marker, so the expensive check
 * only runs on the handful of files large enough to be a runtime at all.
 */
export function looksLikeBunExecutable(
  path: string,
  read: (path: string) => { size: number, tail: string } | null = readTail,
): boolean {
  const file = read(path)
  if (!file || file.size < RUNTIME_SIZE_FLOOR)
    return false
  return file.tail.includes(BUN_EXECUTABLE_MARKER)
}

function readTail(path: string): { size: number, tail: string } | null {
  try {
    const { size } = statSync(path)
    if (size < RUNTIME_SIZE_FLOOR)
      return { size, tail: '' }
    const fd = openSync(path, 'r')
    try {
      const length = Math.min(MARKER_SEARCH_BYTES, size)
      const buffer = Buffer.alloc(length)
      readSync(fd, buffer, 0, length, size - length)
      return { size, tail: buffer.toString('latin1') }
    }
    finally {
      closeSync(fd)
    }
  }
  catch {
    return null
  }
}

/**
 * What a bundle is paying to ship more than one Bun-compiled executable.
 *
 * Every one of them embeds a complete copy of the Bun runtime. An app that
 * splits its launcher, its server and a worker into three binaries ships three
 * copies — about 180 MB — and nothing says so: the bundle is simply large, and
 * a large desktop app looks normal.
 *
 * Returns null when there is at most one, which is the case worth saying
 * nothing about.
 */
export function describeRuntimeDuplication(runtimes: BundledRuntime[]): string | null {
  if (runtimes.length < 2)
    return null

  // Charge the duplication to the smallest ones: a single binary would still
  // carry one runtime, so only the copies after the first are avoidable.
  const sorted = [...runtimes].sort((a, b) => b.bytes - a.bytes)
  const duplicated = sorted.slice(1)
  const wasted = duplicated.length * RUNTIME_SIZE_FLOOR

  const names = sorted.map(r => `${r.name} (${(r.bytes / 1024 / 1024).toFixed(1)} MB)`).join(', ')

  return `This bundle ships ${runtimes.length} Bun-compiled executables: ${names}. `
    + `Each embeds a full copy of the Bun runtime, so at least ${(wasted / 1024 / 1024).toFixed(0)} MB of the bundle is the same runtime repeated. `
    + `Compiling one binary that dispatches on a subcommand — \`MyApp agent\`, \`MyApp worker\` — keeps the helpers as separate processes and pays for the runtime once.`
}
