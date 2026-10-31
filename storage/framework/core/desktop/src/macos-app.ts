import type { DesktopConfig, MacosAgentConfig, MacosDesktopConfig, MacosPermissions } from '@stacksjs/types'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { plistValue, renderUserlandPlistEntries, xmlEscape } from './index'

/**
 * The native macOS app (`config/desktop.ts` `macos`): Craft's AppKit host
 * drawing the project's stx screens, with no launcher and no web view. Every
 * function here is a pure function of the config, so the bundle's contents can
 * be asserted without building or signing anything; `build/desktop-macos.ts`
 * does the building.
 */

export const MACOS_DEFAULTS = {
  minimumSystemVersion: '13.0',
  category: 'public.app-category.productivity',
  nativeScreensDir: 'resources/native',
  initialScreen: 'Main',
  window: { width: 1180, height: 760, minWidth: 820, minHeight: 520 },
} as const

export interface ResolvedMacosDesktop extends Omit<MacosDesktopConfig, 'agent'> {
  /** `macos.agent`, with `true` spelled out; null when the app talks to a hosted API. */
  agent: MacosAgentConfig | null
  /** The hosted API, or the agent's loopback origin (its real port is known only at launch). */
  url: string
  version: string
  buildNumber: string
  minimumSystemVersion: string
  category: string
  nativeScreensDir: string
  initialScreen: string
  sandbox: boolean
  /** The executable's name inside `Contents/MacOS`: the app's name, as it shows in prompts and Activity Monitor. */
  executable: string
}

/** `config/desktop.ts` of a project, or null when it has none or no `macos` section. */
export async function loadDesktopConfig(root: string): Promise<DesktopConfig | null> {
  const file = join(root, 'config/desktop.ts')
  if (!existsSync(file)) return null
  const module = await import(`${pathToFileURL(file).href}?t=${Date.now()}`) as { default?: DesktopConfig }
  return module.default ?? null
}

/** Whether the project declares a native macOS app. */
export async function hasMacosDesktop(root: string): Promise<boolean> {
  return Boolean((await loadDesktopConfig(root))?.macos)
}

export async function loadMacosDesktop(root: string, packageVersion = '0.0.0'): Promise<ResolvedMacosDesktop | null> {
  const config = await loadDesktopConfig(root)
  return config?.macos ? resolveMacosDesktop(config.macos, packageVersion) : null
}

export function resolveMacosDesktop(config: MacosDesktopConfig, packageVersion = '0.0.0'): ResolvedMacosDesktop {
  const version = config.version ?? packageVersion
  const agent = config.agent ? (config.agent === true ? {} : { ...config.agent }) : null
  return {
    ...config,
    agent,
    url: agent ? 'http://127.0.0.1' : config.url ?? '',
    version,
    buildNumber: config.buildNumber ?? version.split(/[-+]/)[0]!,
    minimumSystemVersion: config.minimumSystemVersion ?? MACOS_DEFAULTS.minimumSystemVersion,
    category: config.category ?? MACOS_DEFAULTS.category,
    nativeScreensDir: config.nativeScreensDir ?? MACOS_DEFAULTS.nativeScreensDir,
    initialScreen: config.initialScreen ?? (Array.isArray(config.nativeScreens) ? config.nativeScreens.includes('Main') ? 'Main' : config.nativeScreens[0] : Object.keys(config.nativeScreens).includes('Main') ? 'Main' : Object.keys(config.nativeScreens)[0]) ?? MACOS_DEFAULTS.initialScreen,
    sandbox: config.sandbox !== false,
    executable: config.appName,
  }
}

/** Why a config cannot build, as a list; empty when it can. */
export function validateMacosDesktop(config: ResolvedMacosDesktop): string[] {
  const errors: string[] = []
  if (!config.appName?.trim()) errors.push('macos.appName is required')
  if (!/^[A-Za-z0-9][A-Za-z0-9.-]*\.[A-Za-z0-9.-]+$/.test(config.bundleId ?? '')) errors.push('macos.bundleId must be a reverse-DNS identifier such as com.example.app')
  if (config.teamId !== undefined && !/^[A-Z0-9]{10}$/.test(config.teamId)) errors.push('macos.teamId must be the 10-character Apple Developer team ID')
  if (!/^\d+(?:\.\d+){0,2}$/.test(config.version)) errors.push(`macos.version must be one to three numeric components, not "${config.version}"`)
  if (!/^[A-Za-z0-9.-]+$/.test(config.buildNumber)) errors.push('macos.buildNumber must contain only letters, numbers, periods and hyphens')
  if (!/^\d+(?:\.\d+){0,2}$/.test(config.minimumSystemVersion)) errors.push('macos.minimumSystemVersion must be a macOS version such as 13.0')
  if (!/^public\.app-category\.[a-z][a-z0-9-]*$/.test(config.category)) errors.push('macos.category must be an LSApplicationCategoryType such as public.app-category.productivity')
  if (!config.agent) {
    try {
      const url = new URL(config.url)
      if (!['http:', 'https:'].includes(url.protocol)) errors.push('macos.url must be an http(s) origin')
    }
    catch { errors.push('macos.url must be the server origin the app talks to, e.g. https://example.com, or turn on macos.agent to run the API inside the app') }
  }
  else if (config.agent.port !== undefined && !(Number.isInteger(config.agent.port) && config.agent.port > 1024 && config.agent.port < 65536)) {
    errors.push('macos.agent.port must be a port above 1024')
  }
  const lights = config.window?.trafficLights
  if (lights !== undefined && !(Array.isArray(lights) && lights.length === 2 && lights.every(value => Number.isFinite(value) && value >= 0)))
    errors.push('macos.window.trafficLights must be [x, y], two points from the window\'s top-left')
  for (const [index, item] of (config.dockMenu ?? []).entries()) {
    if (!item?.title?.trim()) errors.push(`macos.dockMenu[${index}] needs a title`)
    if (!item?.action?.trim()) errors.push(`macos.dockMenu[${index}] needs an action`)
  }
  const names = Object.keys(macosScreens(config))
  if (!names.length) errors.push('macos.nativeScreens must name at least one screen')
  if (names.length && !names.includes(config.initialScreen)) errors.push(`macos.initialScreen "${config.initialScreen}" is not one of the native screens (${names.join(', ')})`)
  for (const scheme of config.urlSchemes ?? []) if (!/^[a-z][a-z0-9+.-]*$/.test(scheme)) errors.push(`macos.urlSchemes: "${scheme}" is not a valid URL scheme`)
  return errors
}

/** Screen name to its `.stx` source, relative to the project root. */
export function macosScreens(config: Pick<MacosDesktopConfig, 'nativeScreens' | 'nativeScreensDir'>): Record<string, string> {
  const dir = config.nativeScreensDir ?? MACOS_DEFAULTS.nativeScreensDir
  if (Array.isArray(config.nativeScreens)) return Object.fromEntries(config.nativeScreens.map(name => [name, `${dir}/${name}.stx`]))
  return { ...config.nativeScreens }
}

/** What the host reads from `Contents/Resources/craft-app.json` when Finder launches it with no arguments. */
export function renderHostConfig(config: ResolvedMacosDesktop): string {
  const window = { ...MACOS_DEFAULTS.window, ...config.window }
  return `${JSON.stringify({
    // An agent app's origin is a port chosen at launch, which the launcher passes as --api-url.
    ...(config.agent ? {} : { apiUrl: config.url.replace(/\/+$/, '') }),
    title: config.appName,
    route: config.initialScreen,
    // The agent issues the session cookie at /native/session; a hosted API has no such endpoint.
    session: Boolean(config.agent),
    titlebarStyle: window.titlebarStyle ?? 'standard',
    width: window.width,
    height: window.height,
    minWidth: window.minWidth,
    minHeight: window.minHeight,
    ...(window.trafficLights ? { trafficLights: window.trafficLights } : {}),
    ...(config.webkit ? { webkit: true } : {}),
    ...(config.dockMenu?.length ? { dockMenu: config.dockMenu.map(item => ({ title: item.title, action: item.action })) } : {}),
  }, null, 2)}\n`
}

/** The host's command line, for a bare executable run during development. */
export function hostArguments(config: ResolvedMacosDesktop, nativeBundle: string): string[] {
  return ['--api-url', config.url.replace(/\/+$/, ''), '--native-bundle', nativeBundle, ...windowArguments(config), '--no-session']
}

/**
 * The host's command line under an agent, less `--api-url` and
 * `--native-bundle`, which the launcher adds once it knows its port and where
 * the screens are. No `--no-session`: the host asks the agent for its session.
 */
export function agentHostArguments(config: ResolvedMacosDesktop): string[] {
  return windowArguments(config)
}

function windowArguments(config: ResolvedMacosDesktop): string[] {
  const window = { ...MACOS_DEFAULTS.window, ...config.window }
  return [
    '--title', config.appName, '--route', config.initialScreen,
    '--titlebar-style', window.titlebarStyle ?? 'standard', '--width', String(window.width), '--height', String(window.height), '--min-width', String(window.minWidth), '--min-height', String(window.minHeight),
    ...(window.trafficLights ? ['--traffic-lights', window.trafficLights.join(',')] : []),
  ]
}

export interface MacosInfoPlistOptions {
  /** `CFBundleIconFile`, when the bundle carries an icon. */
  iconFile?: string
}

/** Info.plist keys the build owns; an app's `infoPlist` cannot replace them. */
const OWNED_KEYS = ['CFBundleIdentifier', 'CFBundleExecutable', 'CFBundleName', 'CFBundleDisplayName', 'CFBundleShortVersionString', 'CFBundleVersion', 'CFBundlePackageType', 'LSApplicationCategoryType', 'LSMinimumSystemVersion', 'CFBundleIconFile', 'CFBundleURLTypes']

/** What `defaultBrowser` declares the app opens, by Uniform Type Identifier. */
export const BROWSER_DOCUMENT_TYPES: ReadonlyArray<{ name: string, types: string[] }> = [
  { name: 'HTML document', types: ['public.html'] },
  { name: 'XHTML document', types: ['public.xhtml'] },
  { name: 'Web archive', types: ['com.apple.webarchive'] },
  { name: 'PDF document', types: ['com.adobe.pdf'] },
]

/** The prompt sentences `permissions: { camera: true }` and its siblings use when the app gives none. */
export function defaultUsageDescriptions(appName: string): Record<'camera' | 'microphone' | 'location', string> {
  return {
    camera: `${appName} uses the camera when you allow a page or feature to.`,
    microphone: `${appName} uses the microphone when you allow a page or feature to.`,
    location: `${appName} uses your location when you allow a page or feature to.`,
  }
}

/** The `NS*UsageDescription` keys `macos.permissions` asks for. An explicit `usageDescriptions` entry wins. */
export function permissionUsageDescriptions(config: Pick<ResolvedMacosDesktop, 'appName' | 'permissions'>): Record<string, string> {
  const permissions: MacosPermissions = config.permissions ?? {}
  const defaults = defaultUsageDescriptions(config.appName)
  const sentence = (value: boolean | string | undefined, fallback: string): string | undefined => typeof value === 'string' && value.trim() ? value : value ? fallback : undefined
  const usage: Record<string, string> = {}
  const camera = sentence(permissions.camera, defaults.camera)
  if (camera) usage.NSCameraUsageDescription = camera
  const microphone = sentence(permissions.microphone, defaults.microphone)
  if (microphone) usage.NSMicrophoneUsageDescription = microphone
  const location = sentence(permissions.location, defaults.location)
  if (location) {
    usage.NSLocationUsageDescription = location
    usage.NSLocationWhenInUseUsageDescription = location
  }
  return usage
}

export function renderMacosInfoPlist(config: ResolvedMacosDesktop, options: MacosInfoPlistOptions = {}): { xml: string, ignored: string[] } {
  const owns = config.defaultBrowser ? [...OWNED_KEYS, 'CFBundleDocumentTypes'] : OWNED_KEYS
  const declared: Record<string, unknown> = { ...permissionUsageDescriptions(config), ...config.usageDescriptions, ...config.infoPlist }
  // A browser loads whatever page it is given, http included; App Transport
  // Security would otherwise refuse every plain-http page in its web views.
  if (config.defaultBrowser && declared.NSAppTransportSecurity === undefined)
    declared.NSAppTransportSecurity = { NSAllowsArbitraryLoadsInWebContent: true }
  const { xml: extra, ignored } = renderUserlandPlistEntries(Object.fromEntries(Object.entries(declared).filter(([key]) => !owns.includes(key))))
  const owned = Object.keys(declared).filter(key => owns.includes(key))
  const urlTypes: Array<Record<string, unknown>> = []
  if (config.urlSchemes?.length) urlTypes.push({ CFBundleURLName: config.bundleId, CFBundleURLSchemes: config.urlSchemes })
  if (config.defaultBrowser) urlTypes.push({ CFBundleURLName: 'Web site URL', CFBundleTypeRole: 'Viewer', CFBundleURLSchemes: ['http', 'https'] })
  const schemes = urlTypes.length ? `  <key>CFBundleURLTypes</key>${plistValue(urlTypes, '  ')}\n` : ''
  const documents = config.defaultBrowser
    ? `  <key>CFBundleDocumentTypes</key>${plistValue(BROWSER_DOCUMENT_TYPES.map(type => ({ CFBundleTypeName: type.name, CFBundleTypeRole: 'Viewer', LSHandlerRank: 'Default', LSItemContentTypes: type.types })), '  ')}\n`
    : ''
  const icon = options.iconFile ? `  <key>CFBundleIconFile</key><string>${xmlEscape(options.iconFile)}</string>\n` : ''
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "https://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDevelopmentRegion</key><string>en</string>
  <key>CFBundleDisplayName</key><string>${xmlEscape(config.appName)}</string>
  <key>CFBundleExecutable</key><string>${xmlEscape(config.executable)}</string>
  <key>CFBundleIdentifier</key><string>${xmlEscape(config.bundleId)}</string>
  <key>CFBundleInfoDictionaryVersion</key><string>6.0</string>
  <key>CFBundleName</key><string>${xmlEscape(config.appName)}</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>${xmlEscape(config.version)}</string>
  <key>CFBundleVersion</key><string>${xmlEscape(config.buildNumber)}</string>
  <key>LSApplicationCategoryType</key><string>${xmlEscape(config.category)}</string>
  <key>LSMinimumSystemVersion</key><string>${xmlEscape(config.minimumSystemVersion)}</string>
  <key>NSHighResolutionCapable</key><true/>
  <key>NSSupportsAutomaticGraphicsSwitching</key><true/>
  <key>ITSAppUsesNonExemptEncryption</key><false/>
${icon}${schemes}${documents}${extra}</dict>
</plist>
`
  return { xml, ignored: [...ignored, ...owned] }
}

export type MacosDistribution = 'development' | 'app-store'

/**
 * The signed app's entitlements. The sandbox and outbound network are what
 * the Mac App Store requires of an app that only talks to a server; the
 * application identifier and keychain access group are what let the app keep
 * its sign-in in the data-protection Keychain, and need a team. A development
 * build carries neither (it is signed ad hoc, which cannot hold them).
 *
 * `permissions` adds a device entitlement for each device the app asks for,
 * sandboxed or not: the hardened runtime refuses the camera, microphone and
 * location without one. Folders, printing and the network are sandbox
 * entitlements, so they only appear in a sandboxed app.
 *
 * Under `agent` the executable is Bun, whose JIT the hardened runtime blocks
 * unless it is allowed, and the agent listens on 127.0.0.1, which a
 * sandboxed app may only do with `network.server`.
 */
export function renderMacosEntitlements(config: ResolvedMacosDesktop, distribution: MacosDistribution): string {
  const entitlements: Record<string, boolean | string | string[]> = {}
  const permissions: MacosPermissions = config.permissions ?? {}
  if (config.sandbox) {
    entitlements['com.apple.security.app-sandbox'] = true
    if (permissions.network !== false) entitlements['com.apple.security.network.client'] = true
    if (config.agent) entitlements['com.apple.security.network.server'] = true
    if (permissions.downloads) entitlements[permissions.downloads === 'read-only' ? 'com.apple.security.files.downloads.read-only' : 'com.apple.security.files.downloads.read-write'] = true
    if (permissions.printing) entitlements['com.apple.security.print'] = true
  }
  if (permissions.camera) entitlements['com.apple.security.device.camera'] = true
  if (permissions.microphone) entitlements['com.apple.security.device.audio-input'] = true
  if (permissions.location) entitlements['com.apple.security.personal-information.location'] = true
  if (config.agent) {
    entitlements['com.apple.security.cs.allow-jit'] = true
    entitlements['com.apple.security.cs.allow-unsigned-executable-memory'] = true
    entitlements['com.apple.security.cs.disable-library-validation'] = true
  }
  if (distribution === 'app-store') {
    if (!config.teamId) throw new Error('macos.teamId is required to sign for the Mac App Store')
    entitlements['com.apple.application-identifier'] = `${config.teamId}.${config.bundleId}`
    entitlements['com.apple.developer.team-identifier'] = config.teamId
    entitlements['keychain-access-groups'] = [`${config.teamId}.${config.bundleId}`]
  }
  Object.assign(entitlements, config.entitlements)
  return renderEntitlementsPlist(entitlements)
}

/**
 * The entitlements of the AppKit host when an agent launches it from inside
 * the bundle. A sandboxed parent's child may hold only the sandbox and
 * `inherit` (it then runs in the parent's sandbox, with the parent's
 * permissions); unsandboxed, it needs its own device entitlements, because
 * the host is the process whose web views use the camera and microphone.
 */
export function renderMacosHostEntitlements(config: ResolvedMacosDesktop): string {
  if (config.sandbox) return renderEntitlementsPlist({ 'com.apple.security.app-sandbox': true, 'com.apple.security.inherit': true })
  const permissions: MacosPermissions = config.permissions ?? {}
  const entitlements: Record<string, boolean> = {}
  if (permissions.camera) entitlements['com.apple.security.device.camera'] = true
  if (permissions.microphone) entitlements['com.apple.security.device.audio-input'] = true
  if (permissions.location) entitlements['com.apple.security.personal-information.location'] = true
  return renderEntitlementsPlist(entitlements)
}

function renderEntitlementsPlist(entitlements: Record<string, boolean | string | string[]>): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "https://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
${plistValue(entitlements)}
</plist>
`
}

/** `PrivacyInfo.xcprivacy`: what the app collects and which required-reason APIs it uses. */
export function renderPrivacyManifest(config: Pick<ResolvedMacosDesktop, 'privacy'>): string {
  const privacy = config.privacy ?? {}
  const manifest = {
    NSPrivacyTracking: privacy.tracking === true,
    NSPrivacyTrackingDomains: privacy.trackingDomains ?? [],
    NSPrivacyCollectedDataTypes: (privacy.collectedDataTypes ?? []).map(item => ({
      NSPrivacyCollectedDataType: item.type,
      NSPrivacyCollectedDataTypeLinked: item.linked === true,
      NSPrivacyCollectedDataTypeTracking: item.tracking === true,
      NSPrivacyCollectedDataTypePurposes: item.purposes,
    })),
    NSPrivacyAccessedAPITypes: (privacy.accessedApiTypes ?? []).map(item => ({
      NSPrivacyAccessedAPIType: item.type,
      NSPrivacyAccessedAPITypeReasons: item.reasons,
    })),
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "https://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
${plistValue(manifest)}
</plist>
`
}

/** The icon sizes `iconutil` wants in an `.iconset`, from one 1024 pixel PNG. */
export const ICONSET_SIZES: ReadonlyArray<{ file: string, pixels: number }> = [16, 32, 128, 256, 512].flatMap(size => [
  { file: `icon_${size}x${size}.png`, pixels: size },
  { file: `icon_${size}x${size}@2x.png`, pixels: size * 2 },
])

/** Where the build writes a project's app, relative to the project root unless absolute. */
export function macosOutputDirectory(root: string, config: Pick<MacosDesktopConfig, 'output'>): string {
  return config.output ? resolve(root, config.output) : join(root, 'storage/framework/desktop/macos')
}
