import type { DesktopAgentManifest } from './agent-launcher'
import type { MacosDistribution, ResolvedMacosDesktop } from './macos-app'
import { chmodSync, copyFileSync, cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { AGENT_MANIFEST } from './agent-launcher'
import { ICONSET_SIZES, renderHostConfig, renderMacosEntitlements, renderMacosHostEntitlements, renderMacosInfoPlist, renderPrivacyManifest } from './macos-app'

/** The AppKit host's name inside `Contents/MacOS` when an agent launcher is the executable. */
export const AGENT_HOST_EXECUTABLE = 'craft-runtime'

export interface MacosAgentBundle {
  /** The compiled agent launcher (a Bun executable), which becomes the app's executable. */
  launcher: string
  /** What the launcher reads at start; `host`, `nativeBundle` and `staticDir` are rewritten to the bundle's own copies. */
  manifest: Omit<DesktopAgentManifest, 'host' | 'nativeBundle'>
}

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
  /** `macos.agent`: the launcher and its manifest. The host then sits beside the launcher as `craft-runtime`. */
  agent?: MacosAgentBundle
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

  if (options.agent) {
    if (!config.agent) throw new Error('An agent launcher was given for an app whose config has no macos.agent')
    // The launcher is the executable, so the app's identity (its permissions,
    // its Dock icon) is the bundle's; the host it spawns from inside the bundle
    // reads craft-app.json from the same Resources.
    copyFileSync(options.agent.launcher, join(macos, config.executable))
    copyFileSync(options.host, join(macos, AGENT_HOST_EXECUTABLE))
    chmodSync(join(macos, AGENT_HOST_EXECUTABLE), 0o755)
    const manifest: DesktopAgentManifest = { ...options.agent.manifest, host: `../MacOS/${AGENT_HOST_EXECUTABLE}`, nativeBundle: 'native-screen.js' }
    if (options.agent.manifest.staticDir) {
      cpSync(options.agent.manifest.staticDir, join(resources, 'web'), { recursive: true })
      manifest.staticDir = 'web'
    }
    writeFileSync(join(resources, AGENT_MANIFEST), `${JSON.stringify(manifest, null, 2)}\n`)
  }
  else {
    copyFileSync(options.host, join(macos, config.executable))
  }
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
  const signed = options.unsandboxed ? { ...config, sandbox: false } : config
  const entitlementsPath = join(options.output, `${config.appName}.entitlements`)
  writeFileSync(entitlementsPath, renderMacosEntitlements(signed, options.distribution))
  const hostEntitlements = join(options.output, `${config.appName}.host.entitlements`)
  if (options.agent) writeFileSync(hostEntitlements, renderMacosHostEntitlements(signed))
  run(['plutil', '-lint', join(contents, 'Info.plist'), join(resources, 'PrivacyInfo.xcprivacy'), entitlementsPath, ...(options.agent ? [hostEntitlements] : [])])

  const identity = options.signingIdentity || '-'
  if (options.agent) {
    // Nested code is signed before the bundle that seals it.
    run([
      'codesign', '--force', '--options', 'runtime', ...(identity === '-' ? [] : ['--timestamp']),
      '--entitlements', hostEntitlements, ...(options.keychain ? ['--keychain', options.keychain] : []), '--sign', identity, join(macos, AGENT_HOST_EXECUTABLE),
    ])
  }
  run([
    'codesign', '--force', '--options', 'runtime', ...(identity === '-' ? [] : ['--timestamp']),
    '--entitlements', entitlementsPath, ...(options.keychain ? ['--keychain', options.keychain] : []), '--sign', identity, appPath,
  ])
  run(['codesign', '--verify', '--deep', '--strict', appPath])
  return { appPath, entitlementsPath, ignoredPlistKeys: plist.ignored, notes }
}

/**
 * The first "Apple Development" identity in `security find-identity -v -p codesigning`
 * output, by its hash (a name can be shared by two certificates).
 */
export function parseDevelopmentIdentity(output: string): string | undefined {
  for (const line of output.split('\n')) {
    const match = /^\s*\d+\)\s+([0-9A-F]{40})\s+"Apple Development:/.exec(line)
    if (match) return match[1]
  }
  return undefined
}

/**
 * The identity a development build is signed with, when the machine has one.
 *
 * Ad hoc signing gives every rebuild a new code hash, and a Keychain item's
 * access list trusts the code that wrote it: the next launch of a rebuilt app
 * stops on a "wants to use your confidential information" prompt, with no
 * window until someone answers it. A stable certificate keeps the app's
 * designated requirement the same across rebuilds, so the item stays trusted.
 */
export function findDevelopmentIdentity(read: () => string = () => Bun.spawnSync(['security', 'find-identity', '-v', '-p', 'codesigning'], { stdout: 'pipe', stderr: 'ignore' }).stdout.toString()): string | undefined {
  try { return parseDevelopmentIdentity(read()) }
  catch { return undefined }
}
