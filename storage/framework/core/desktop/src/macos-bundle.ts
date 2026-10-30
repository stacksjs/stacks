import type { MacosDistribution, ResolvedMacosDesktop } from './macos-app'
import { chmodSync, copyFileSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { ICONSET_SIZES, renderHostConfig, renderMacosEntitlements, renderMacosInfoPlist, renderPrivacyManifest } from './macos-app'

export type BundleCommand = (args: string[]) => void

export const runBundleCommand: BundleCommand = (args) => {
  const result = Bun.spawnSync(args, { stdout: 'pipe', stderr: 'pipe' })
  if (result.exitCode !== 0)
    throw new Error(`${args[0]} ${args.slice(1).join(' ')} exited with ${result.exitCode}: ${result.stderr.toString().trim() || result.stdout.toString().trim()}`)
}

export interface AssembleMacosAppOptions {
  config: ResolvedMacosDesktop
  /** The project root, which `config.icon` is relative to. */
  root: string
  /** Craft's AppKit host executable. */
  host: string
  /** The compiled stx screens (one JavaScript file). */
  nativeBundle: string
  /** The directory that will hold `<appName>.app` and its entitlements. */
  output: string
  distribution: MacosDistribution
  /** A `.provisionprofile`, embedded for the Mac App Store. */
  provisioningProfile?: string
  /** A codesign identity (name or hash). `-` (default) signs ad hoc. */
  signingIdentity?: string
  /** Look for the identity in this keychain file only. */
  keychain?: string
  /** Sign without the sandbox, so a development run reads the login Keychain without a provisioning profile. */
  unsandboxed?: boolean
  run?: BundleCommand
}

export interface AssembledMacosApp {
  appPath: string
  entitlementsPath: string
  /** Info.plist keys the app declared that the build owns, and so ignored. */
  ignoredPlistKeys: string[]
  /** What was left out and why, for the build to print. */
  notes: string[]
}

/** A `.icns` from a square PNG: the sizes `iconutil` wants, resized with `sips`. */
export function makeIcns(png: string, output: string, scratch: string, run: BundleCommand = runBundleCommand): void {
  const iconset = join(scratch, 'AppIcon.iconset')
  rmSync(iconset, { recursive: true, force: true })
  mkdirSync(iconset, { recursive: true })
  for (const { file, pixels } of ICONSET_SIZES) run(['sips', '-z', String(pixels), String(pixels), png, '--out', join(iconset, file)])
  run(['iconutil', '-c', 'icns', iconset, '-o', output])
  rmSync(iconset, { recursive: true, force: true })
}

/**
 * Lay out and sign the `.app`: the host as the executable, the compiled
 * screens and host settings in Resources, then `codesign` with the entitlements
 * for the chosen distribution. The same function builds the development app and
 * the Mac App Store app, so what runs locally is what ships.
 */
export function assembleMacosApp(options: AssembleMacosAppOptions): AssembledMacosApp {
  const run = options.run ?? runBundleCommand
  const { config } = options
  const notes: string[] = []
  const appPath = join(options.output, `${config.appName}.app`)
  const contents = join(appPath, 'Contents')
  const macos = join(contents, 'MacOS')
  const resources = join(contents, 'Resources')
  rmSync(appPath, { recursive: true, force: true })
  mkdirSync(macos, { recursive: true })
  mkdirSync(resources, { recursive: true })

  copyFileSync(options.host, join(macos, config.executable))
  chmodSync(join(macos, config.executable), 0o755)
  copyFileSync(options.nativeBundle, join(resources, 'native-screen.js'))
  writeFileSync(join(resources, 'craft-app.json'), renderHostConfig(config))
  writeFileSync(join(resources, 'PrivacyInfo.xcprivacy'), renderPrivacyManifest(config))

  let iconFile: string | undefined
  if (config.icon) {
    const icon = resolve(options.root, config.icon)
    if (!existsSync(icon)) throw new Error(`macos.icon does not exist: ${icon}`)
    if (icon.endsWith('.icns')) copyFileSync(icon, join(resources, 'AppIcon.icns'))
    else makeIcns(icon, join(resources, 'AppIcon.icns'), options.output, run)
    iconFile = 'AppIcon'
  }
  else notes.push('No macos.icon: the app has the generic icon, which the Mac App Store rejects.')

  const plist = renderMacosInfoPlist(config, { iconFile })
  writeFileSync(join(contents, 'Info.plist'), plist.xml)

  if (options.distribution === 'app-store') {
    if (!options.provisioningProfile) throw new Error('A Mac App Store build needs a provisioning profile')
    copyFileSync(options.provisioningProfile, join(contents, 'embedded.provisionprofile'))
  }
  const entitlementsPath = join(options.output, `${config.appName}.entitlements`)
  const entitlements = renderMacosEntitlements(options.unsandboxed ? { ...config, sandbox: false } : config, options.distribution)
  writeFileSync(entitlementsPath, entitlements)
  run(['plutil', '-lint', join(contents, 'Info.plist'), join(resources, 'PrivacyInfo.xcprivacy'), entitlementsPath])

  const identity = options.signingIdentity || '-'
  run([
    'codesign', '--force', '--options', 'runtime', ...(identity === '-' ? [] : ['--timestamp']),
    '--entitlements', entitlementsPath, ...(options.keychain ? ['--keychain', options.keychain] : []), '--sign', identity, appPath,
  ])
  run(['codesign', '--verify', '--deep', '--strict', appPath])
  return { appPath, entitlementsPath, ignoredPlistKeys: plist.ignored, notes }
}
