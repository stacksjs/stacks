import type { DesktopTargetName, WebviewDesktopConfig } from '@stacksjs/types'
import type { BundleCommand } from './macos-bundle'
import type { WebviewAppManifest } from './webview-launcher'
import { chmodSync, copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { isAbsolute, join, relative, resolve, sep } from 'node:path'
import process from 'node:process'
import { codesignArgs, plistValue, renderInfoPlist } from './index'
import { loadDesktopConfig } from './macos-app'
import { makeIcns, runBundleCommand } from './macos-bundle'
import { webviewComponentDirs } from './webview-agent'
import { OPTIONAL_CRAFT_FLAGS, WEBVIEW_RUNTIME_NAME } from './webview-launcher'

/**
 * `desktop.webview` resolved, and the pieces `buddy build:desktop` puts
 * together for it: which targets, how each is compiled, and what each
 * platform's package is made from.
 */

export const DESKTOP_TARGETS: readonly DesktopTargetName[] = ['darwin-arm64', 'darwin-x64', 'linux-x64', 'linux-arm64', 'win32-x64', 'win32-arm64']

export const WEBVIEW_DEFAULTS = {
  views: 'resources/desktop',
  output: 'storage/framework/desktop/webview',
  width: 1280,
  height: 800,
  minimumSystemVersion: '13.0',
  category: 'public.app-category.developer-tools',
} as const

export interface ResolvedWebviewDesktop extends WebviewDesktopConfig {
  version: string
  window: Required<Pick<NonNullable<WebviewDesktopConfig['window']>, 'title' | 'width' | 'height'>> & NonNullable<WebviewDesktopConfig['window']>
  agent: NonNullable<WebviewDesktopConfig['agent']> & { views: string }
  output: string
  /** The executable's file name, less `.exe`: the app's name without what a file system or a shell would trip on. */
  executable: string
  /** Lower-case and dash-separated: the Linux binary and package name. */
  slug: string
}

/** Whether the project declares a web view desktop app. */
export async function hasWebviewDesktop(root: string): Promise<boolean> {
  return Boolean((await loadDesktopConfig(root))?.webview)
}

export async function loadWebviewDesktop(root: string, packageVersion = '0.0.0'): Promise<ResolvedWebviewDesktop | null> {
  const config = await loadDesktopConfig(root)
  return config?.webview ? resolveWebviewDesktop(config.webview, packageVersion) : null
}

export function resolveWebviewDesktop(config: WebviewDesktopConfig, packageVersion = '0.0.0'): ResolvedWebviewDesktop {
  return {
    ...config,
    version: config.version ?? packageVersion,
    window: { ...config.window, title: config.window?.title ?? config.appName, width: config.window?.width ?? WEBVIEW_DEFAULTS.width, height: config.window?.height ?? WEBVIEW_DEFAULTS.height },
    agent: { ...config.agent, views: config.agent?.views ?? WEBVIEW_DEFAULTS.views },
    output: config.output ?? WEBVIEW_DEFAULTS.output,
    executable: config.appName.replace(/[^\w .-]+/g, '').trim() || 'App',
    slug: config.appName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'app',
  }
}

/** Why a config cannot build, as a list; empty when it can. */
export function validateWebviewDesktop(config: ResolvedWebviewDesktop): string[] {
  const errors: string[] = []
  if (!config.appName?.trim()) errors.push('webview.appName is required')
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(config.appId ?? '')) errors.push(`webview.appId must be reverse-DNS, like org.example.app (got ${JSON.stringify(config.appId)})`)
  if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(config.version)) errors.push(`webview.version must be a semantic version (got ${JSON.stringify(config.version)})`)
  for (const scheme of config.urlSchemes ?? []) {
    if (!/^[a-z][a-z0-9+.-]*$/i.test(scheme)) errors.push(`webview.urlSchemes: ${JSON.stringify(scheme)} is not a URL scheme`)
  }
  if (config.updates) {
    try {
      const url = new URL(config.updates.feedUrl)
      if (url.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname)) errors.push('webview.updates.feedUrl must be https')
    }
    catch {
      errors.push(`webview.updates.feedUrl is not a URL (got ${JSON.stringify(config.updates.feedUrl)})`)
    }
    const keys = Object.entries(config.updates.publicKeys ?? {})
    if (!keys.length) errors.push('webview.updates.publicKeys needs at least one key (run `buddy desktop:update:keypair`)')
    for (const [id, key] of keys) {
      if (!key.startsWith('ed25519-public:')) errors.push(`webview.updates.publicKeys.${id} is not a public key (it starts with ed25519-public:)`)
    }
  }
  return errors
}

export function hostDesktopTarget(): DesktopTargetName {
  return `${process.platform}-${process.arch}` as DesktopTargetName
}

/** `darwin-arm64,linux-x64`, or `all`, as targets. Default: the machine's own. */
export function parseDesktopTargets(input: string | undefined, host: DesktopTargetName = hostDesktopTarget()): DesktopTargetName[] {
  if (!input?.trim()) return [host]
  if (input.trim() === 'all') return [...DESKTOP_TARGETS]
  const targets = input.split(',').map(part => part.trim()).filter(Boolean).map((part) => {
    // The names people reach for: macos, windows.
    const name = part.replace(/^macos-/, 'darwin-').replace(/^windows-/, 'win32-')
    if (!(DESKTOP_TARGETS as readonly string[]).includes(name)) throw new Error(`Unknown desktop target ${JSON.stringify(part)}. Targets: ${DESKTOP_TARGETS.join(', ')}, or all.`)
    return name as DesktopTargetName
  })
  return [...new Set(targets)]
}

export function splitDesktopTarget(target: DesktopTargetName): { platform: 'darwin' | 'linux' | 'win32', architecture: 'arm64' | 'x64' } {
  const [platform, architecture] = target.split('-') as ['darwin' | 'linux' | 'win32', 'arm64' | 'x64']
  return { platform, architecture }
}

/** Bun's name for a compile target (`--target=bun-windows-x64`). */
export function bunCompileTarget(target: DesktopTargetName): string {
  const { platform, architecture } = splitDesktopTarget(target)
  return `bun-${platform === 'win32' ? 'windows' : platform}-${architecture}`
}

/**
 * The `bun build` arguments for an agent executable. Another machine's target
 * is cross-compiled by Bun, which downloads that target's runtime; bytecode is
 * left out there, because it is produced by the build machine's engine.
 */
export function webviewCompileArgs(options: { entry: string, outfile: string, target: DesktopTargetName, host?: DesktopTargetName, minify?: boolean }): string[] {
  const cross = options.target !== (options.host ?? hostDesktopTarget())
  return [
    'build',
    '--compile',
    ...(options.minify === false ? [] : ['--minify']),
    ...(cross ? [`--target=${bunCompileTarget(options.target)}`] : ['--bytecode', '--format=esm']),
    // A shipped executable must not pick up the bunfig or .env of whatever directory it is started in.
    '--no-compile-autoload-bunfig',
    '--no-compile-autoload-dotenv',
    // No console window behind the app on Windows.
    ...(options.target.startsWith('win32-') ? ['--windows-hide-console'] : []),
    options.entry,
    '--outfile',
    options.outfile,
  ]
}

/**
 * The Craft web view binary for a target: the path the config names, then
 * `CRAFT_BIN_<PLATFORM>_<ARCH>`, then (for the build machine's own target)
 * `hostRuntime`. Craft publishes one per platform with each release
 * (`craft-<os>-<arch>.zip`); a cross-build needs the other platforms' unpacked
 * somewhere and named here.
 */
export function webviewRuntimeFor(config: Pick<WebviewDesktopConfig, 'runtime'>, target: DesktopTargetName, options: { root: string, env?: Record<string, string | undefined>, host?: DesktopTargetName, hostRuntime?: () => string }): string {
  const configured = configuredWebviewRuntime(config, target, options)
  if (configured) return configured
  throw new Error(`No Craft runtime for ${target}. Unpack that platform's Craft release and name its binary in desktop.webview.runtime['${target}'] or CRAFT_BIN_${target.replace('-', '_').toUpperCase()}.`)
}

/**
 * The runtime a project or this machine already has for a target, or null
 * when neither does: the one named in the config or the environment, else the
 * host's own Craft for the host's target. `buddy build:desktop` fetches the
 * published runtime for a target this answers null for.
 */
export function configuredWebviewRuntime(config: Pick<WebviewDesktopConfig, 'runtime'>, target: DesktopTargetName, options: { root: string, env?: Record<string, string | undefined>, host?: DesktopTargetName, hostRuntime?: () => string }): string | null {
  const env = options.env ?? process.env
  const variable = `CRAFT_BIN_${target.replace('-', '_').toUpperCase()}`
  const named = config.runtime?.[target] ?? env[variable]
  if (named) {
    const file = isAbsolute(named) ? named : resolve(options.root, named)
    if (!existsSync(file)) throw new Error(`The Craft runtime for ${target} does not exist: ${file}`)
    return file
  }
  if (target === (options.host ?? hostDesktopTarget()) && options.hostRuntime) return options.hostRuntime()
  return null
}

/**
 * Which of the optional flags a Craft binary understands, read from the binary
 * itself: a flag it parses is a string inside it. Nothing is run, so this
 * works for another platform's runtime too. An older Craft that is handed a
 * flag it does not know opens its demo window instead of the app's.
 */
export function probeCraftFlags(runtime: string, flags: readonly string[] = OPTIONAL_CRAFT_FLAGS): string[] {
  const binary = readFileSync(runtime)
  return flags.filter(flag => binary.includes(flag))
}

/** What the launcher reads, from the config. `runtime` says where the Craft binary will be. */
export function webviewManifest(config: ResolvedWebviewDesktop, options: { runtime: string, runtimeFlags?: string[], development?: boolean, sourceRevision?: string }): WebviewAppManifest {
  return {
    appName: config.appName,
    appId: config.appId,
    version: config.version,
    runtime: options.runtime,
    window: {
      title: config.window.title,
      width: config.window.width,
      height: config.window.height,
      ...(config.window.darkMode !== undefined ? { darkMode: config.window.darkMode } : {}),
      ...(options.development || config.window.devtools ? { devtools: true } : {}),
      ...(config.window.titlebarHidden ? { titlebarHidden: true } : {}),
      ...(config.window.arguments?.length ? { arguments: config.window.arguments } : {}),
    },
    ...(config.agent.port ? { port: config.agent.port } : {}),
    ...(config.agent.startPath ? { startPath: config.agent.startPath } : {}),
    ...(config.agent.publicPaths?.length ? { publicPaths: config.agent.publicPaths } : {}),
    ...(config.urlSchemes?.length ? { urlSchemes: config.urlSchemes } : {}),
    // A development run has no installed copy to replace.
    ...(config.updates && !options.development
      ? { updates: { feedUrl: config.updates.feedUrl, publicKeys: config.updates.publicKeys, ...(config.updates.channel ? { channel: config.updates.channel } : {}), ...(config.updates.checkEveryHours !== undefined ? { checkEveryHours: config.updates.checkEveryHours } : {}) } }
      : {}),
    ...(options.runtimeFlags?.length ? { runtimeFlags: options.runtimeFlags } : {}),
    ...(options.sourceRevision ? { sourceRevision: options.sourceRevision } : {}),
  }
}

/** Every file under a directory of built views, as request path (`/about/index.html`) to file. */
export function collectViewFiles(directory: string): Record<string, string> {
  const files: Record<string, string> = {}
  const walk = (current: string): void => {
    for (const entry of readdirSync(current).sort()) {
      if (entry === '.DS_Store') continue
      const file = join(current, entry)
      if (statSync(file).isDirectory()) walk(file)
      else files[`/${relative(directory, file).split(sep).join('/')}`] = file
    }
  }
  if (existsSync(directory)) walk(directory)
  return files
}

/** What a compiled Bun executable needs under the hardened runtime, which notarization requires: a JIT, and the memory it writes code into. */
export const BUN_HARDENED_ENTITLEMENTS: Readonly<Record<string, boolean>> = {
  'com.apple.security.cs.allow-jit': true,
  'com.apple.security.cs.allow-unsigned-executable-memory': true,
  'com.apple.security.cs.disable-library-validation': true,
}

export function renderWebviewEntitlements(config: Pick<ResolvedWebviewDesktop, 'macos'>): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "https://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
${plistValue({ ...BUN_HARDENED_ENTITLEMENTS, ...config.macos?.entitlements })}
</plist>
`
}

export function renderWebviewInfoPlist(config: ResolvedWebviewDesktop, options: { iconFile?: string } = {}): { xml: string, ignored: string[] } {
  const schemes = config.urlSchemes ?? []
  return renderInfoPlist({
    appName: config.appName,
    bundleId: config.macos?.bundleId ?? config.appId,
    version: config.version,
    executable: config.executable,
    iconFile: options.iconFile,
    // The window only ever talks to the agent on loopback.
    ownsLauncher: true,
    declared: {
      LSMinimumSystemVersion: config.macos?.minimumSystemVersion ?? WEBVIEW_DEFAULTS.minimumSystemVersion,
      LSApplicationCategoryType: config.macos?.category ?? WEBVIEW_DEFAULTS.category,
      ...(schemes.length ? { CFBundleURLTypes: [{ CFBundleURLName: config.appId, CFBundleURLSchemes: schemes }] } : {}),
      ...config.macos?.usageDescriptions,
      ...config.macos?.infoPlist,
    },
  })
}

export interface AssembleWebviewMacosAppOptions {
  config: ResolvedWebviewDesktop
  root: string
  /** The compiled agent, which becomes the bundle's executable. */
  agent: string
  /** Craft's web view binary, placed beside it as `craft-runtime`. */
  runtime: string
  /** The directory that will hold `<appName>.app`. */
  output: string
  /** A codesign identity (name or hash). `-` (default) signs ad hoc, which runs on this Mac only. */
  signingIdentity?: string
  run?: BundleCommand
}

/**
 * Lay out and sign `<App>.app`: the agent as the executable, Craft beside it.
 * Inside out, as codesign wants: the runtime first, then the bundle, both with
 * the hardened runtime so the same bundle can be notarized.
 */
export function assembleWebviewMacosApp(options: AssembleWebviewMacosAppOptions): { appPath: string, entitlementsPath: string, ignoredPlistKeys: string[] } {
  const { config } = options
  const run = options.run ?? runBundleCommand
  const identity = options.signingIdentity ?? '-'
  const appPath = join(options.output, `${config.appName}.app`)
  const macos = join(appPath, 'Contents', 'MacOS')
  const resources = join(appPath, 'Contents', 'Resources')
  rmSync(appPath, { recursive: true, force: true })
  mkdirSync(macos, { recursive: true })
  mkdirSync(resources, { recursive: true })

  const executable = join(macos, config.executable)
  const runtime = join(macos, WEBVIEW_RUNTIME_NAME)
  copyFileSync(options.agent, executable)
  copyFileSync(options.runtime, runtime)
  chmodSync(executable, 0o755)
  chmodSync(runtime, 0o755)

  let iconFile: string | undefined
  if (config.icon) {
    const icon = resolve(options.root, config.icon)
    if (!existsSync(icon)) throw new Error(`webview.icon does not exist: ${icon}`)
    if (icon.endsWith('.icns')) copyFileSync(icon, join(resources, 'AppIcon.icns'))
    else makeIcns(icon, join(resources, 'AppIcon.icns'), options.output, run)
    iconFile = 'AppIcon'
  }

  const plist = renderWebviewInfoPlist(config, { iconFile })
  writeFileSync(join(appPath, 'Contents', 'Info.plist'), plist.xml)
  const entitlementsPath = join(options.output, `${config.appName}.entitlements`)
  writeFileSync(entitlementsPath, renderWebviewEntitlements(config))

  run(codesignArgs({ identity, target: runtime }))
  run(codesignArgs({ identity, target: appPath, entitlements: entitlementsPath }))
  return { appPath, entitlementsPath, ignoredPlistKeys: plist.ignored }
}

/**
 * The input to Craft's packaging (`packageApp` from `craft-native`) for a
 * Windows or Linux target, written beside the staged files as
 * `craft-package.json`. On Windows the Craft runtime rides along as an
 * additional file; on Linux it is compiled into the one binary Craft's
 * AppImage, deb and rpm builders take.
 */
export function webviewPackageConfig(config: ResolvedWebviewDesktop, target: DesktopTargetName, staged: { binary: string, additionalFiles?: string[], outDir: string, icon?: string, certificatePassword?: string }): Record<string, unknown> {
  const { platform, architecture } = splitDesktopTarget(target)
  const base = {
    name: config.appName,
    version: config.version,
    ...(config.description ? { description: config.description } : {}),
    ...(config.publisher ? { author: config.publisher } : {}),
    ...(config.homepage ? { homepage: config.homepage } : {}),
    bundleId: config.appId,
    binaryPath: staged.binary,
    ...(staged.icon ? { iconPath: staged.icon } : {}),
    outDir: staged.outDir,
  }
  if (platform === 'win32') {
    return {
      ...base,
      platforms: ['windows'],
      windows: {
        msi: true,
        zip: true,
        architecture,
        ...(staged.additionalFiles?.length ? { additionalFiles: staged.additionalFiles } : {}),
        ...(config.urlSchemes?.length ? { urlSchemes: config.urlSchemes } : {}),
        ...(config.windows?.certificatePath ? { certificatePath: config.windows.certificatePath, ...(staged.certificatePassword ? { certificatePassword: staged.certificatePassword } : {}) } : {}),
      },
    }
  }
  return {
    ...base,
    platforms: ['linux'],
    linux: {
      appImage: true,
      deb: true,
      rpm: true,
      categories: config.linux?.categories ?? ['Development'],
      ...(config.urlSchemes?.length ? { urlSchemes: config.urlSchemes } : {}),
      ...(config.linux?.debDependencies ? { debDependencies: config.linux.debDependencies } : {}),
      ...(config.linux?.rpmDependencies ? { rpmDependencies: config.linux.rpmDependencies } : {}),
    },
  }
}

/**
 * Which steps of a target's build need that target's own operating system.
 * Compiling the agent does not: Bun cross-compiles. Everything that makes an
 * installer does.
 */
export function nativeBuildSteps(target: DesktopTargetName): string {
  const { platform } = splitDesktopTarget(target)
  if (platform === 'darwin') return 'The .app is assembled and signed with codesign, notarized with notarytool and imaged with hdiutil: macOS only.'
  if (platform === 'win32') return 'The MSI is built with WiX (candle, light) and signed with signtool: Windows only.'
  return 'The AppImage (appimagetool), deb (dpkg-deb) and rpm (rpmbuild) are built with Linux tools: Linux only.'
}

/** `signtool` arguments that sign one Windows file with a `.pfx`, SHA-256, with a trusted timestamp so the signature outlives the certificate. */
export function signtoolArgs(options: { file: string, certificatePath: string, certificatePassword?: string, timestampUrl?: string }): string[] {
  return [
    'signtool.exe',
    'sign',
    '/f',
    options.certificatePath,
    ...(options.certificatePassword ? ['/p', options.certificatePassword] : []),
    '/fd',
    'SHA256',
    '/tr',
    options.timestampUrl ?? 'http://timestamp.digicert.com',
    '/td',
    'SHA256',
    options.file,
  ]
}

/** The file names a release publishes for a target: the one an installed app updates from, and what a person downloads first. */
export function releaseArtifactNames(config: Pick<ResolvedWebviewDesktop, 'appName' | 'version'>, target: DesktopTargetName): { update: string, downloads: string[] } {
  const { platform, architecture } = splitDesktopTarget(target)
  const base = `${config.appName.replace(/[^\w.-]+/g, '-')}-${config.version}-${architecture}`
  if (platform === 'darwin') return { update: `${base}.zip`, downloads: [`${base}.dmg`] }
  if (platform === 'win32') return { update: `${base}.msi`, downloads: [] }
  return { update: `${base}.AppImage`, downloads: [`${base}.deb`, `${base}.rpm`] }
}

/**
 * Why a version must not be published over what a channel already serves, or
 * nothing when it may. A feed that went backwards, or served two different
 * builds under one version, would leave installed apps unable to tell which
 * they have.
 */
export function releaseVersionProblem(version: string, published: string | null | undefined, compare: (left: string, right: string) => number): string | undefined {
  if (!published) return undefined
  const order = compare(version, published)
  if (order === 0) return `${version} is already published. Bump the version; a published build is never replaced under the same number.`
  if (order < 0) return `${published} is already published, which is newer than ${version}.`
  return undefined
}

/** `webview.agent.components`, as absolute directories, in the order the config lists them. */
export function resolveWebviewComponents(root: string, components: readonly string[] | undefined): string[] {
  return (components ?? []).map(directory => resolve(root, directory))
}

/**
 * The script `buddy build:desktop` runs to render an app's views to static
 * files. It hands stx the same component directories, in the same order, as
 * the server `buddy dev:desktop` starts.
 */
export function renderViewsBuildScript(options: { appName: string, root: string, viewsDir: string, outDir: string, components?: readonly string[] }): string {
  const pages = relative(options.root, options.viewsDir)
  const site = {
    name: options.appName,
    url: 'http://127.0.0.1',
    pagesDir: pages,
    outDir: options.outDir,
    publicDir: join(pages, 'public'),
    ...webviewComponentDirs(resolveWebviewComponents(options.root, options.components)),
    sitemap: false,
    robots: false,
  }
  return `// Written by buddy build:desktop. Do not edit.
import { buildStaticSite } from '@stacksjs/stx'

await buildStaticSite(${JSON.stringify(site, null, 2)})
`
}
