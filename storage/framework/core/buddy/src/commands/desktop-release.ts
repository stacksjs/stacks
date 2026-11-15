import type { CLI } from '@stacksjs/types'
import process from 'node:process'
import { runAction } from '@stacksjs/actions'
import { intro, log, outro } from '@stacksjs/cli'
import { Action } from '@stacksjs/enums'
import { projectPath } from '@stacksjs/path'
import { ExitCode } from '@stacksjs/types'
import { resultFailed } from '../result'

interface ReleaseDesktopOptions {
  target?: string
  identity?: string
  notaryProfile?: string
  notarize?: boolean
  apiKeyId?: string
  apiIssuerId?: string
  apiKeyPath?: string
  native?: boolean
  packageOnly?: boolean
  channel?: string
  notes?: string
  skipBuild?: boolean
  dryRun?: boolean
  allowDirty?: boolean
  verbose?: boolean
}

/**
 * The environment `release:desktop` hands the build and release actions.
 * Flags win over what is already set, so a terminal can override CI secrets
 * for one run; nothing is cleared.
 */
export function releaseDesktopEnvironment(options: ReleaseDesktopOptions, env: Record<string, string | undefined> = process.env): Record<string, string> {
  const set: Record<string, string> = {}
  if (options.target) set.DESKTOP_TARGETS = options.target
  if (options.identity) set.DESKTOP_SIGNING_IDENTITY = options.identity
  if (options.notaryProfile) set.DESKTOP_NOTARY_PROFILE = options.notaryProfile
  // An App Store Connect API key notarizes without a keychain profile: what CI holds, and what `desktop:apple` already reads.
  if (options.notarize) set.DESKTOP_NOTARIZE = '1'
  if (options.apiKeyId) set.APP_STORE_CONNECT_API_KEY_ID = options.apiKeyId
  if (options.apiIssuerId) set.APP_STORE_CONNECT_API_ISSUER_ID = options.apiIssuerId
  if (options.apiKeyPath) set.APP_STORE_CONNECT_API_KEY_PATH = options.apiKeyPath
  if (options.channel) set.DESKTOP_RELEASE_CHANNEL = options.channel
  if (options.notes) set.DESKTOP_RELEASE_NOTES = options.notes
  if (options.dryRun) set.DESKTOP_RELEASE_DRY_RUN = '1'
  if (options.allowDirty) set.DESKTOP_RELEASE_ALLOW_DIRTY = '1'
  // The installers a release publishes are made by the build.
  if (!env.DESKTOP_PACKAGE) set.DESKTOP_PACKAGE = '1'
  return set
}

/**
 * What a `macos` app's release adds to that environment: the build is the
 * Developer ID one (`build/desktop-macos.ts` reads `DESKTOP_DISTRIBUTION`),
 * and `--package-only` stops the release before notarizing and publishing.
 */
export function releaseMacosEnvironment(options: Pick<ReleaseDesktopOptions, 'packageOnly'>): Record<string, string> {
  return { DESKTOP_DISTRIBUTION: 'developer-id', ...(options.packageOnly ? { DESKTOP_RELEASE_PACKAGE_ONLY: '1' } : {}) }
}

/**
 * Which of a project's desktop apps `release:desktop` releases, or why it
 * cannot. With both declared it is the web view app unless `--native` asks
 * for the AppKit one, the rule `build:desktop` and `dev:desktop` already
 * follow, so the three commands always mean the same app.
 */
export function releaseDesktopKind(declared: { webview: boolean, macos: boolean }, options: Pick<ReleaseDesktopOptions, 'native' | 'packageOnly' | 'dryRun'> = {}): { kind: 'webview' | 'macos' } | { error: string } {
  if (options.native && !declared.macos) return { error: 'config/desktop.ts has no macos section, so there is no AppKit app for --native to release.' }
  const kind = options.native || !declared.webview ? (declared.macos ? 'macos' : undefined) : 'webview'
  if (!kind) return { error: 'config/desktop.ts has no webview or macos section. `release:desktop` releases a desktop app people download; a Mac App Store app is `desktop:apple:publish`.' }
  if (options.packageOnly && options.dryRun) return { error: '--package-only publishes nothing, so there is nothing for --dry-run to hold back. Pass one of them.' }
  if (options.packageOnly && kind === 'webview')
    return { error: declared.macos ? '--package-only packages the AppKit app (`macos`). Add --native: this config also declares a web view app, which `release:desktop` takes first.' : '--package-only packages an AppKit app (`macos`) for Pantry. A web view app is packaged by `buddy build:desktop --package`.' }
  return { kind }
}

/**
 * Tell Pantry's native app pipeline what was built, in
 * `.pantry/native/artifact.json`, the way a standalone native project's build
 * does (native-project.ts): the disk image it notarizes and releases, the
 * Developer ID app it launches, assesses and publishes to the Pantry
 * registry, and the identity it checks the bundle against.
 */
export async function recordMacosPantryArtifact(root: string, pkgVersion: string | undefined): Promise<string> {
  const { loadMacosDesktop, macosOutputDirectory, macosPantryArtifact, readMacosBuildRecord } = await import('@stacksjs/desktop-build')
  const { recordNativeArtifact } = await import('ts-pantry/native')
  const config = await loadMacosDesktop(root, pkgVersion)
  if (!config) throw new Error('config/desktop.ts has no macos section.')
  const output = macosOutputDirectory(root, config)
  const build = readMacosBuildRecord(output, config.appName)
  if (!build) throw new Error(`There is no build record for ${config.appName} in ${output}.`)
  const artifact = macosPantryArtifact(config, { output, architecture: build.architecture })
  recordNativeArtifact(root, artifact)
  return artifact.path
}

/**
 * Why Pantry would refuse what `--package-only` is about to build, or
 * nothing: its pipeline releases the version in package.json, as a semantic
 * version, and checks the built app says the same.
 */
export function packageOnlyVersionProblem(configVersion: string, pkgVersion: string | undefined): string | undefined {
  if (!pkgVersion || !/^\d+\.\d+\.\d+$/.test(pkgVersion)) return `Pantry releases the version in package.json, which has to be major.minor.patch for a Mac app (got ${JSON.stringify(pkgVersion ?? null)}).`
  if (configVersion !== pkgVersion) return `macos.version is ${configVersion} but package.json says ${pkgVersion}. Pantry releases the package.json version: drop macos.version, or keep the two the same.`
  return undefined
}

export function desktopRelease(buddy: CLI): void {
  buddy
    .command('desktop:update:keypair', 'Generate the Ed25519 keypair that signs a desktop app\'s update manifests')
    .option('--key-id <id>', 'The name the app knows the key by', { default: 'main' })
    .option('--json', 'Print the keypair as JSON', { default: false })
    .example('buddy desktop:update:keypair')
    .example('buddy desktop:update:keypair --key-id release-2026')
    .action(async (options: { keyId: string, json: boolean }) => {
      try {
        const { generateUpdateKeypair } = await import('@stacksjs/desktop-build')
        const pair = generateUpdateKeypair(options.keyId)
        if (options.json) {
          process.stdout.write(`${JSON.stringify(pair, null, 2)}\n`)
          return
        }
        // Printed, never written: where the private half is kept is the releaser's decision, and a file in the project is the wrong one.
        process.stdout.write([
          'Public key. Add it to config/desktop.ts, where every build of the app carries it:',
          '',
          `  updates: { publicKeys: { ${JSON.stringify(pair.keyId)}: ${JSON.stringify(pair.publicKey)} } }`,
          '',
          'under `macos` for an AppKit app, or `webview` for a web view app.',
          '',
          'Private key. It signs every update, so keep it out of the repository (a password manager, a CI secret):',
          '',
          `  DESKTOP_UPDATE_PRIVATE_KEY=${pair.privateKey}`,
          '',
          'It is shown once. Anyone who holds it can publish an update the app will accept, and an app built with',
          'this public key takes updates from no other key: a lost private key means shipping a new build by hand.',
          '',
        ].join('\n'))
      }
      catch (error) {
        // Synchronous: an awaited logger loses the message to process.exit.
        process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
        process.exit(1)
      }
    })

  buddy
    .command('release:desktop', 'Build, sign and notarize the desktop app (web view, or AppKit `macos`), and publish it with signed update manifests')
    .option('--target <targets>', 'Web view app: comma-separated targets (darwin-arm64, linux-x64, win32-x64, ...) or all. Default: this machine')
    .option('--native', 'Release the AppKit app (`macos`) when the config also declares a web view app', { default: false })
    .option('--identity <identity>', 'macOS: Developer ID Application certificate (or DESKTOP_SIGNING_IDENTITY). A web view bundle built with another identity is signed again with it')
    .option('--notary-profile <profile>', 'macOS: notarytool keychain profile (or DESKTOP_NOTARY_PROFILE)')
    .option('--notarize', 'macOS: notarize with an App Store Connect API key instead of a keychain profile (or DESKTOP_NOTARIZE). An AppKit release uses the key whenever no profile is given', { default: false })
    .option('--api-key-id <id>', 'macOS: App Store Connect API key ID (or APP_STORE_CONNECT_API_KEY_ID)')
    .option('--api-issuer-id <id>', 'macOS: App Store Connect API issuer ID (or APP_STORE_CONNECT_API_ISSUER_ID)')
    .option('--api-key-path <path>', 'macOS: the AuthKey_*.p8 file (or APP_STORE_CONNECT_API_KEY_PATH, or its PEM in APP_STORE_CONNECT_API_KEY)')
    .option('--channel <channel>', 'Release channel (default: the app\'s updates.channel, else stable)')
    .option('--notes <file>', 'Release notes, shown by the app before it updates')
    .option('--skip-build', 'Release what was already built: `buddy build:desktop` targets (including `--import`ed ones), or the Developer ID AppKit app of an earlier run', { default: false })
    .option('--package-only', 'AppKit app: stop at the Developer ID app and a signed DMG, and record them in .pantry/native/artifact.json. Nothing is notarized or published: the build step of Pantry\'s native app pipeline', { default: false })
    .option('--dry-run', 'Do everything except notarize and upload; write the signed manifests locally', { default: false })
    .option('--allow-dirty', 'Release from a working tree with uncommitted changes', { default: false })
    .option('--verbose', 'Enable verbose output', { default: false })
    .example('buddy release:desktop --identity "Developer ID Application: Example (ABCDE12345)" --notary-profile example')
    .example('buddy release:desktop --api-key-id ABC123DEFG --api-issuer-id 00000000-0000-0000-0000-000000000000 --api-key-path ./AuthKey_ABC123DEFG.p8')
    .example('buddy release:desktop --target linux-x64 --skip-build')
    .example('buddy release:desktop --package-only')
    .action(async (options: ReleaseDesktopOptions) => {
      const perf = await intro('buddy release:desktop')
      const { hasMacosDesktop, hasWebviewDesktop } = await import('@stacksjs/desktop-build')
      const root = projectPath()
      const chosen = releaseDesktopKind({ webview: await hasWebviewDesktop(root), macos: await hasMacosDesktop(root) }, options)
      if ('error' in chosen) {
        await log.error(chosen.error)
        process.exit(ExitCode.FatalError)
      }
      const macos = chosen.kind === 'macos'
      Object.assign(process.env, releaseDesktopEnvironment(options), macos ? releaseMacosEnvironment(options) : {})

      let pkgVersion: string | undefined
      if (macos) {
        const { existsSync, readFileSync } = await import('node:fs')
        const { join } = await import('node:path')
        pkgVersion = existsSync(join(root, 'package.json')) ? (JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { version?: string }).version : undefined
        if (options.target) await log.warn('--target is ignored: an AppKit app is built for this Mac\'s architecture.')
        if (options.packageOnly) {
          const { loadMacosDesktop } = await import('@stacksjs/desktop-build')
          const problem = packageOnlyVersionProblem((await loadMacosDesktop(root, pkgVersion))!.version, pkgVersion)
          if (problem) {
            await log.error(problem)
            process.exit(ExitCode.FatalError)
          }
        }
      }

      const build = macos ? Action.BuildDesktopMacos : Action.BuildDesktopWebview
      const release = macos ? Action.ReleaseDesktopMacos : Action.ReleaseDesktop
      for (const action of options.skipBuild ? [release] : [build, release]) {
        const result = await runAction(action, options)
        if (resultFailed(result)) {
          await outro('While running the release:desktop command, there was an issue', { startTime: perf, useSeconds: true }, result.error)
          process.exit(ExitCode.FatalError)
        }
      }

      // Pantry's native app pipeline reads what was built from here. A project
      // that uses it (pantry.json has `native`) gets the record after every
      // real release too, so the released app is the one Pantry can publish.
      if (macos && !options.dryRun) {
        const { readNativeAppConfig } = await import('ts-pantry/native')
        if (options.packageOnly) {
          await log.success(`Recorded ${await recordMacosPantryArtifact(root, pkgVersion)} in .pantry/native/artifact.json`)
        }
        else {
          try {
            if (readNativeAppConfig(root)) await recordMacosPantryArtifact(root, pkgVersion)
          }
          catch (error) {
            // The release is published; only the note for Pantry could not be written.
            await log.warn(`.pantry/native/artifact.json was not written: ${error instanceof Error ? error.message : String(error)}`)
          }
        }
      }
      await outro('Exited', { startTime: perf, useSeconds: true })
      process.exit(ExitCode.Success)
    })
}
