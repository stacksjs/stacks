import type { ExtensionConfig } from './types'
import { cpSync, existsSync, readdirSync, statSync } from 'node:fs'
import { mkdir, rm } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { buildExtension, resolveOutdir } from './build'

/**
 * Safari container-app tooling: scaffold the Xcode project, sync the built
 * safari bundle into the appex Resources, and xcodebuild the app.
 *
 * Safari Web Extensions ship inside a macOS app, so the safari target has two
 * halves: the web bundle (`extension:build --target safari`, `dist-safari/`)
 * and the container app scaffolded here (a checked-in, converter-free Xcode
 * project: SwiftUI app + Safari Web Extension appex).
 *
 * The template tree lives in `safari-template/` at the package root and is
 * tokenized (`__APP_NAME__`, `__BUNDLE_ID__`, …); scaffolding copies it and
 * substitutes per project. It mirrors what `xcrun
 * safari-web-extension-converter` generates, so day-to-day work never needs
 * the converter.
 */

/** App target name from the extension display name (`Very Good AdBlock` → `VeryGoodAdBlock`). */
export function safariAppName(config: ExtensionConfig): string {
  const name = config.name.replace(/[^a-z0-9]+/gi, '')
  if (!name)
    throw new Error('[browser-extension] cannot derive an app name from the extension name; set one without spaces')
  return name
}

/** Directory the container app is scaffolded into. */
export function safariProjectDir(cwd = process.cwd(), dir = 'safari'): string {
  return resolve(cwd, dir)
}

function templateRoot(): string {
  // src/safari.ts (dev) and dist/safari.js (published) both sit one level
  // below the package root, which holds safari-template/.
  return resolve(import.meta.dir, '..', 'safari-template')
}

interface ScaffoldVars {
  appName: string
  displayName: string
  bundleId: string
  extBundleId: string
  version: string
  teamId: string
}

function fillTemplate(text: string, vars: ScaffoldVars): string {
  return text
    .replaceAll('__EXT_BUNDLE_ID__', vars.extBundleId)
    .replaceAll('__BUNDLE_ID__', vars.bundleId)
    .replaceAll('__APP_DISPLAY_NAME__', vars.displayName)
    .replaceAll('__APP_NAME__', vars.appName)
    .replaceAll('__MARKETING_VERSION__', vars.version)
    .replaceAll('__DEVELOPMENT_TEAM__', vars.teamId)
    .replaceAll('__YEAR__', String(new Date().getFullYear()))
}

function* walk(dir: string, prefix = ''): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const rel = prefix ? `${prefix}/${entry}` : entry
    if (statSync(join(dir, entry)).isDirectory()) yield* walk(join(dir, entry), rel)
    else yield rel
  }
}

export interface SafariScaffoldOptions {
  /** Base bundle id (appex gets `<bundleId>.Extension`). @default config.safariBundleId ?? `com.example.<app-name-lower>` */
  bundleId?: string
  /** Output directory for the Xcode project. @default 'safari' */
  dir?: string
  /** Overwrite existing scaffold files. @default false */
  force?: boolean
  /** MARKETING_VERSION written into the project. @default '0.1.0' */
  version?: string
  /** Directory of source PNG icons for the AppIcon set. @default the built chrome outdir's icons, else `public/icons` */
  iconsDir?: string
  /** Apple Developer team used for automatic signing. @default config.safariTeamId */
  teamId?: string
  cwd?: string
}

/**
 * Scaffold the macOS container app (Xcode project + SwiftUI app + appex) from
 * the tokenized template. Idempotent: existing files are kept unless `force`.
 * Also renders the AppIcon/ExtensionIcon PNGs from the project's own icons
 * via `sips` (macOS-only step; skipped with a warning elsewhere).
 */
export async function scaffoldSafariApp(config: ExtensionConfig, options: SafariScaffoldOptions = {}): Promise<{ dir: string, written: string[], skipped: string[] }> {
  const cwd = options.cwd ?? process.cwd()
  const appName = safariAppName(config)
  const bundleId = options.bundleId ?? config.safariBundleId ?? `com.example.${appName.toLowerCase()}`
  const dir = safariProjectDir(cwd, options.dir)
  const vars: ScaffoldVars = {
    appName,
    displayName: config.name,
    bundleId,
    extBundleId: `${bundleId}.Extension`,
    version: options.version ?? '0.1.0',
    teamId: options.teamId ?? config.safariTeamId ?? '',
  }

  if (!options.bundleId && !config.safariBundleId)
    console.warn(`[browser-extension] no safari bundle id configured; using placeholder ${bundleId}. Set safariBundleId in config/extension.ts.`)

  const written: string[] = []
  const skipped: string[] = []
  for (const rel of walk(templateRoot())) {
    const outRel = fillTemplate(rel, vars)
    const out = join(dir, outRel)
    if (existsSync(out) && !options.force) {
      skipped.push(outRel)
      continue
    }
    await mkdir(dirname(out), { recursive: true })
    await Bun.write(out, fillTemplate(await Bun.file(join(templateRoot(), rel)).text(), vars))
    written.push(outRel)
  }

  await generateAppIcons(config, dir, vars, options.iconsDir, cwd)

  return { dir, written, skipped }
}

/** macOS icon slots: AppIcon.appiconset (16..1024) + ExtensionIcon.imageset (128, 256). */
const appIconSizes = [16, 32, 64, 128, 256, 512, 1024]

/**
 * Render the asset-catalog PNGs from the extension's own icons using `sips`
 * (always present on macOS). The largest available source is resized to each
 * slot; without `sips` (CI on Linux) the PNGs are skipped with a warning, and
 * `icons:app`-style regeneration is left to the developer's machine.
 */
async function generateAppIcons(config: ExtensionConfig, dir: string, vars: ScaffoldVars, iconsDir: string | undefined, cwd: string): Promise<void> {
  const candidates = [
    iconsDir,
    join(resolve(cwd, resolveOutdir(config, 'chrome')), 'icons'),
    config.public ? join(resolve(cwd, config.public), 'icons') : undefined,
  ].filter(Boolean) as string[]
  const source = candidates.find(d => existsSync(d))
  if (!source) {
    console.warn('[browser-extension] no icons directory found; add PNGs to the asset catalog manually.')
    return
  }

  // Largest available source icon.
  let largest: string | undefined
  let largestSize = 0
  for (const file of readdirSync(source)) {
    const match = /(\d+)\.png$/.exec(file)
    if (match && Number(match[1]) > largestSize) {
      largestSize = Number(match[1])
      largest = join(source, file)
    }
  }
  if (!largest) {
    console.warn(`[browser-extension] no icon PNGs in ${source}; add them to the asset catalog manually.`)
    return
  }

  const appIconDir = join(dir, vars.appName, 'Assets.xcassets', 'AppIcon.appiconset')
  const imageSetDir = join(dir, vars.appName, 'Assets.xcassets', 'ExtensionIcon.imageset')
  await mkdir(appIconDir, { recursive: true })
  await mkdir(imageSetDir, { recursive: true })

  const targets: Array<{ dir: string, name: string, size: number }> = [
    ...appIconSizes.map(size => ({ dir: appIconDir, name: `icon-${size}.png`, size })),
    { dir: imageSetDir, name: 'extension-icon-128.png', size: 128 },
    { dir: imageSetDir, name: 'extension-icon-256.png', size: 256 },
  ]

  for (const t of targets) {
    const proc = Bun.spawn(['sips', '-z', String(t.size), String(t.size), largest, '--out', join(t.dir, t.name)], { stdout: 'ignore', stderr: 'pipe' })
    if ((await proc.exited) !== 0) {
      console.warn(`[browser-extension] sips failed for ${t.name} (macOS only). Generate the icon PNGs on a Mac.`)
      return
    }
  }
}

export interface SafariSyncOptions {
  /** Built safari bundle. @default resolveOutdir(config, 'safari') */
  outdir?: string
  /** Scaffolded app directory. @default 'safari' */
  dir?: string
  cwd?: string
}

/**
 * Mirror the built safari bundle into the appex `Resources/` folder. The
 * project references Resources as a folder, so everything synced here ships
 * in the appex verbatim. Files listed in `config.safariExclude` (e.g.
 * marketing-site pages built into dist) are kept out.
 */
export async function syncSafariResources(config: ExtensionConfig, options: SafariSyncOptions = {}): Promise<{ resources: string, files: number }> {
  const cwd = options.cwd ?? process.cwd()
  const outdir = resolve(cwd, options.outdir ?? resolveOutdir(config, 'safari'))
  if (!existsSync(join(outdir, 'manifest.json')))
    throw new Error(`[browser-extension] ${outdir}/manifest.json is missing. Run extension:build --target safari first.`)

  const appName = safariAppName(config)
  const resources = join(safariProjectDir(cwd, options.dir), `${appName} Extension`, 'Resources')
  const exclude = new Set(config.safariExclude ?? [])

  if (existsSync(resources)) {
    for (const entry of readdirSync(resources)) {
      if (entry !== '.gitkeep')
        await rm(join(resources, entry), { recursive: true, force: true })
    }
  }
  await mkdir(resources, { recursive: true })

  let files = 0
  for (const rel of walk(outdir)) {
    if (exclude.has(rel))
      continue
    const dest = join(resources, rel)
    await mkdir(dirname(dest), { recursive: true })
    cpSync(join(outdir, rel), dest)
    files += 1
  }

  return { resources, files }
}

export interface SafariAppBuildOptions extends SafariSyncOptions {
  /** Build the Release configuration. @default false (Debug) */
  release?: boolean
  /** Allow code signing (needs an Apple Development identity). @default false */
  signed?: boolean
  /** Only build + sync the extension payload; skip xcodebuild. @default false */
  skipXcodebuild?: boolean
  /** Extension version for the build. Required unless the bundle already exists. */
  version?: string
  /** Rebuild the safari bundle before syncing. @default true */
  build?: boolean
}

/**
 * Full pipeline: build the safari bundle, sync it into the appex Resources,
 * then xcodebuild the container app when full Xcode is available. Returns the
 * built `.app` path (undefined when xcodebuild was skipped/unavailable).
 */
export async function buildSafariApp(config: ExtensionConfig, options: SafariAppBuildOptions = {}): Promise<{ appPath?: string, resources: string }> {
  const cwd = options.cwd ?? process.cwd()

  if (options.build !== false) {
    if (!options.version)
      throw new Error('[browser-extension] buildSafariApp needs a version to build the extension')
    await buildExtension(config, { target: 'safari', version: options.version, cwd })
  }

  const { resources } = await syncSafariResources(config, options)
  if (options.skipXcodebuild)
    return { resources }

  const appName = safariAppName(config)
  const dir = safariProjectDir(cwd, options.dir)
  const configuration = options.release ? 'Release' : 'Debug'
  const derivedData = join(dir, 'build')

  // xcodebuild needs full Xcode, not just the Command Line Tools. DEVELOPER_DIR
  // overrides xcode-select (e.g. /Applications/Xcode-beta.app/Contents/Developer).
  const developerDir = (process.env.DEVELOPER_DIR ?? (await Bun.$`xcode-select -p`.text()).trim()).replace(/\/$/, '')
  if (!developerDir.includes('.app/Contents/Developer')) {
    console.error(`[browser-extension] full Xcode is required to build the app (active developer directory: ${developerDir}).`)
    console.error('Install Xcode, then: sudo xcode-select -s /Applications/Xcode.app/Contents/Developer')
    console.error('or point DEVELOPER_DIR at any Xcode toolchain (betas included) for this shell.')
    console.error(`The extension payload is built and synced at ${resources}`)
    return { resources }
  }

  // Signed builds let Xcode fetch or create provisioning profiles and
  // certificates for the Apple ID added in Xcode → Settings → Accounts.
  const signing = options.signed ? ['-allowProvisioningUpdates'] : ['CODE_SIGNING_ALLOWED=NO']
  await Bun.$`xcodebuild -project ${join(dir, `${appName}.xcodeproj`)} -scheme ${appName} -configuration ${configuration} -derivedDataPath ${derivedData} ${signing} build`

  return { appPath: join(derivedData, 'Build', 'Products', configuration, `${appName}.app`), resources }
}

export interface AppStoreConnectAuth {
  /** App Store Connect API key ID. @default APP_STORE_CONNECT_API_KEY_ID */
  keyId?: string
  /** App Store Connect API issuer ID. @default APP_STORE_CONNECT_API_ISSUER_ID */
  issuerId?: string
  /** Filesystem path to the AuthKey_*.p8 file. @default APP_STORE_CONNECT_API_KEY_PATH */
  keyPath?: string
}

export interface SafariPublishOptions extends SafariSyncOptions, AppStoreConnectAuth {
  /** Extension marketing version. */
  version: string
  /** Monotonically increasing CFBundleVersion. @default GITHUB_RUN_NUMBER or current Unix time */
  buildNumber?: string
  /** Apple Developer team. @default config.safariTeamId */
  teamId?: string
  /** Build and validate without uploading to App Store Connect. @default false */
  validateOnly?: boolean
  /** Rebuild the Safari web-extension payload before archiving. @default true */
  build?: boolean
}

function appStoreConnectAuth(options: AppStoreConnectAuth): Required<AppStoreConnectAuth> {
  const keyId = options.keyId ?? process.env.APP_STORE_CONNECT_API_KEY_ID
  const issuerId = options.issuerId ?? process.env.APP_STORE_CONNECT_API_ISSUER_ID
  const keyPath = options.keyPath ?? process.env.APP_STORE_CONNECT_API_KEY_PATH
  const missing = [
    !keyId && 'APP_STORE_CONNECT_API_KEY_ID',
    !issuerId && 'APP_STORE_CONNECT_API_ISSUER_ID',
    !keyPath && 'APP_STORE_CONNECT_API_KEY_PATH',
  ].filter(Boolean)
  if (missing.length)
    throw new Error(`[browser-extension] missing App Store Connect credentials: ${missing.join(', ')}`)
  if (!existsSync(resolve(keyPath!)))
    throw new Error(`[browser-extension] App Store Connect API key not found: ${resolve(keyPath!)}`)
  return { keyId: keyId!, issuerId: issuerId!, keyPath: resolve(keyPath!) }
}

function xcodeAuthArgs(auth: Required<AppStoreConnectAuth>): string[] {
  return [
    '-allowProvisioningUpdates',
    '-authenticationKeyPath', auth.keyPath,
    '-authenticationKeyID', auth.keyId,
    '-authenticationKeyIssuerID', auth.issuerId,
  ]
}

function exportOptionsPlist(method: 'app-store-connect' | 'validation', teamId: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>destination</key>
  <string>upload</string>
  <key>manageAppVersionAndBuildNumber</key>
  <false/>
  <key>method</key>
  <string>${method}</string>
  <key>signingStyle</key>
  <string>automatic</string>
  <key>teamID</key>
  <string>${teamId}</string>
  <key>uploadSymbols</key>
  <true/>
</dict>
</plist>
`
}

/**
 * Create a signed Release archive and either validate it or upload it to App
 * Store Connect. Xcode owns certificate/profile creation and the upload so the
 * same command works locally and in macOS CI with an API key.
 */
export async function publishSafariApp(config: ExtensionConfig, options: SafariPublishOptions): Promise<{ archivePath: string, exportPath: string, buildNumber: string }> {
  const cwd = options.cwd ?? process.cwd()
  const teamId = options.teamId ?? config.safariTeamId
  if (!teamId)
    throw new Error('[browser-extension] Safari publishing needs safariTeamId in config/extension.ts or --team-id')
  const auth = appStoreConnectAuth(options)
  const buildNumber = options.buildNumber ?? process.env.GITHUB_RUN_NUMBER ?? String(Math.floor(Date.now() / 1000))
  if (!/^\d+(?:\.\d+){0,2}$/.test(buildNumber))
    throw new Error(`[browser-extension] invalid Safari build number ${buildNumber}; use one to three dot-separated integers`)

  if (options.build !== false)
    await buildExtension(config, { target: 'safari', version: options.version, cwd })
  await syncSafariResources(config, options)

  const appName = safariAppName(config)
  const dir = safariProjectDir(cwd, options.dir)
  const buildDir = join(dir, 'build')
  const archivePath = join(buildDir, `${appName}.xcarchive`)
  const exportPath = join(buildDir, options.validateOnly ? 'validation' : 'upload')
  const plistPath = join(buildDir, options.validateOnly ? 'ExportOptions.validation.plist' : 'ExportOptions.app-store.plist')
  const authArgs = xcodeAuthArgs(auth)
  await mkdir(buildDir, { recursive: true })
  await rm(archivePath, { recursive: true, force: true })
  await rm(exportPath, { recursive: true, force: true })

  const project = join(dir, `${appName}.xcodeproj`)
  await Bun.$`xcodebuild -project ${project} -scheme ${appName} -configuration Release -destination generic/platform=macOS -archivePath ${archivePath} MARKETING_VERSION=${options.version} CURRENT_PROJECT_VERSION=${buildNumber} DEVELOPMENT_TEAM=${teamId} ${authArgs} archive`

  const method = options.validateOnly ? 'validation' : 'app-store-connect'
  await Bun.write(plistPath, exportOptionsPlist(method, teamId))
  await Bun.$`xcodebuild -exportArchive -archivePath ${archivePath} -exportPath ${exportPath} -exportOptionsPlist ${plistPath} ${authArgs}`

  return { archivePath, exportPath, buildNumber }
}
