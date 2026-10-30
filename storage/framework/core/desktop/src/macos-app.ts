import type { DesktopConfig, MacosDesktopConfig } from '@stacksjs/types'
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

export interface ResolvedMacosDesktop extends MacosDesktopConfig {
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
  return {
    ...config,
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
  try {
    const url = new URL(config.url)
    if (!['http:', 'https:'].includes(url.protocol)) errors.push('macos.url must be an http(s) origin')
  }
  catch { errors.push('macos.url must be the server origin the app talks to, e.g. https://example.com') }
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
    apiUrl: config.url.replace(/\/+$/, ''),
    title: config.appName,
    route: config.initialScreen,
    session: false,
    titlebarStyle: window.titlebarStyle ?? 'standard',
    width: window.width,
    height: window.height,
    minWidth: window.minWidth,
    minHeight: window.minHeight,
  }, null, 2)}\n`
}

/** The host's command line, for a bare executable run during development. */
export function hostArguments(config: ResolvedMacosDesktop, nativeBundle: string): string[] {
  const window = { ...MACOS_DEFAULTS.window, ...config.window }
  return [
    '--api-url', config.url.replace(/\/+$/, ''), '--native-bundle', nativeBundle, '--title', config.appName, '--route', config.initialScreen, '--no-session',
    '--titlebar-style', window.titlebarStyle ?? 'standard', '--width', String(window.width), '--height', String(window.height), '--min-width', String(window.minWidth), '--min-height', String(window.minHeight),
  ]
}

export interface MacosInfoPlistOptions {
  /** `CFBundleIconFile`, when the bundle carries an icon. */
  iconFile?: string
}

/** Info.plist keys the build owns; an app's `infoPlist` cannot replace them. */
const OWNED_KEYS = ['CFBundleIdentifier', 'CFBundleExecutable', 'CFBundleName', 'CFBundleDisplayName', 'CFBundleShortVersionString', 'CFBundleVersion', 'CFBundlePackageType', 'LSApplicationCategoryType', 'LSMinimumSystemVersion', 'CFBundleIconFile', 'CFBundleURLTypes']

export function renderMacosInfoPlist(config: ResolvedMacosDesktop, options: MacosInfoPlistOptions = {}): { xml: string, ignored: string[] } {
  const declared = { ...config.usageDescriptions, ...config.infoPlist }
  const { xml: extra, ignored } = renderUserlandPlistEntries(Object.fromEntries(Object.entries(declared).filter(([key]) => !OWNED_KEYS.includes(key))))
  const owned = Object.keys(declared).filter(key => OWNED_KEYS.includes(key))
  const schemes = config.urlSchemes?.length
    ? `  <key>CFBundleURLTypes</key>\n  <array><dict><key>CFBundleURLName</key><string>${xmlEscape(config.bundleId)}</string><key>CFBundleURLSchemes</key>${plistValue(config.urlSchemes)}</dict></array>\n`
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
${icon}${schemes}${extra}</dict>
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
 */
export function renderMacosEntitlements(config: ResolvedMacosDesktop, distribution: MacosDistribution): string {
  const entitlements: Record<string, boolean | string | string[]> = {}
  if (config.sandbox) {
    entitlements['com.apple.security.app-sandbox'] = true
    entitlements['com.apple.security.network.client'] = true
  }
  if (distribution === 'app-store') {
    if (!config.teamId) throw new Error('macos.teamId is required to sign for the Mac App Store')
    entitlements['com.apple.application-identifier'] = `${config.teamId}.${config.bundleId}`
    entitlements['com.apple.developer.team-identifier'] = config.teamId
    entitlements['keychain-access-groups'] = [`${config.teamId}.${config.bundleId}`]
  }
  Object.assign(entitlements, config.entitlements)
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
