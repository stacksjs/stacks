import type { DesktopFetcher, DesktopUpdateManifest, DesktopUpdateTarget } from './updater'
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, renameSync, rmSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import process from 'node:process'
import { updateFeedUrl } from './update-feed'
import { checkForDesktopUpdate, stageDesktopUpdate } from './updater'

/**
 * The client half of desktop updates after the download: install what was
 * staged and start the new version.
 *
 * How depends on how the app was installed. A macOS bundle is swapped for the
 * new one after a signature check against the running app. A Windows install
 * runs the new MSI. A Linux AppImage is replaced in place. A deb or rpm
 * install is the package manager's to update, so the app only says a new
 * version exists. A run from source has nothing to replace.
 */

export type DesktopInstallKind = 'macos-bundle' | 'windows-msi' | 'linux-appimage' | 'linux-package' | 'unmanaged'

export interface DesktopInstallation {
  kind: DesktopInstallKind
  /** What gets replaced: the `.app`, the AppImage file. Unset where an installer does the replacing. */
  path?: string
  /** What to start afterwards. */
  executable: string
}

/** How this copy of the app was installed, from where its executable is and what started it. */
export function detectInstallation(options: { platform?: string, execPath?: string, env?: Record<string, string | undefined> } = {}): DesktopInstallation {
  const platform = options.platform ?? process.platform
  const execPath = options.execPath ?? process.execPath
  const env = options.env ?? process.env
  const name = basename(execPath).toLowerCase()
  // `bun app.ts`: a run from source, with nothing installed to replace.
  if (name === 'bun' || name === 'bun.exe') return { kind: 'unmanaged', executable: execPath }
  if (platform === 'darwin') {
    const bundle = execPath.match(/^(.*\.app)\/Contents\/MacOS\/[^/]+$/)
    return bundle ? { kind: 'macos-bundle', path: bundle[1]!, executable: execPath } : { kind: 'unmanaged', executable: execPath }
  }
  if (platform === 'win32') return { kind: 'windows-msi', executable: execPath }
  // The AppImage runtime names the image it mounted; the executable itself is inside the mount.
  if (env.APPIMAGE) return { kind: 'linux-appimage', path: env.APPIMAGE, executable: env.APPIMAGE }
  return execPath.startsWith('/usr/') || execPath.startsWith('/opt/') ? { kind: 'linux-package', executable: execPath } : { kind: 'unmanaged', executable: execPath }
}

export interface UpdateCommandResult {
  exitCode: number
  stdout: string
  stderr: string
}
export type RunUpdateCommand = (command: string[]) => UpdateCommandResult

const runCommand: RunUpdateCommand = (command) => {
  const result = Bun.spawnSync(command, { stdout: 'pipe', stderr: 'pipe' })
  return { exitCode: result.exitCode ?? 1, stdout: result.stdout.toString(), stderr: result.stderr.toString() }
}

export type SpawnDetached = (command: string[]) => void

const spawnDetached: SpawnDetached = (command) => {
  Bun.spawn(command, { stdio: ['ignore', 'ignore', 'ignore'], detached: true }).unref()
}

/** Who signed a macOS bundle: its Developer ID team, or nothing for an ad hoc or unsigned one. */
export function macosSigner(bundle: string, run: RunUpdateCommand = runCommand): { teamId?: string, identifier?: string } {
  // codesign prints its description on stderr.
  const described = run(['codesign', '-dv', '--verbose=4', bundle])
  const text = `${described.stdout}\n${described.stderr}`
  const teamId = text.match(/^TeamIdentifier=(.+)$/m)?.[1]?.trim()
  const identifier = text.match(/^Identifier=(.+)$/m)?.[1]?.trim()
  return { ...(teamId && teamId !== 'not set' ? { teamId } : {}), ...(identifier ? { identifier } : {}) }
}

/**
 * Whether a new bundle may replace the running one. Its signature has to be
 * intact, and it has to come from the same Developer ID team and carry the
 * same identifier as the app being replaced. An update manifest signed with a
 * stolen key still cannot install someone else's app over this one.
 *
 * A running app with no team (an ad hoc development build) has no signer to
 * compare with, so it is only replaced when `allowUnsigned` says so.
 */
export function assertMacosBundleTrusted(current: string, next: string, options: { run?: RunUpdateCommand, allowUnsigned?: boolean } = {}): void {
  const run = options.run ?? runCommand
  const verified = run(['codesign', '--verify', '--deep', '--strict', next])
  const running = macosSigner(current, run)
  const incoming = macosSigner(next, run)
  if (!running.teamId) {
    if (!options.allowUnsigned) throw new Error('The running app is not signed with a Developer ID, so an update cannot be checked against it.')
    return
  }
  if (verified.exitCode !== 0) throw new Error(`The update's signature is not valid: ${(verified.stderr || verified.stdout).trim()}`)
  if (incoming.teamId !== running.teamId) throw new Error(`The update is signed by ${incoming.teamId ?? 'no one'}, not by this app's team ${running.teamId}.`)
  if (incoming.identifier !== running.identifier) throw new Error(`The update is a different app (${incoming.identifier ?? 'unknown'}), not ${running.identifier}.`)
}

/** Unpack a zipped `.app`, keeping its signature, extended attributes and symlinks. */
export type ExtractBundle = (archive: string, into: string) => void

const dittoExtract: ExtractBundle = (archive, into) => {
  const result = runCommand(['ditto', '-x', '-k', archive, into])
  if (result.exitCode !== 0) throw new Error(`Unpacking the update failed: ${result.stderr.trim()}`)
}

/**
 * Replace a macOS bundle with the one in a staged archive. The old bundle is
 * moved aside first and put back if the new one cannot take its place, so a
 * failure at any step leaves a working app where it was.
 */
export function swapMacosBundle(options: { archive: string, bundle: string, extract?: ExtractBundle, run?: RunUpdateCommand, allowUnsigned?: boolean }): void {
  const { bundle } = options
  // Beside the bundle, so the final rename stays on one volume and is atomic.
  const scratch = mkdtempSync(join(dirname(bundle), '.update-'))
  const aside = `${bundle}.previous-${process.pid}`
  try {
    ;(options.extract ?? dittoExtract)(options.archive, scratch)
    const unpacked = readdirSync(scratch).filter(entry => entry.endsWith('.app'))
    if (unpacked.length !== 1) throw new Error(`The update archive holds ${unpacked.length} apps; it has to hold exactly one.`)
    const next = join(scratch, unpacked[0]!)
    assertMacosBundleTrusted(bundle, next, { run: options.run, allowUnsigned: options.allowUnsigned })
    renameSync(bundle, aside)
    try {
      renameSync(next, bundle)
    }
    catch (error) {
      renameSync(aside, bundle)
      throw error
    }
    rmSync(aside, { recursive: true, force: true })
  }
  finally {
    rmSync(scratch, { recursive: true, force: true })
  }
}

/** Replace an AppImage with a staged one, by a rename beside it so no half-written image is ever at its path. */
export function replaceAppImage(staged: string, appImage: string): void {
  const incoming = `${appImage}.update-${process.pid}`
  try {
    // The staged file may be on another filesystem (the data directory), where a rename would fail.
    copyFileSync(staged, incoming)
    chmodSync(incoming, 0o755)
    renameSync(incoming, appImage)
  }
  catch (error) {
    rmSync(incoming, { force: true })
    throw error
  }
}

/** Who signed a Windows file, by Authenticode: the signer's subject when the signature is valid. */
export function windowsSigner(file: string, run: RunUpdateCommand = runCommand): { valid: boolean, subject?: string } {
  const script = `$s = Get-AuthenticodeSignature -LiteralPath '${file.replace(/'/g, '\'\'')}'; Write-Output $s.Status; if ($s.SignerCertificate) { Write-Output $s.SignerCertificate.Subject }`
  const result = run(['powershell.exe', '-NoProfile', '-NonInteractive', '-Command', script])
  const [status, subject] = result.stdout.split(/\r?\n/).map(line => line.trim()).filter(Boolean)
  return { valid: result.exitCode === 0 && status === 'Valid', ...(subject ? { subject } : {}) }
}

/**
 * Whether a staged MSI may be run: when the running executable is
 * Authenticode-signed, the installer has to be validly signed by the same
 * publisher. An unsigned app has no publisher to compare with and relies on
 * the manifest's signature and checksum alone, unless `allowUnsigned` is false.
 */
export function assertWindowsInstallerTrusted(executable: string, installer: string, options: { run?: RunUpdateCommand, allowUnsigned?: boolean } = {}): void {
  const running = windowsSigner(executable, options.run)
  if (!running.valid) {
    if (options.allowUnsigned === false) throw new Error('The running app is not Authenticode-signed, so an update cannot be checked against it.')
    return
  }
  const incoming = windowsSigner(installer, options.run)
  if (!incoming.valid) throw new Error('The update installer is not validly signed.')
  if (incoming.subject !== running.subject) throw new Error(`The update is signed by ${incoming.subject ?? 'no one'}, not by this app's publisher ${running.subject}.`)
}

export interface InstallDesktopUpdateOptions {
  /** The staged download (`stageDesktopUpdate`), already checked against its signed manifest. */
  staged: string
  manifest: Pick<DesktopUpdateManifest, 'version' | 'url'>
  appName?: string
  installation?: DesktopInstallation
  /** Replace an app that has no signer to compare with. Default `false` on macOS, `true` on Windows. */
  allowUnsigned?: boolean
  run?: RunUpdateCommand
  extract?: ExtractBundle
  spawn?: SpawnDetached
  pid?: number
}

export type InstallDesktopUpdateResult =
  /** The new version is in place; `relaunch()` starts it, and the caller then exits. */
  | { status: 'installed', relaunch: () => void }
  /** An installer was started and will replace the app once this process exits; it starts the new version itself. */
  | { status: 'installing' }
  /** Nothing was installed: the app says this instead. */
  | { status: 'notice', message: string }

/** Install a staged update for the way this copy of the app was installed. */
export function installDesktopUpdate(options: InstallDesktopUpdateOptions): InstallDesktopUpdateResult {
  const installation = options.installation ?? detectInstallation()
  const spawn = options.spawn ?? spawnDetached
  const pid = options.pid ?? process.pid
  const name = options.appName ?? 'The app'
  switch (installation.kind) {
    case 'macos-bundle': {
      swapMacosBundle({ archive: options.staged, bundle: installation.path!, extract: options.extract, run: options.run, allowUnsigned: options.allowUnsigned })
      // LaunchServices starts the new bundle; `--wait-pid` makes it wait for this process to let go of the lock.
      return { status: 'installed', relaunch: () => spawn(['open', '-n', installation.path!, '--args', `--wait-pid=${pid}`]) }
    }
    case 'linux-appimage': {
      replaceAppImage(options.staged, installation.path!)
      return { status: 'installed', relaunch: () => spawn([installation.path!, `--wait-pid=${pid}`]) }
    }
    case 'windows-msi': {
      assertWindowsInstallerTrusted(installation.executable, options.staged, { run: options.run, allowUnsigned: options.allowUnsigned })
      // msiexec replaces files this process holds open only once it has exited, so the chain runs detached:
      // install, then start the new version. `/passive` shows progress and asks nothing.
      spawn(['cmd.exe', '/d', '/s', '/c', `msiexec /i "${options.staged}" /passive /norestart && start "" "${installation.executable}" --wait-pid=${pid}`])
      return { status: 'installing' }
    }
    case 'linux-package':
      return { status: 'notice', message: `${name} ${options.manifest.version} is available. This copy was installed as a system package: update it with your package manager, or download the new package from ${new URL(options.manifest.url).origin}.` }
    default:
      return { status: 'notice', message: `${name} ${options.manifest.version} is available, but this copy was not installed in a way that can update itself.` }
  }
}

/**
 * An app's say before an update is installed, called with the manifest that
 * was verified. Return nothing to allow it; `{ refuse }` to stop it; `{ warn }`
 * to make the person confirm first (a license whose updates ended before this
 * version: it would run, but as the free tier).
 */
export type BeforeDesktopUpdate = (manifest: DesktopUpdateManifest, current: { version: string }) => void | undefined | { refuse: string } | { warn: string } | Promise<void | undefined | { refuse: string } | { warn: string }>

export interface DesktopUpdateStatus {
  currentVersion: string
  state: 'idle' | 'checking' | 'current' | 'available' | 'refused' | 'installed' | 'installing' | 'error'
  installKind: DesktopInstallKind
  /** Whether this copy can install an update itself, or can only say one exists. */
  selfUpdating: boolean
  version?: string
  notes?: string
  publishedAt?: string
  /** Set with `available`: installing needs `acknowledge: true`. */
  warning?: string
  /** Set with `refused`, and with a `notice` outcome. */
  message?: string
  error?: string
}

export interface DesktopUpdaterOptions {
  currentVersion: string
  feedUrl: string
  trustedKeys: Record<string, string>
  updatesDir: string
  appName?: string
  channel?: string
  beforeUpdate?: BeforeDesktopUpdate
  target?: DesktopUpdateTarget
  fetcher?: DesktopFetcher
  installation?: DesktopInstallation
  install?: (options: InstallDesktopUpdateOptions) => InstallDesktopUpdateResult
  allowUnsigned?: boolean
}

export interface DesktopUpdater {
  status: () => DesktopUpdateStatus
  /** Ask the feed. Never throws: a failure is the `error` state. */
  check: () => Promise<DesktopUpdateStatus>
  /** Download, verify and install what `check` found. A warned update needs `acknowledge`. */
  install: (options?: { acknowledge?: boolean }) => Promise<DesktopUpdateStatus>
  /** Start the new version, when one was installed. Called as the app exits. */
  relaunchIfInstalled: () => Promise<void>
}

const ARTIFACT_NAMES: Record<string, string> = { darwin: 'update.zip', win32: 'update.msi', linux: 'update.AppImage' }

/** The update flow as one object an agent holds: check, the app's say, stage, install, relaunch. */
export function createDesktopUpdater(options: DesktopUpdaterOptions): DesktopUpdater {
  const installation = options.installation ?? detectInstallation()
  const target = options.target ?? { platform: process.platform, architecture: process.arch }
  const selfUpdating = ['macos-bundle', 'windows-msi', 'linux-appimage'].includes(installation.kind)
  let state: DesktopUpdateStatus['state'] = 'idle'
  let manifest: DesktopUpdateManifest | null = null
  let warning: string | undefined
  let message: string | undefined
  let error: string | undefined
  let relaunch: (() => void) | undefined
  let busy: Promise<DesktopUpdateStatus> | undefined

  const status = (): DesktopUpdateStatus => ({
    currentVersion: options.currentVersion,
    state,
    installKind: installation.kind,
    selfUpdating,
    ...(manifest ? { version: manifest.version, ...(manifest.notes ? { notes: manifest.notes } : {}), ...(manifest.publishedAt ? { publishedAt: manifest.publishedAt } : {}) } : {}),
    ...(warning ? { warning } : {}),
    ...(message ? { message } : {}),
    ...(error ? { error } : {}),
  })

  const once = (work: () => Promise<void>): Promise<DesktopUpdateStatus> => {
    busy ??= work().catch((failure) => {
      state = 'error'
      error = failure instanceof Error ? failure.message : String(failure)
    }).then(() => {
      busy = undefined
      return status()
    })
    return busy
  }

  return {
    status,
    check: () => once(async () => {
      // An update already in place is not looked for again; the next launch runs it.
      if (state === 'installed' || state === 'installing') return
      state = 'checking'
      error = warning = message = undefined
      manifest = await checkForDesktopUpdate({
        currentVersion: options.currentVersion,
        manifestUrl: updateFeedUrl(options.feedUrl, target, { channel: options.channel, currentVersion: options.currentVersion }),
        trustedKeys: options.trustedKeys,
        fetcher: options.fetcher,
        target,
      })
      if (!manifest) {
        state = 'current'
        return
      }
      const verdict = await options.beforeUpdate?.(manifest, { version: options.currentVersion })
      if (verdict && 'refuse' in verdict) {
        state = 'refused'
        message = verdict.refuse
        return
      }
      if (verdict && 'warn' in verdict) warning = verdict.warn
      state = 'available'
    }),
    install: (install = {}) => once(async () => {
      if (state !== 'available' || !manifest) throw new Error('There is no update to install. Check first.')
      if (warning && !install.acknowledge) throw new Error(warning)
      if (!selfUpdating) {
        const outcome = (options.install ?? installDesktopUpdate)({ staged: '', manifest, appName: options.appName, installation })
        message = outcome.status === 'notice' ? outcome.message : undefined
        return
      }
      const directory = join(options.updatesDir, manifest.version)
      mkdirSync(directory, { recursive: true })
      const staged = await stageDesktopUpdate(manifest, join(directory, ARTIFACT_NAMES[target.platform] ?? 'update.bin'), options.fetcher, options.trustedKeys, target)
      const outcome = (options.install ?? installDesktopUpdate)({ staged: staged.path, manifest, appName: options.appName, installation, allowUnsigned: options.allowUnsigned })
      if (outcome.status === 'notice') {
        message = outcome.message
        return
      }
      state = outcome.status
      if (outcome.status === 'installed') {
        relaunch = outcome.relaunch
        // The new version is in place; what was downloaded has done its job.
        rmSync(directory, { recursive: true, force: true })
      }
    }),
    async relaunchIfInstalled() {
      relaunch?.()
      relaunch = undefined
    },
  }
}

export const UPDATE_PATH = '/__desktop/update'

/**
 * The window's view of the updater, at `/__desktop/update`: `GET` is the
 * status, `POST { action: 'check' }` asks the feed, and `POST { action:
 * 'install', acknowledge? }` installs. Behind the session cookie like every
 * other agent path, so only the app's own page can start an install.
 */
export function updateRequestHandler(updater: DesktopUpdater): (request: Request) => Promise<Response | undefined> {
  const json = (body: unknown, status = 200): Response => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } })
  return async (request) => {
    if (new URL(request.url).pathname !== UPDATE_PATH) return undefined
    if (request.method === 'GET') return json(updater.status())
    if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
    const body = await request.json().catch(() => null) as { action?: string, acknowledge?: boolean } | null
    if (body?.action === 'check') return json(await updater.check())
    if (body?.action === 'install') return json(await updater.install({ acknowledge: body.acknowledge === true }))
    return json({ error: 'Send { action: "check" } or { action: "install" }.' }, 400)
  }
}

/** Whether a path exists and is a macOS bundle with an executable inside: what a fixture or a build check asks. */
export function isMacosBundle(path: string): boolean {
  return path.endsWith('.app') && existsSync(join(path, 'Contents', 'MacOS'))
}
