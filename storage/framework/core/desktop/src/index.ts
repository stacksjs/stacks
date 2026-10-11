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
export interface DesktopLauncherCompileOptions {
  entry: string
  outfile: string
  minify?: boolean
}

/**
 * The `bun build` arguments that compile a desktop launcher.
 *
 * A compiled executable autoloads `bunfig.toml` and `.env` from its working
 * directory by default, which is wrong for one that ships to users: its cwd
 * is wherever it happens to be started. Launched from an app's project
 * directory - by launchd with a `WorkingDirectory`, `open` from a terminal,
 * or a developer testing the build - it applied the app's bunfig preloads to
 * itself and died with `preload not found "@stacksjs/env/plugin.js"` before
 * running a line. From any other directory it silently loaded that
 * directory's `.env` into the launcher and everything it spawns.
 */
export function desktopLauncherCompileArgs(options: DesktopLauncherCompileOptions): string[] {
  return [
    'build',
    '--compile',
    ...(options.minify === false ? [] : ['--minify']),
    '--no-compile-autoload-bunfig',
    '--no-compile-autoload-dotenv',
    options.entry,
    '--outfile',
    options.outfile,
  ]
}

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

export interface InfoPlistOptions {
  /** `CFBundleName` and `CFBundleDisplayName`: the name a person sees. */
  appName: string
  /** `CFBundleIdentifier`, which may come straight from `DESKTOP_BUNDLE_ID`. */
  bundleId: string
  /** `CFBundleVersion` and `CFBundleShortVersionString`. */
  version: string
  /** `CFBundleExecutable`: the launcher's filename inside `Contents/MacOS`. */
  executable: string
  /** `AppIcon`, or nothing when the project supplied no square PNG. */
  iconFile?: string
  /**
   * Whether the window opens something this application started on loopback,
   * which is what decides its App Transport Security exception.
   */
  ownsLauncher: boolean
  /** `app/Desktop/Info.plist.json`, already parsed. */
  declared?: Record<string, unknown>
}

/**
 * Render the `Info.plist` for the packaged `.app`.
 *
 * Every value an application chooses is escaped on the way in. It used to be
 * interpolated raw, which made an app name as ordinary as `Repro & Co` emit
 * `<string>Repro & Co</string>` - not well-formed XML, so macOS could not read
 * the bundle's `Info.plist` at all and the app would not launch. `build:dmg`
 * reported success either way, because nothing read back the file it had just
 * written; the corruption first showed up as an app that silently refused to
 * open. The entries an app declares in `app/Desktop/Info.plist.json` were
 * already escaped by `renderUserlandPlistEntries`. The keys every build writes,
 * which are the ones carrying a name and a version, were not.
 *
 * It lives here, rather than inline in the packaging script, so the output can
 * be asserted directly instead of by building a DMG and mounting it.
 */
export function renderInfoPlist(options: InfoPlistOptions): { xml: string, ignored: string[] } {
  const declared = options.declared ?? {}
  const { xml: extra, ignored } = renderUserlandPlistEntries(declared)

  // A plist with the same key twice is malformed, and these three are exactly
  // the ones an app has reason to set: a utility raising its minimum macOS, an
  // app needing transport rules of its own. The app's value wins and the
  // default is left out, rather than both being emitted.
  const overridden = (key: string): boolean => Object.hasOwn(declared, key)

  const loopbackTransportSecurity = `  <!-- The window talks to something this app started on loopback, so an
       exception for 127.0.0.1 is all it needs. NSAllowsArbitraryLoads would
       additionally permit every unencrypted host on the internet. -->
  <key>NSAppTransportSecurity</key>
  <dict>
    <key>NSAllowsLocalNetworking</key><true/>
    <key>NSExceptionDomains</key>
    <dict>
      <key>127.0.0.1</key>
      <dict><key>NSExceptionAllowsInsecureHTTPLoads</key><true/></dict>
    </dict>
  </dict>`

  const remoteTransportSecurity = `  <!-- The window loads a remote URL, so the app has to be allowed to reach it. -->
  <key>NSAppTransportSecurity</key><dict><key>NSAllowsArbitraryLoads</key><true/></dict>`

  const minimumSystem = overridden('LSMinimumSystemVersion') ? '' : '  <key>LSMinimumSystemVersion</key><string>11.0</string>\n'
  const highResolution = overridden('NSHighResolutionCapable') ? '' : '  <key>NSHighResolutionCapable</key><true/>\n'
  const transportSecurity = overridden('NSAppTransportSecurity')
    ? ''
    : (options.ownsLauncher ? loopbackTransportSecurity : remoteTransportSecurity)
  const icon = options.iconFile ? `\n  <key>CFBundleIconFile</key><string>${xmlEscape(options.iconFile)}</string>` : ''

  const name = xmlEscape(options.appName)
  const version = xmlEscape(options.version)

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>${name}</string>
  <key>CFBundleDisplayName</key><string>${name}</string>
  <key>CFBundleIdentifier</key><string>${xmlEscape(options.bundleId)}</string>
  <key>CFBundleVersion</key><string>${version}</string>
  <key>CFBundleShortVersionString</key><string>${version}</string>
  <key>CFBundleExecutable</key><string>${xmlEscape(options.executable)}</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleInfoDictionaryVersion</key><string>6.0</string>
${minimumSystem}${highResolution}${transportSecurity}${icon}${extra}
</dict>
</plist>
`

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
/** Mach-O magic numbers: thin 32/64-bit in either byte order, and universal. */
const MACH_O_MAGIC = new Set([0xFEEDFACE, 0xCEFAEDFE, 0xFEEDFACF, 0xCFFAEDFE, 0xCAFEBABE, 0xBEBAFECA])

/** Whether `path` is a Mach-O executable, by its first four bytes. */
export function isMachO(path: string): boolean {
  try {
    const fd = openSync(path, 'r')
    try {
      const head = Buffer.alloc(4)
      if (readSync(fd, head, 0, 4, 0) < 4)
        return false
      return MACH_O_MAGIC.has(head.readUInt32BE(0))
    }
    finally {
      closeSync(fd)
    }
  }
  catch {
    return false
  }
}

/**
 * Where a file `build:desktop` emitted belongs inside a `.app`.
 *
 * `codesign` treats everything in `Contents/MacOS` as code. The manifest,
 * provenance and checksums used to sit there beside the launcher, so signing
 * the launcher or the bundle failed with "code object is not signed at all.
 * In subcomponent: .../Contents/MacOS/desktop.json" - no bundle this produced
 * could ever be signed, which went unnoticed because nothing had signed one.
 * Executables go in MacOS; everything else in Resources.
 */
export function bundleDirectoryFor(path: string): 'MacOS' | 'Resources' {
  return isMachO(path) ? 'MacOS' : 'Resources'
}

export interface DesktopAppVersionOptions {
  /** `DESKTOP_APP_VERSION`, which a release pipeline sets to stamp a build. */
  override?: string
  /** `version` from the application's own `package.json`. */
  declared?: unknown
}

/**
 * The version the packaged app declares.
 *
 * This used to be `process.env.DESKTOP_APP_VERSION || '0.0.0'`, and nothing in
 * the framework set that variable, so every app that did not export it itself
 * shipped `CFBundleShortVersionString` of `0.0.0` - the version Finder shows,
 * and the one a Sparkle-style updater compares to decide whether an update is
 * an update. Every build looked like the same build. The DMG's filename and
 * volume name carried it too, so `MyApp-0.0.0.dmg` overwrote the last release.
 *
 * The application states its version in `package.json`, which is where the
 * framework reads every other thing about it, so reading it here is the whole
 * fix. An explicit `DESKTOP_APP_VERSION` still wins: a pipeline stamping a
 * build number or a release candidate is naming something `package.json` does
 * not know.
 *
 * It is used verbatim rather than normalised. Apple documents
 * `CFBundleShortVersionString` as three integers, and a semver prerelease such
 * as `1.4.0-rc.2` is not that, but silently publishing an app as `1.4.0` when
 * its project says `1.4.0-rc.2` would be the worse surprise: the two are
 * different builds and an updater has to be able to tell them apart.
 */
export function desktopAppVersion(options: DesktopAppVersionOptions = {}): string {
  const override = options.override?.trim()
  if (override) return override

  const declared = typeof options.declared === 'string' ? options.declared.trim() : ''
  return declared || '0.0.0'
}

export interface DmgVolumeOptions {
  appName: string
  /** The resolved version, from `desktopAppVersion`. Never empty in practice. */
  version?: string
  /** `DESKTOP_VOLUME_NAME`, for a consumer that needs a fixed name. */
  override?: string
}

/**
 * The volume name for the app's DMG, which must never be the app's own name.
 *
 * `hdiutil create -volname <appName> -srcfolder <staging>` stages the bundle at
 * `/Volumes/<appName>/<appName>.app`. On a Mac where that app is installed in
 * `/Applications` and TCC-managed - it carries `com.apple.macl` and
 * `com.apple.provenance` - macOS refuses to let a process without App
 * Management rights create a bundle that would shadow it, and imaging fails
 * with "Operation not permitted" (stacksjs/stacks#2884). The bundle is complete
 * and correct by then; only the final step dies.
 *
 * It is the path rather than the content: the same bundle images fine under any
 * other volume name, and a plain `cp -R` into that path is refused the same
 * way, so it is not an hdiutil quirk. And it hits exactly the people most
 * likely to be building, since it takes having installed the app you are
 * working on.
 *
 * `${appName} ${version}` sidesteps it and is the usual convention anyway -
 * most shipped DMGs mount as "AppName 1.2.3". hdiutil does not truncate long
 * names (36 characters round-trip intact, probed against the real tool), so
 * appending the version cannot fold the name back onto the app's.
 *
 * An explicit override is returned as given, collision included: the caller is
 * warned at build time rather than quietly overruled, because rewriting what
 * somebody typed is how a build becomes unpredictable.
 */
export function dmgVolumeName(options: DmgVolumeOptions): string {
  const override = options.override?.trim()
  if (override)
    return override

  const appName = options.appName.trim()
  const version = options.version?.trim()

  // No version to append still must not return the bare app name: a fallback
  // that reintroduces the bug is worse than no fallback.
  return version ? `${appName} ${version}` : `${appName} Installer`
}

/**
 * The flags `build:dmg` accepts, as `parseOptions()` hands them over.
 *
 * Every value is `unknown` rather than `string` because these have not been
 * validated yet: a flag declared but passed without an argument arrives as
 * boolean `true`, which is the case `supplied` exists to reject.
 *
 * The index signature is what `parseOptions()` actually returns - every flag on
 * the command line, including `--verbose` and the rest of `CliOptions`, not
 * only the six read here. Narrowing it to just these six would describe a
 * value this is never passed.
 */
export interface DmgPackagingFlags {
  appName?: unknown
  appVersion?: unknown
  bundleId?: unknown
  signingIdentity?: unknown
  notaryProfile?: unknown
  volumeName?: unknown
  [flag: string]: unknown
}

export interface DmgPackagingInputs {
  /** Command-line flags, which win over the environment. */
  flags?: DmgPackagingFlags
  /** Usually `process.env`. */
  env?: Record<string, string | undefined>
  /** `title` from the `build:desktop` manifest. */
  manifestTitle?: string
  /** `version` from the application's own `package.json`. */
  declaredVersion?: unknown
}

export interface DmgPackaging {
  appName: string
  bundleId: string
  version: string
  volumeName: string
  signingIdentity?: string
  notaryProfile?: string
}

/**
 * A value supplied on purpose, or nothing.
 *
 * A flag declared but passed without an argument arrives as `true`, and an
 * unset variable in CI commonly arrives as the empty string rather than
 * absent, so neither a non-string nor a blank counts as an answer.
 */
function supplied(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed || undefined
}

/**
 * Everything `build:dmg` needs to name and sign a bundle, from flags first and
 * the environment second.
 *
 * `build:dmg` took no flags at all: every one of these values could only be
 * given as a `DESKTOP_*` environment variable, so packaging a signed release
 * from a terminal meant exporting four of them, and anything scripted around
 * that became a wrapper whose only job was to set variables and call `buddy`.
 * Which is how an application ends up owning a build script (see
 * stacksjs/stacks#2884, #2885, #2889, #2890 for what that script was working
 * around).
 *
 * The sibling command for the Mac App Store, `desktop:apple`, already resolved
 * its inputs this way - `options.appVersion || env('APPLE_APP_VERSION') ||
 * metadata.version` - with a flag for each. This brings direct distribution to
 * the same shape, so the two commands no longer disagree about how a Mac build
 * is configured.
 *
 * The environment remains the right answer in CI, where these arrive as
 * secrets; a flag is the right answer at a terminal. Neither is privileged over
 * the application's own `package.json` by accident: a flag and a variable are
 * both something a person stated for this build, so they win, and the manifest
 * and `package.json` answer when nobody did.
 */
export function resolveDmgPackaging(inputs: DmgPackagingInputs = {}): DmgPackaging {
  const flags = inputs.flags ?? {}
  const env = inputs.env ?? {}

  const appName = supplied(flags.appName)
    ?? supplied(env.DESKTOP_APP_NAME)
    ?? supplied(inputs.manifestTitle)
    ?? supplied(env.APP_NAME)
    ?? 'Stacks'

  const version = desktopAppVersion({
    override: supplied(flags.appVersion) ?? supplied(env.DESKTOP_APP_VERSION),
    declared: inputs.declaredVersion,
  })

  const bundleId = supplied(flags.bundleId)
    ?? supplied(env.DESKTOP_BUNDLE_ID)
    ?? `sh.stacks.${appName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`

  return {
    appName,
    bundleId,
    version,
    volumeName: dmgVolumeName({
      appName,
      version,
      override: supplied(flags.volumeName) ?? supplied(env.DESKTOP_VOLUME_NAME),
    }),
    signingIdentity: supplied(flags.signingIdentity) ?? supplied(env.DESKTOP_SIGNING_IDENTITY),
    notaryProfile: supplied(flags.notaryProfile) ?? supplied(env.DESKTOP_NOTARY_PROFILE),
  }
}

export interface CodesignOptions {
  identity: string
  target: string
  entitlements?: string
}

/**
 * The `codesign` invocation for one target in a distributable bundle:
 * hardened runtime (notarization rejects anything without it) and a secure
 * timestamp (notarization also rejects "The signature does not include a
 * secure timestamp"). Ad-hoc signing (`-`) cannot be timestamped.
 */
export function codesignArgs(options: CodesignOptions): string[] {
  return [
    'codesign',
    '--force',
    options.identity === '-' ? '--timestamp=none' : '--timestamp',
    '--options',
    'runtime',
    ...(options.entitlements ? ['--entitlements', options.entitlements] : []),
    '--sign',
    options.identity,
    options.target,
  ]
}

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
