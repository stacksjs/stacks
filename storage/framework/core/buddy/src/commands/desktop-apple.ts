import type { CLI } from '@stacksjs/types'
import { createHash } from 'node:crypto'
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { basename, join, resolve } from 'node:path'
import process from 'node:process'
import { log } from '@stacksjs/cli'
import { projectPath, storagePath } from '@stacksjs/path'

interface AppleDesktopOptions {
  appName?: string
  bundleId?: string
  teamId?: string
  appVersion?: string
  buildNumber?: string
  minimumMacos?: string
  category?: string
  appSigningIdentity?: string
  installerSigningIdentity?: string
  provisioningProfile?: string
  apiKeyId?: string
  apiIssuerId?: string
  apiKeyPath?: string
  icon?: string
  skipBuild?: boolean
  validateOnly?: boolean
  packageOnly?: boolean
}

export interface AppleDesktopConfig {
  appName: string
  bundleId: string
  teamId: string
  version: string
  buildNumber: string
  minimumMacos: string
  category: string
  appSigningIdentity: string
  installerSigningIdentity: string
  provisioningProfile: string
  apiKeyId: string
  apiIssuerId: string
  apiKeyPath: string
  icon?: string
}

const REQUIRED_TOOLS = ['codesign', 'security', 'productbuild', 'pkgutil', 'xcrun']

function env(name: string): string {
  return process.env[name]?.trim() || ''
}

function xml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function packageMetadata(): { name: string, version: string } {
  const packageJson = JSON.parse(readFileSync(projectPath('package.json'), 'utf8')) as { name?: string, version?: string }
  return {
    name: packageJson.name || 'Stacks',
    version: packageJson.version || '0.1.0',
  }
}

export function resolveAppleDesktopConfig(options: AppleDesktopOptions = {}): AppleDesktopConfig {
  const metadata = packageMetadata()
  const provisioningProfile = options.provisioningProfile || env('APPLE_PROVISIONING_PROFILE')
  const apiKeyPath = options.apiKeyPath || env('APP_STORE_CONNECT_API_KEY_PATH')
  return {
    appName: options.appName || env('APPLE_APP_NAME') || env('APP_NAME') || metadata.name,
    bundleId: options.bundleId || env('APPLE_BUNDLE_ID'),
    teamId: options.teamId || env('APPLE_TEAM_ID'),
    version: options.appVersion || env('APPLE_APP_VERSION') || metadata.version,
    buildNumber: options.buildNumber || env('APPLE_BUILD_NUMBER') || env('GITHUB_RUN_NUMBER') || String(Math.floor(Date.now() / 1000)),
    minimumMacos: options.minimumMacos || env('APPLE_MINIMUM_MACOS') || '13.0',
    category: options.category || env('APPLE_APP_CATEGORY') || 'public.app-category.productivity',
    appSigningIdentity: options.appSigningIdentity || env('APPLE_APP_SIGNING_IDENTITY'),
    installerSigningIdentity: options.installerSigningIdentity || env('APPLE_INSTALLER_SIGNING_IDENTITY'),
    provisioningProfile: provisioningProfile ? resolve(provisioningProfile) : '',
    apiKeyId: options.apiKeyId || env('APP_STORE_CONNECT_API_KEY_ID'),
    apiIssuerId: options.apiIssuerId || env('APP_STORE_CONNECT_API_ISSUER_ID'),
    apiKeyPath: apiKeyPath ? resolve(apiKeyPath) : '',
    icon: options.icon || env('APPLE_APP_ICON') || undefined,
  }
}

export function validateAppleDesktopConfig(config: AppleDesktopConfig, includeApi = true): string[] {
  const errors: string[] = []
  if (process.platform !== 'darwin') errors.push('Mac App Store packaging must run on macOS')
  if (!config.appName) errors.push('APPLE_APP_NAME or --app-name is required')
  if (!/^[A-Za-z0-9][A-Za-z0-9.-]+$/.test(config.bundleId)) errors.push('APPLE_BUNDLE_ID must be a reverse-DNS bundle identifier')
  if (!/^[A-Z0-9]{10}$/.test(config.teamId)) errors.push('APPLE_TEAM_ID must be the 10-character Apple Developer team ID')
  if (!/^\d+(?:\.\d+){0,2}$/.test(config.version)) errors.push('The marketing version must contain one to three numeric components')
  if (!/^[A-Za-z0-9.-]+$/.test(config.buildNumber)) errors.push('The build number must contain only letters, numbers, periods, and hyphens')
  if (!config.appSigningIdentity) errors.push('APPLE_APP_SIGNING_IDENTITY is required')
  if (!config.installerSigningIdentity) errors.push('APPLE_INSTALLER_SIGNING_IDENTITY is required')
  if (!config.provisioningProfile || !existsSync(config.provisioningProfile)) errors.push('APPLE_PROVISIONING_PROFILE must point to an existing .provisionprofile file')
  if (config.icon && !existsSync(resolve(config.icon))) errors.push(`Apple app icon does not exist: ${config.icon}`)
  if (includeApi) {
    if (!config.apiKeyId) errors.push('APP_STORE_CONNECT_API_KEY_ID is required')
    if (!config.apiIssuerId) errors.push('APP_STORE_CONNECT_API_ISSUER_ID is required')
    if (!config.apiKeyPath || !existsSync(config.apiKeyPath)) errors.push('APP_STORE_CONNECT_API_KEY_PATH must point to an existing .p8 file')
  }
  for (const tool of REQUIRED_TOOLS) {
    if (!Bun.which(tool)) errors.push(`Required Apple command is unavailable: ${tool}`)
  }
  return errors
}

export function renderInfoPlist(config: AppleDesktopConfig, executable = 'stacks-desktop'): string {
  const iconEntry = config.icon
    ? '\n  <key>CFBundleIconFile</key>\n  <string>AppIcon</string>'
    : ''
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "https://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDisplayName</key>
  <string>${xml(config.appName)}</string>
  <key>CFBundleExecutable</key>
  <string>${xml(executable)}</string>
  <key>CFBundleIdentifier</key>
  <string>${xml(config.bundleId)}</string>
  <key>CFBundleInfoDictionaryVersion</key>
  <string>6.0</string>
  <key>CFBundleName</key>
  <string>${xml(config.appName)}</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>${xml(config.version)}</string>
  <key>CFBundleVersion</key>
  <string>${xml(config.buildNumber)}</string>
  <key>LSApplicationCategoryType</key>
  <string>${xml(config.category)}</string>
  <key>LSMinimumSystemVersion</key>
  <string>${xml(config.minimumMacos)}</string>${iconEntry}
  <key>NSHighResolutionCapable</key>
  <true/>
</dict>
</plist>
`
}

export function renderAppEntitlements(config: AppleDesktopConfig): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "https://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>com.apple.application-identifier</key>
  <string>${xml(config.teamId)}.${xml(config.bundleId)}</string>
  <key>com.apple.developer.team-identifier</key>
  <string>${xml(config.teamId)}</string>
  <key>com.apple.security.app-sandbox</key>
  <true/>
  <key>com.apple.security.network.client</key>
  <true/>
</dict>
</plist>
`
}

export function renderHelperEntitlements(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "https://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>com.apple.security.app-sandbox</key>
  <true/>
  <key>com.apple.security.inherit</key>
  <true/>
</dict>
</plist>
`
}

export function renderAppleWorkflowCaller(): string {
  return `name: Publish Mac App Store

on:
  workflow_dispatch:
    inputs:
      release-tag:
        description: Git tag used for the GitHub release
        required: true
        type: string
      validate-only:
        description: Validate the signed package without uploading it
        required: false
        default: true
        type: boolean
      mirror-s3:
        description: Mirror artifacts to the configured S3-compatible release registry
        required: false
        default: false
        type: boolean

jobs:
  publish:
    uses: stacksjs/stacks/.github/workflows/desktop-app-store.yml@main
    with:
      app-name: \${{ vars.APPLE_APP_NAME }}
      bundle-id: \${{ vars.APPLE_BUNDLE_ID }}
      team-id: \${{ vars.APPLE_TEAM_ID }}
      desktop-url: \${{ vars.DESKTOP_URL }}
      app-signing-identity: \${{ vars.APPLE_APP_SIGNING_IDENTITY }}
      installer-signing-identity: \${{ vars.APPLE_INSTALLER_SIGNING_IDENTITY }}
      release-tag: \${{ inputs.release-tag }}
      validate-only: \${{ inputs.validate-only }}
      mirror-s3: \${{ inputs.mirror-s3 }}
      s3-provider: \${{ vars.RELEASE_S3_PROVIDER || 'hetzner' }}
      s3-bucket: \${{ vars.RELEASE_S3_BUCKET }}
      s3-region: \${{ vars.RELEASE_S3_REGION }}
      s3-endpoint: \${{ vars.RELEASE_S3_ENDPOINT }}
      s3-prefix: \${{ vars.RELEASE_S3_PREFIX }}
      s3-public-url: \${{ vars.RELEASE_S3_PUBLIC_URL }}
    secrets: inherit
`
}

function command(args: string[], cwd = projectPath()): void {
  const result = Bun.spawnSync(args, {
    cwd,
    stdin: 'inherit',
    stdout: 'inherit',
    stderr: 'inherit',
  })
  if (result.exitCode !== 0)
    throw new Error(`${args[0]} ${args.slice(1).join(' ')} exited with code ${result.exitCode}`)
}

function signingIdentityExists(identity: string): boolean {
  if (!identity) return false
  const result = Bun.spawnSync(['security', 'find-identity', '-v'], {
    stdout: 'pipe',
    stderr: 'pipe',
  })
  return result.exitCode === 0 && result.stdout.toString().includes(identity)
}

function provisioningProfileMatches(config: AppleDesktopConfig): boolean {
  if (!config.provisioningProfile || !existsSync(config.provisioningProfile)) return false
  const result = Bun.spawnSync(['security', 'cms', '-D', '-i', config.provisioningProfile], {
    stdout: 'pipe',
    stderr: 'pipe',
  })
  if (result.exitCode !== 0) return false
  const profile = result.stdout.toString()
  return profile.includes(config.bundleId) && profile.includes(config.teamId)
}

async function buildDesktop(): Promise<void> {
  const { runAction } = await import('@stacksjs/actions')
  const { Action } = await import('@stacksjs/enums')
  const result = await runAction(Action.BuildDesktop)
  if (result.isErr) throw result.error
}

function sha256(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

async function packageAppleDesktop(config: AppleDesktopConfig, skipBuild = false): Promise<string> {
  const errors = validateAppleDesktopConfig(config, false)
  if (!signingIdentityExists(config.appSigningIdentity))
    errors.push(`App signing identity is not installed: ${config.appSigningIdentity}`)
  if (!signingIdentityExists(config.installerSigningIdentity))
    errors.push(`Installer signing identity is not installed: ${config.installerSigningIdentity}`)
  if (!provisioningProfileMatches(config))
    errors.push(`Provisioning profile does not match ${config.teamId}.${config.bundleId}`)
  if (errors.length) throw new Error(errors.join('\n'))

  if (!skipBuild) await buildDesktop()

  const desktopDist = storagePath('framework/desktop-dist')
  const launcher = join(desktopDist, 'stacks-desktop')
  const runtime = join(desktopDist, 'craft-runtime')
  const manifest = join(desktopDist, 'desktop.json')
  for (const path of [launcher, runtime, manifest]) {
    if (!existsSync(path)) throw new Error(`Desktop build artifact is missing: ${path}`)
  }

  const appleDir = join(desktopDist, 'apple')
  const appPath = join(appleDir, `${config.appName}.app`)
  const contents = join(appPath, 'Contents')
  const macosDir = join(contents, 'MacOS')
  const resourcesDir = join(contents, 'Resources')
  if (existsSync(appleDir)) rmSync(appleDir, { recursive: true })
  mkdirSync(macosDir, { recursive: true })
  mkdirSync(resourcesDir, { recursive: true })

  copyFileSync(launcher, join(macosDir, 'stacks-desktop'))
  copyFileSync(runtime, join(macosDir, 'craft-runtime'))
  copyFileSync(manifest, join(macosDir, 'desktop.json'))
  copyFileSync(config.provisioningProfile, join(contents, 'embedded.provisionprofile'))
  chmodSync(join(macosDir, 'stacks-desktop'), 0o755)
  chmodSync(join(macosDir, 'craft-runtime'), 0o755)

  if (config.icon) copyFileSync(resolve(config.icon), join(resourcesDir, 'AppIcon.icns'))

  const infoPlist = join(contents, 'Info.plist')
  const appEntitlements = join(appleDir, 'app.entitlements')
  const helperEntitlements = join(appleDir, 'helper.entitlements')
  writeFileSync(infoPlist, renderInfoPlist(config))
  writeFileSync(appEntitlements, renderAppEntitlements(config))
  writeFileSync(helperEntitlements, renderHelperEntitlements())

  command(['plutil', '-lint', infoPlist, appEntitlements, helperEntitlements])
  command([
    'codesign',
    '--force',
    '--timestamp',
    '--options',
    'runtime',
    '--entitlements',
    helperEntitlements,
    '--sign',
    config.appSigningIdentity,
    join(macosDir, 'craft-runtime'),
  ])
  command([
    'codesign',
    '--force',
    '--timestamp',
    '--options',
    'runtime',
    '--entitlements',
    appEntitlements,
    '--sign',
    config.appSigningIdentity,
    appPath,
  ])
  command(['codesign', '--verify', '--deep', '--strict', '--verbose=2', appPath])
  command(['codesign', '-d', '--entitlements', ':-', appPath])

  const packagePath = join(appleDir, `${config.appName}-${config.version}-${config.buildNumber}.pkg`)
  command([
    'productbuild',
    '--component',
    appPath,
    '/Applications',
    '--sign',
    config.installerSigningIdentity,
    packagePath,
  ])
  command(['pkgutil', '--check-signature', packagePath])

  const packageHash = sha256(packagePath)
  writeFileSync(join(appleDir, 'checksums.sha256'), `${packageHash}  ${basename(packagePath)}\n`)
  writeFileSync(join(appleDir, 'apple-provenance.json'), `${JSON.stringify({
    schemaVersion: '1.0.0',
    appName: config.appName,
    bundleId: config.bundleId,
    teamId: config.teamId,
    version: config.version,
    buildNumber: config.buildNumber,
    minimumMacos: config.minimumMacos,
    package: { name: basename(packagePath), sha256: packageHash },
    sourceRevision: Bun.spawnSync(['git', 'rev-parse', 'HEAD'], { cwd: projectPath() }).stdout.toString().trim(),
    craft: { sha256: sha256(join(macosDir, 'craft-runtime')) },
  }, null, 2)}\n`)

  return packagePath
}

function validateOrUpload(packagePath: string, config: AppleDesktopConfig, validateOnly: boolean): void {
  const errors = validateAppleDesktopConfig(config, true)
  if (errors.length) throw new Error(errors.join('\n'))

  const common = [
    '--type',
    'macos',
    '--file',
    packagePath,
    '--apiKey',
    config.apiKeyId,
    '--apiIssuer',
    config.apiIssuerId,
  ]
  process.env.API_PRIVATE_KEYS_DIR = resolve(config.apiKeyPath, '..')
  command(['xcrun', 'altool', '--validate-app', ...common])
  if (!validateOnly) command(['xcrun', 'altool', '--upload-app', ...common])
}

function fail(error: unknown): never {
  log.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
}

export function desktopApple(buddy: CLI): void {
  buddy
    .command('desktop:apple:doctor', 'Validate Mac App Store tooling, credentials, certificates, and project metadata')
    .option('--app-name <name>', 'Mac App Store display name')
    .option('--bundle-id <id>', 'Reverse-DNS bundle identifier')
    .option('--team-id <id>', 'Apple Developer team ID')
    .option('--app-signing-identity <identity>', 'Mac App Distribution signing identity')
    .option('--installer-signing-identity <identity>', 'Mac Installer Distribution signing identity')
    .option('--provisioning-profile <path>', 'Mac App Store provisioning profile')
    .option('--api-key-id <id>', 'App Store Connect API key ID')
    .option('--api-issuer-id <id>', 'App Store Connect API issuer ID')
    .option('--api-key-path <path>', 'App Store Connect AuthKey .p8 file')
    .action((options: AppleDesktopOptions) => {
      try {
        const config = resolveAppleDesktopConfig(options)
        const errors = validateAppleDesktopConfig(config, true)
        if (!signingIdentityExists(config.appSigningIdentity))
          errors.push(`App signing identity is not installed: ${config.appSigningIdentity}`)
        if (!signingIdentityExists(config.installerSigningIdentity))
          errors.push(`Installer signing identity is not installed: ${config.installerSigningIdentity}`)
        if (!provisioningProfileMatches(config))
          errors.push(`Provisioning profile does not match ${config.teamId}.${config.bundleId}`)
        if (errors.length) throw new Error(errors.join('\n'))
        log.success(`Mac App Store prerequisites are ready for ${config.bundleId}`)
      }
      catch (error) {
        fail(error)
      }
    })

  buddy
    .command('desktop:apple:init', 'Create a GitHub Actions caller for the reusable Stacks Mac App Store workflow')
    .option('--force', 'Replace an existing workflow')
    .action((options: { force?: boolean }) => {
      try {
        const workflowPath = projectPath('.github/workflows/apple-app-store.yml')
        if (existsSync(workflowPath) && !options.force)
          throw new Error(`${workflowPath} already exists. Use --force to replace it.`)
        mkdirSync(resolve(workflowPath, '..'), { recursive: true })
        writeFileSync(workflowPath, renderAppleWorkflowCaller())
        log.success(`Created ${workflowPath}`)
      }
      catch (error) {
        fail(error)
      }
    })

  const addSharedOptions = (commandBuilder: any) => commandBuilder
    .option('--app-name <name>', 'Mac App Store display name')
    .option('--bundle-id <id>', 'Reverse-DNS bundle identifier')
    .option('--team-id <id>', 'Apple Developer team ID')
    .option('--app-version <version>', 'Marketing version')
    .option('--build-number <number>', 'Unique App Store build number')
    .option('--minimum-macos <version>', 'Minimum supported macOS version')
    .option('--category <category>', 'LSApplicationCategoryType value')
    .option('--app-signing-identity <identity>', 'Mac App Distribution signing identity')
    .option('--installer-signing-identity <identity>', 'Mac Installer Distribution signing identity')
    .option('--provisioning-profile <path>', 'Mac App Store provisioning profile')
    .option('--icon <path>', 'Optional .icns app icon')
    .option('--skip-build', 'Package existing storage/framework/desktop-dist artifacts')

  addSharedOptions(buddy.command('desktop:apple:package', 'Build, sandbox, sign, and package a Mac App Store desktop app'))
    .action(async (options: AppleDesktopOptions) => {
      try {
        const packagePath = await packageAppleDesktop(resolveAppleDesktopConfig(options), Boolean(options.skipBuild))
        log.success(`Created signed Mac App Store package ${packagePath}`)
      }
      catch (error) {
        fail(error)
      }
    })

  addSharedOptions(buddy.command('desktop:apple:publish', 'Build and validate or upload a signed Mac App Store package'))
    .option('--api-key-id <id>', 'App Store Connect API key ID')
    .option('--api-issuer-id <id>', 'App Store Connect API issuer ID')
    .option('--api-key-path <path>', 'App Store Connect AuthKey .p8 file')
    .option('--validate-only', 'Validate with App Store Connect without uploading')
    .option('--package-only', 'Create the signed package without contacting App Store Connect')
    .action(async (options: AppleDesktopOptions) => {
      try {
        const config = resolveAppleDesktopConfig(options)
        const packagePath = await packageAppleDesktop(config, Boolean(options.skipBuild))
        if (!options.packageOnly)
          validateOrUpload(packagePath, config, Boolean(options.validateOnly))
        log.success(options.packageOnly
          ? `Created signed Mac App Store package ${packagePath}`
          : options.validateOnly
            ? `Validated ${packagePath} with App Store Connect`
            : `Uploaded ${packagePath} to App Store Connect`)
      }
      catch (error) {
        fail(error)
      }
    })
}
