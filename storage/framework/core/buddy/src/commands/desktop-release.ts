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
  if (options.channel) set.DESKTOP_RELEASE_CHANNEL = options.channel
  if (options.notes) set.DESKTOP_RELEASE_NOTES = options.notes
  if (options.dryRun) set.DESKTOP_RELEASE_DRY_RUN = '1'
  if (options.allowDirty) set.DESKTOP_RELEASE_ALLOW_DIRTY = '1'
  // The installers a release publishes are made by the build.
  if (!env.DESKTOP_PACKAGE) set.DESKTOP_PACKAGE = '1'
  return set
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
          `  webview: { updates: { publicKeys: { ${JSON.stringify(pair.keyId)}: ${JSON.stringify(pair.publicKey)} } } }`,
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
    .command('release:desktop', 'Build, sign and notarize the web view desktop app, and publish it with signed update manifests')
    .option('--target <targets>', 'Comma-separated targets (darwin-arm64, linux-x64, win32-x64, ...) or all. Default: this machine')
    .option('--identity <identity>', 'macOS: Developer ID Application certificate (or DESKTOP_SIGNING_IDENTITY)')
    .option('--notary-profile <profile>', 'macOS: notarytool keychain profile (or DESKTOP_NOTARY_PROFILE)')
    .option('--channel <channel>', 'Release channel (default: webview.updates.channel, else stable)')
    .option('--notes <file>', 'Release notes, shown by the app before it updates')
    .option('--skip-build', 'Release what `buddy build:desktop` already made (installers built on another machine)', { default: false })
    .option('--dry-run', 'Do everything except notarize and upload; write the signed manifests locally', { default: false })
    .option('--allow-dirty', 'Release from a working tree with uncommitted changes', { default: false })
    .option('--verbose', 'Enable verbose output', { default: false })
    .example('buddy release:desktop --identity "Developer ID Application: Example (ABCDE12345)" --notary-profile example')
    .example('buddy release:desktop --target linux-x64 --skip-build')
    .action(async (options: ReleaseDesktopOptions) => {
      const perf = await intro('buddy release:desktop')
      const { hasWebviewDesktop } = await import('@stacksjs/desktop-build')
      if (!(await hasWebviewDesktop(projectPath()))) {
        log.error('config/desktop.ts has no webview section. `release:desktop` releases a web view desktop app; a Mac App Store app is `desktop:apple:publish`.')
        process.exit(ExitCode.FatalError)
      }
      Object.assign(process.env, releaseDesktopEnvironment(options))

      for (const action of options.skipBuild ? [Action.ReleaseDesktop] : [Action.BuildDesktopWebview, Action.ReleaseDesktop]) {
        const result = await runAction(action, options)
        if (resultFailed(result)) {
          await outro('While running the release:desktop command, there was an issue', { startTime: perf, useSeconds: true }, result.error)
          process.exit(ExitCode.FatalError)
        }
      }
      await outro('Exited', { startTime: perf, useSeconds: true })
      process.exit(ExitCode.Success)
    })
}
