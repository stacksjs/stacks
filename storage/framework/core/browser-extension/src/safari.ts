import type { ExtensionConfig, SafariPlatform } from './types'
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

/** Safari platforms selected in config, de-duplicated in stable order. */
export function resolveSafariPlatforms(config: ExtensionConfig, platforms?: SafariPlatform[]): SafariPlatform[] {
  const selected = platforms ?? config.safariPlatforms ?? ['macos']
  return [...new Set(selected)]
}

function safariPlatformFlag(platforms: SafariPlatform[]): string | undefined {
  if (platforms.length !== 1)
    return undefined
  return platforms[0] === 'ios' ? '--ios-only' : '--macos-only'
}

export function safariPackagerArgs(input: string, projectLocation: string, appName: string, bundleId: string, platforms: SafariPlatform[]): string[] {
  const platformFlag = safariPlatformFlag(platforms)
  return [
    'safari-web-extension-packager',
    '--project-location', projectLocation,
    '--app-name', appName,
    '--bundle-identifier', bundleId,
    '--swift',
    '--copy-resources',
    '--no-open',
    '--no-prompt',
    '--force',
    ...(platformFlag ? [platformFlag] : []),
    input,
  ]
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

function safariResourceCopyBuildPhase(appName: string): string {
  return `/* Begin PBXShellScriptBuildPhase section */
\t\t0D0000000000000000000023 /* Copy Web Extension Resources */ = {
\t\t\tisa = PBXShellScriptBuildPhase;
\t\t\talwaysOutOfDate = 1;
\t\t\tbuildActionMask = 2147483647;
\t\t\tfiles = (
\t\t\t);
\t\t\tinputFileListPaths = (
\t\t\t\t"$(SRCROOT)/${appName} Extension/Resources.inputs.xcfilelist",
\t\t\t);
\t\t\tname = "Copy Web Extension Resources";
\t\t\toutputFileListPaths = (
\t\t\t\t"$(SRCROOT)/${appName} Extension/Resources.outputs.xcfilelist",
\t\t\t);
\t\t\trunOnlyForDeploymentPostprocessing = 0;
\t\t\tshellPath = /bin/sh;
\t\t\tshellScript = "set -e\\nresources_root=\\"\${SRCROOT}/${appName} Extension/Resources/\\"\\nwhile IFS= read -r source_file; do\\n  relative_path=\\"\${source_file#$resources_root}\\"\\n  output_file=\\"\${TARGET_BUILD_DIR}/\${UNLOCALIZED_RESOURCES_FOLDER_PATH}/\${relative_path}\\"\\n  /bin/mkdir -p \\"$(/usr/bin/dirname \\\"$output_file\\\")\\"\\n  /bin/cp \\"$source_file\\" \\"$output_file\\"\\ndone < \\"$SCRIPT_INPUT_FILE_LIST_0\\"\\n";
\t\t};
/* End PBXShellScriptBuildPhase section */

`
}

/** Upgrade a Stacks-generated project that copied Resources as a nested folder. */
export function migrateSafariResourceBuildPhase(project: string, appName: string): string {
  if (project.includes("resources_prefix='$(SRCROOT)")) {
    return project.replace(
      /\/\* Begin PBXShellScriptBuildPhase section \*\/[\s\S]*?\/\* End PBXShellScriptBuildPhase section \*\/\n/,
      safariResourceCopyBuildPhase(appName),
    )
  }
  if (project.includes('SCRIPT_INPUT_FILE_LIST_0'))
    return project
  if (project.includes('0D0000000000000000000023 /* Copy Web Extension Resources */')) {
    return project.replace(
      /\/\* Begin PBXShellScriptBuildPhase section \*\/[\s\S]*?\/\* End PBXShellScriptBuildPhase section \*\/\n/,
      safariResourceCopyBuildPhase(appName),
    )
  }
  if (!project.includes('0C0000000000000000000023 /* Resources in Resources */'))
    return project

  return project
    .replace(/^\s*0C0000000000000000000023 \/\* Resources in Resources \*\/.*\n/m, '')
    .replace(/^\s*0C0000000000000000000023 \/\* Resources in Resources \*\/,\n/mg, '')
    .replace(
      '\t\t\t\t0D0000000000000000000022 /* Resources */,\n',
      '\t\t\t\t0D0000000000000000000022 /* Resources */,\n\t\t\t\t0D0000000000000000000023 /* Copy Web Extension Resources */,\n',
    )
    .replace('/* Begin PBXSourcesBuildPhase section */', `${safariResourceCopyBuildPhase(appName)}/* Begin PBXSourcesBuildPhase section */`)
}

function* walk(dir: string, prefix = ''): Generator<string> {
  for (const entry of readdirSync(dir).sort()) {
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

async function mirrorSafariResources(config: ExtensionConfig, outdir: string, resources: string, keepPlaceholder = false): Promise<string[]> {
  const exclude = new Set(config.safariExclude ?? [])
  await rm(resources, { recursive: true, force: true })
  await mkdir(resources, { recursive: true })
  if (keepPlaceholder)
    await Bun.write(join(resources, '.gitkeep'), '')

  const synced: string[] = []
  for (const rel of walk(outdir)) {
    if (exclude.has(rel) || rel.split('/').includes('.DS_Store'))
      continue
    const dest = join(resources, rel)
    await mkdir(dirname(dest), { recursive: true })
    cpSync(join(outdir, rel), dest)
    synced.push(rel)
  }
  return synced
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
  const projectDir = safariProjectDir(cwd, options.dir)
  const projectPath = join(projectDir, `${appName}.xcodeproj`, 'project.pbxproj')
  if (existsSync(projectPath)) {
    const project = await Bun.file(projectPath).text()
    const migrated = migrateSafariResourceBuildPhase(project, appName)
    if (migrated !== project)
      await Bun.write(projectPath, migrated)
  }

  const resources = join(projectDir, `${appName} Extension`, 'Resources')
  const synced = await mirrorSafariResources(config, outdir, resources, true)

  const inputs = synced.map(rel => `$(SRCROOT)/${appName} Extension/Resources/${rel}`).join('\n')
  const outputs = synced.map(rel => `$(TARGET_BUILD_DIR)/$(UNLOCALIZED_RESOURCES_FOLDER_PATH)/${rel}`).join('\n')
  await Bun.write(join(projectDir, `${appName} Extension`, 'Resources.inputs.xcfilelist'), `${inputs}\n`)
  await Bun.write(join(projectDir, `${appName} Extension`, 'Resources.outputs.xcfilelist'), `${outputs}\n`)

  return { resources, files: synced.length }
}

export interface SafariUniversalProjectOptions extends SafariSyncOptions {
  /** Apple platforms included in the generated project. @default config.safariPlatforms ?? ['macos'] */
  platforms?: SafariPlatform[]
  /** Build the Safari web bundle before packaging. */
  build?: boolean
  /** Extension version, required when build is enabled. */
  version?: string
}

export interface SafariUniversalProject {
  dir: string
  project: string
  resources: string
  platforms: SafariPlatform[]
}

/** Generate a clean Apple-supported Safari project for macOS, iOS, or both. */
export async function createSafariUniversalProject(config: ExtensionConfig, options: SafariUniversalProjectOptions = {}): Promise<SafariUniversalProject> {
  const cwd = options.cwd ?? process.cwd()
  if (options.build !== false) {
    if (!options.version)
      throw new Error('[browser-extension] createSafariUniversalProject needs a version to build the extension')
    await buildExtension(config, { target: 'safari', version: options.version, cwd })
  }

  const outdir = resolve(cwd, options.outdir ?? resolveOutdir(config, 'safari'))
  if (!existsSync(join(outdir, 'manifest.json')))
    throw new Error(`[browser-extension] ${outdir}/manifest.json is missing. Run extension:build --target safari first.`)

  const appName = safariAppName(config)
  const bundleId = config.safariBundleId
  if (!bundleId)
    throw new Error('[browser-extension] universal Safari packaging needs safariBundleId in config/extension.ts')
  const platforms = resolveSafariPlatforms(config, options.platforms)
  if (!platforms.length)
    throw new Error('[browser-extension] universal Safari packaging needs at least one platform')

  const buildDir = join(safariProjectDir(cwd, options.dir), 'build')
  const resources = join(buildDir, 'universal-resources')
  const projectLocation = join(buildDir, 'universal-project')
  await mirrorSafariResources(config, outdir, resources)
  await rm(projectLocation, { recursive: true, force: true })
  await mkdir(projectLocation, { recursive: true })

  const args = safariPackagerArgs(resources, projectLocation, appName, bundleId, platforms)
  const child = Bun.spawn(['xcrun', ...args], { cwd, stdout: 'inherit', stderr: 'inherit' })
  const exitCode = await child.exited
  if (exitCode !== 0)
    throw new Error(`[browser-extension] Safari web extension packager failed (${exitCode})`)

  const dir = join(projectLocation, appName)
  const project = join(dir, `${appName}.xcodeproj`)
  if (!existsSync(project))
    throw new Error(`[browser-extension] Safari packager did not create ${project}`)
  return { dir, project, resources, platforms }
}

export interface SafariUniversalBuildOptions extends SafariUniversalProjectOptions {
  /** Build the Release configuration. @default false */
  release?: boolean
  /** Allow signing for the macOS app. iOS local builds target Simulator. @default false */
  signed?: boolean
  /** Generate the universal project without invoking xcodebuild. @default false */
  skipXcodebuild?: boolean
}

export interface SafariUniversalBuildResult extends SafariUniversalProject {
  appPaths: Partial<Record<SafariPlatform, string>>
}

/** Build Apple-supported macOS and iOS Safari containers from one web bundle. */
export async function buildSafariUniversalApp(config: ExtensionConfig, options: SafariUniversalBuildOptions = {}): Promise<SafariUniversalBuildResult> {
  const generated = await createSafariUniversalProject(config, options)
  const appPaths: Partial<Record<SafariPlatform, string>> = {}
  if (options.skipXcodebuild)
    return { ...generated, appPaths }

  const appName = safariAppName(config)
  const configuration = options.release ? 'Release' : 'Debug'
  const derivedData = join(safariProjectDir(options.cwd ?? process.cwd(), options.dir), 'build', 'universal-derived')
  await rm(derivedData, { recursive: true, force: true })

  for (const platform of generated.platforms) {
    const ios = platform === 'ios'
    const args = [
      'xcodebuild',
      '-project', generated.project,
      '-scheme', `${appName} (${ios ? 'iOS' : 'macOS'})`,
      '-configuration', configuration,
      '-destination', ios ? 'generic/platform=iOS Simulator' : 'generic/platform=macOS',
      '-derivedDataPath', derivedData,
      ...(ios ? ['-sdk', 'iphonesimulator', 'CODE_SIGNING_ALLOWED=NO'] : options.signed ? ['-allowProvisioningUpdates'] : ['CODE_SIGNING_ALLOWED=NO']),
      'build',
    ]
    const child = Bun.spawn(args, { cwd: generated.dir, stdout: 'inherit', stderr: 'inherit' })
    const exitCode = await child.exited
    if (exitCode !== 0)
      throw new Error(`[browser-extension] Safari ${platform} app build failed (${exitCode})`)
    const products = ios ? `${configuration}-iphonesimulator` : configuration
    appPaths[platform] = join(derivedData, 'Build', 'Products', products, `${appName}.app`)
  }

  return { ...generated, appPaths }
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
  /** Apple platforms to archive and upload. @default config.safariPlatforms ?? ['macos'] */
  platforms?: SafariPlatform[]
}

export interface SafariPublishedArtifact {
  platform: SafariPlatform
  archivePath: string
  exportPath: string
}

export interface SafariPublishResult {
  /** First archive, kept for compatibility with macOS-only callers. */
  archivePath: string
  /** First export directory, kept for compatibility with macOS-only callers. */
  exportPath: string
  buildNumber: string
  artifacts: SafariPublishedArtifact[]
}

/** Resolve and validate App Store Connect credentials from options or environment variables. */
export function resolveAppStoreConnectAuth(options: AppStoreConnectAuth): Required<AppStoreConnectAuth> {
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

async function runXcodebuild(args: string[], cwd: string, operation: string): Promise<void> {
  const child = Bun.spawn(['xcodebuild', ...args], { cwd, stdout: 'inherit', stderr: 'inherit' })
  const exitCode = await child.exited
  if (exitCode !== 0)
    throw new Error(`[browser-extension] ${operation} failed (${exitCode})`)
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
export async function publishSafariApp(config: ExtensionConfig, options: SafariPublishOptions): Promise<SafariPublishResult> {
  const cwd = options.cwd ?? process.cwd()
  const teamId = options.teamId ?? config.safariTeamId
  if (!teamId)
    throw new Error('[browser-extension] Safari publishing needs safariTeamId in config/extension.ts or --team-id')
  const auth = resolveAppStoreConnectAuth(options)
  const buildNumber = options.buildNumber ?? process.env.GITHUB_RUN_NUMBER ?? String(Math.floor(Date.now() / 1000))
  if (!/^\d+(?:\.\d+){0,2}$/.test(buildNumber))
    throw new Error(`[browser-extension] invalid Safari build number ${buildNumber}; use one to three dot-separated integers`)
  const platforms = resolveSafariPlatforms(config, options.platforms)
  if (!platforms.length)
    throw new Error('[browser-extension] Safari publishing needs at least one platform')

  const { provisionSafariApp } = await import('./app-store-connect')
  const provisioned = await provisionSafariApp(config, {
    ...auth,
    version: options.version,
    platforms,
  })
  if (!provisioned.appRecord.exists)
    throw new Error('[browser-extension] the App Store Connect app record is missing; create it once in App Store Connect before publishing')

  if (options.build !== false)
    await buildExtension(config, { target: 'safari', version: options.version, cwd })

  const appName = safariAppName(config)
  const dir = safariProjectDir(cwd, options.dir)
  const buildDir = join(dir, 'build')

  // The checked-in scaffold remains the fast macOS-only path. iOS uses
  // Apple's current packager so one generated project owns matching macOS,
  // iPhone, and iPad targets under the same app record and bundle IDs.
  const universal = platforms.includes('ios')
  let project: string
  let projectCwd: string
  if (universal) {
    const generated = await createSafariUniversalProject(config, {
      ...options,
      build: false,
      platforms,
    })
    project = generated.project
    projectCwd = generated.dir
  }
  else {
    await syncSafariResources(config, options)
    project = join(dir, `${appName}.xcodeproj`)
    projectCwd = dir
  }

  const authArgs = xcodeAuthArgs(auth)
  await mkdir(buildDir, { recursive: true })

  const method = options.validateOnly ? 'validation' : 'app-store-connect'
  const artifacts: SafariPublishedArtifact[] = []
  for (const platform of platforms) {
    const suffix = universal ? `-${platform}` : ''
    const archivePath = join(buildDir, `${appName}${suffix}.xcarchive`)
    const exportPath = join(buildDir, `${options.validateOnly ? 'validation' : 'upload'}${suffix}`)
    const plistPath = join(buildDir, `ExportOptions.${method}${suffix}.plist`)
    const scheme = universal ? `${appName} (${platform === 'ios' ? 'iOS' : 'macOS'})` : appName
    const destination = platform === 'ios' ? 'generic/platform=iOS' : 'generic/platform=macOS'
    await rm(archivePath, { recursive: true, force: true })
    await rm(exportPath, { recursive: true, force: true })

    await runXcodebuild([
      '-project', project,
      '-scheme', scheme,
      '-configuration', 'Release',
      '-destination', destination,
      '-archivePath', archivePath,
      `MARKETING_VERSION=${options.version}`,
      `CURRENT_PROJECT_VERSION=${buildNumber}`,
      `DEVELOPMENT_TEAM=${teamId}`,
      // A development-signed device archive needs a registered UDID. Keep the
      // iOS archive unsigned so export can use API-key-backed cloud signing.
      ...(platform === 'ios' ? ['CODE_SIGNING_ALLOWED=NO'] : []),
      ...(platform === 'macos' && config.safariAppCategory ? [`INFOPLIST_KEY_LSApplicationCategoryType=${config.safariAppCategory}`] : []),
      ...authArgs,
      'archive',
    ], projectCwd, `Safari ${platform} archive`)

    await Bun.write(plistPath, exportOptionsPlist(method, teamId))
    await runXcodebuild([
      '-exportArchive',
      '-archivePath', archivePath,
      '-exportPath', exportPath,
      '-exportOptionsPlist', plistPath,
      ...authArgs,
    ], projectCwd, `Safari ${platform} export`)
    artifacts.push({ platform, archivePath, exportPath })
  }

  return {
    archivePath: artifacts[0].archivePath,
    exportPath: artifacts[0].exportPath,
    buildNumber,
    artifacts,
  }
}
