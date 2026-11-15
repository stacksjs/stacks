import { cpSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import process from 'node:process'
import type { NotaryCredentials } from '@stacksjs/desktop-build'
import { log, runCommand } from '@stacksjs/cli'
import { notarizationOutcome, notarytoolAuthArgs } from '@stacksjs/desktop-build'
import { runBuildStep } from './run-build-step'

/**
 * The steps every direct-distribution Mac build ends with, shared by
 * `build/dmg.ts` (the Craft web-view app) and `build/dmg-macos.ts` (a
 * `config/desktop.ts` `macos` app): submit to Apple's notary service and
 * staple, and image a folder into a signed DMG.
 */

/**
 * notarytool's arguments for `credentials`. A key held as PEM text (an
 * encrypted `.env.production` value) goes to a private file for this run:
 * notarytool reads keys from disk only.
 */
export function notaryArguments(credentials: NotaryCredentials): string[] {
  if (!('keyPem' in credentials)) return notarytoolAuthArgs(credentials)
  const directory = mkdtempSync(join(tmpdir(), 'stacks-notary-key-'))
  const keyPath = join(directory, `AuthKey_${credentials.keyId}.p8`)
  writeFileSync(keyPath, `${credentials.keyPem}\n`, { mode: 0o600 })
  process.on('exit', () => rmSync(directory, { recursive: true, force: true }))
  return notarytoolAuthArgs({ keyId: credentials.keyId, issuerId: credentials.issuerId, keyPath })
}

/**
 * Submit `target` to Apple's notary service, wait, and staple the ticket to it.
 * A stapled ticket lets Gatekeeper accept the file offline; an app is
 * notarized on its own as well as in its DMG, because once someone drags it
 * out of the image only the app's own ticket travels with it.
 *
 * notarytool takes a zip, dmg or pkg, not a bare `.app`, so an app is zipped
 * into `scratch` first.
 */
export async function notarizeAndStaple(target: string, what: string, auth: string[], scratch: string): Promise<void> {
  const upload = target.endsWith('.app') ? join(scratch, `${basename(target)}.zip`) : target
  if (upload !== target)
    await runBuildStep(['ditto', '-c', '-k', '--keepParent', target, upload], { cwd: scratch, describe: `Zipping ${basename(target)} for notarization` })
  log.info(`Notarizing ${what} (Apple usually answers within a few minutes)...`)
  const submitted = Bun.spawnSync(['xcrun', 'notarytool', 'submit', upload, ...auth, '--wait'], { stderr: 'pipe' })
  const report = `${submitted.stdout.toString()}${submitted.stderr.toString()}`
  const outcome = notarizationOutcome(report, submitted.exitCode)
  if (!outcome.accepted) {
    console.error(report.trim())
    throw new Error(`Notarization of ${what} ${outcome.status ?? 'failed'}${outcome.id ? ` - see \`xcrun notarytool log ${outcome.id} ${auth.join(' ')}\`` : ''}`)
  }
  await runBuildStep(['xcrun', 'stapler', 'staple', target], { cwd: dirname(target), describe: `Stapling the notarization ticket to ${what}` })
}

/**
 * Image `staging` (which must hold only the `.app`) into `dmgPath`, with the
 * `/Applications` link every macOS DMG is expected to have, and sign the image:
 * Gatekeeper checks the DMG a person opens before it ever looks at the app.
 */
export async function imageDmg(options: { staging: string, volumeName: string, dmgPath: string, signingIdentity?: string }): Promise<void> {
  symlinkSync('/Applications', join(options.staging, 'Applications'))
  const created = await runCommand([
    'hdiutil', 'create',
    '-volname', options.volumeName,
    '-srcfolder', options.staging,
    '-ov', '-format', 'UDZO',
    options.dmgPath,
  ], { cwd: options.staging })
  if (created.isErr)
    throw new Error(`hdiutil failed to create ${options.dmgPath}`)

  if (options.signingIdentity) {
    await runBuildStep(['codesign', '--force', '--timestamp', '--sign', options.signingIdentity, options.dmgPath], {
      cwd: dirname(options.dmgPath),
      describe: 'Signing the DMG',
    })
  }
}

/** Whether a notarization ticket is already stapled to `target` (an `.app` or a DMG). */
export function hasStapledTicket(target: string): boolean {
  return Bun.spawnSync(['xcrun', 'stapler', 'validate', target], { stdout: 'ignore', stderr: 'ignore' }).exitCode === 0
}

function runReleaseCommand(command: string[]): void {
  console.log(`> ${command.join(' ')}`)
  const result = Bun.spawnSync(command, { stdout: 'inherit', stderr: 'inherit' })
  if (result.exitCode !== 0) throw new Error(`${command[0]} exited with ${result.exitCode}`)
}

export interface PackageMacReleaseOptions {
  /** The signed `.app`. It is stapled in place. */
  app: string
  appName: string
  /** Where the update archive goes: what an installed app downloads. Left out, none is made. */
  updateZip?: string
  /** Where the disk image goes: what a person downloads. */
  dmg: string
  /** Signs the disk image. Without it the image is unsigned, which only a dry run wants. */
  signingIdentity?: string
  /** notarytool's sign-in (`notaryArguments`). Without it nothing is notarized. */
  auth?: string[]
  scratch: string
}

/**
 * What a direct-distribution Mac release is made of, from a Developer ID
 * signed `.app`, shared by a web view app's release and a native macOS one's:
 * the app notarized and stapled, zipped for the updater, and imaged into a
 * signed, notarized DMG, each checked as the file that gets uploaded.
 *
 * The order matters: the zip is made after the app is stapled, so the ticket
 * travels inside the update and Gatekeeper accepts the new bundle offline.
 * `ditto` keeps the signature and the ticket; `zip` does not. An app that
 * already carries a ticket (one Pantry's native pipeline stapled, released
 * here with `--skip-build`) is not sent to Apple a second time.
 */
export async function packageMacRelease(options: PackageMacReleaseOptions): Promise<void> {
  const { app, appName, auth, scratch } = options
  if (auth) {
    if (hasStapledTicket(app)) log.info(`${appName}.app already carries its notarization ticket`)
    else await notarizeAndStaple(app, `${appName}.app`, auth, scratch)
  }
  if (options.updateZip) runReleaseCommand(['ditto', '-c', '-k', '--keepParent', app, options.updateZip])
  const staging = join(scratch, 'dmg')
  mkdirSync(staging, { recursive: true })
  cpSync(app, join(staging, `${appName}.app`), { recursive: true, verbatimSymlinks: true })
  await imageDmg({ staging, volumeName: appName, dmgPath: options.dmg, ...(options.signingIdentity ? { signingIdentity: options.signingIdentity } : {}) })
  if (auth) {
    await notarizeAndStaple(options.dmg, 'the DMG', auth, scratch)
    // Checked against the file that gets uploaded, not only the build output.
    runReleaseCommand(['codesign', '--verify', '--deep', '--strict', app])
    runReleaseCommand(['spctl', '-a', '-t', 'open', '--context', 'context:primary-signature', options.dmg])
    runReleaseCommand(['xcrun', 'stapler', 'validate', options.dmg])
  }
}
