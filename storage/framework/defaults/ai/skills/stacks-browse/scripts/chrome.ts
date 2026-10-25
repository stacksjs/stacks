// Shared Chrome executable preparation for the standalone skill and testing package.
import { existsSync, mkdirSync, mkdtempSync, readdirSync, renameSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import process from 'node:process'

const MAC_CHROMES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
]
const PATH_CHROMES = ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'chrome']
const UPDATER_KEYS = ['KSProductID', 'KSUpdateURL', 'KSChannelID', 'KSVersion']
const PRIVATE_BUNDLE_ID = 'dev.stacks.testing.chrome'

/** The Chrome to drive: `CHROME_PATH`, else the first installed one found. Null when there is none. */
export function findChrome(): string | null {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH
  if (process.platform === 'darwin') {
    const found = MAC_CHROMES.find(path => existsSync(path))
    if (found) return found
  }
  for (const name of PATH_CHROMES) {
    const found = Bun.which(name)
    if (found) return found
  }
  return null
}

/** The `.app` bundle an executable inside `Contents/MacOS/` belongs to, or null. */
function appBundleOf(executable: string): string | null {
  const match = /^(.*?\.app)\/Contents\/MacOS\/[^/]+$/.exec(executable)
  return match ? match[1]! : null
}

function plist(info: string, command: string): { ok: boolean, out: string } {
  const result = Bun.spawnSync(['/usr/libexec/PlistBuddy', '-c', command, info], { stdout: 'pipe', stderr: 'pipe' })
  return { ok: result.exitCode === 0, out: result.stdout.toString().trim() }
}

/** True when this Chrome would be killed by GoogleUpdater (it still carries the updater's keys). */
export function chromeHasUpdater(executable: string): boolean {
  const app = appBundleOf(executable)
  if (!app || process.platform !== 'darwin') return false
  const info = join(app, 'Contents/Info.plist')
  return existsSync(info) && UPDATER_KEYS.some(key => plist(info, `Print :${key}`).ok)
}

export interface PreparedChrome {
  /** The executable to launch. */
  executable: string
  /** The cloned `.app`. */
  app: string
  /** Reused from an earlier run rather than cloned now. */
  reused: boolean
}

/** Postorder, without following symlinks: nested frameworks must be sealed before their parents. */
function frameworkVersions(directory: string): { path: string, identifier: string }[] {
  const result: { path: string, identifier: string }[] = []
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const child = join(directory, entry.name)
    result.push(...frameworkVersions(child))
    if (!entry.name.endsWith('.framework') || !existsSync(join(child, 'Versions'))) continue
    const identifier = plist(join(child, 'Resources/Info.plist'), 'Print :CFBundleIdentifier')
    if (!identifier.ok || !identifier.out) throw new Error(`Framework has no signing identifier: ${child}`)
    for (const version of readdirSync(join(child, 'Versions'), { withFileTypes: true }).filter(item => item.isDirectory()).sort((a, b) => a.name.localeCompare(b.name)))
      result.push({ path: join(child, 'Versions', version.name), identifier: identifier.out })
  }
  return result
}

function validSignature(app: string): boolean {
  return Bun.spawnSync(['codesign', '--verify', '--deep', '--strict', app], { stdout: 'pipe', stderr: 'pipe' }).exitCode === 0
}

/**
 * A private clone of a macOS Chrome that GoogleUpdater leaves alone (see the
 * module docs): `cp -cR`, the `KS*` keys deleted from `Info.plist`, its own
 * `CFBundleIdentifier`, and a complete ad-hoc signature. Every framework
 * version shares an explicit designated requirement, as required for a
 * multi-version bundle (Apple TN2206). Kept in `directory` (default a
 * per-version temp folder) and reused only after strict signature validation.
 */
export function prepareMacChrome(options: { source?: string, directory?: string } = {}): PreparedChrome {
  if (process.platform !== 'darwin') throw new Error('prepareMacChrome is for macOS; elsewhere launch Chrome as installed')
  const source = options.source ?? MAC_CHROMES[0]!
  const sourceApp = appBundleOf(source)
  if (!sourceApp || !existsSync(sourceApp)) throw new Error(`No Chrome app bundle at ${source}`)
  const sourceInfo = join(sourceApp, 'Contents/Info.plist')
  const version = plist(sourceInfo, 'Print :CFBundleShortVersionString').out || 'unknown'
  const executableName = plist(sourceInfo, 'Print :CFBundleExecutable').out || 'Google Chrome'
  const directory = options.directory ?? join(tmpdir(), `stacks-chrome-${version.replace(/[^\w.-]/g, '_')}`)
  const app = join(directory, 'Chrome.app')
  const candidates = existsSync(directory) ? readdirSync(directory, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && (entry.name === 'Chrome.app' || (entry.name.startsWith('Chrome-') && entry.name.endsWith('.app'))))
    .map(entry => join(directory, entry.name)).sort() : []
  for (const candidate of candidates) {
    const executable = join(candidate, 'Contents/MacOS', executableName), info = join(candidate, 'Contents/Info.plist')
    if (existsSync(executable) && plist(info, 'Print :CFBundleIdentifier').out === PRIVATE_BUNDLE_ID
      && plist(info, 'Print :CFBundleShortVersionString').out === version && validSignature(candidate))
      return { executable, app: candidate, reused: true }
  }

  // Build beside the final path and move it in, so a run killed half-way
  // never leaves a half-signed app that a later run would reuse.
  mkdirSync(directory, { recursive: true })
  const staging = mkdtempSync(join(directory, 'staging-'))
  const staged = join(staging, 'Chrome.app')
  const run = (command: string[], what: string) => {
    const result = Bun.spawnSync(command, { stdout: 'pipe', stderr: 'pipe' })
    if (result.exitCode !== 0) throw new Error(`${what} failed: ${result.stderr.toString().trim()}`)
  }
  try {
    run(['/bin/cp', '-cR', sourceApp, staged], 'Cloning Chrome')
    const stagedInfo = join(staged, 'Contents/Info.plist')
    for (const key of UPDATER_KEYS) plist(stagedInfo, `Delete :${key}`)
    run(['/usr/libexec/PlistBuddy', '-c', `Set :CFBundleIdentifier ${PRIVATE_BUNDLE_ID}`, stagedInfo], 'Renaming the Chrome bundle')
    const versions = frameworkVersions(staged)
    // --deep only signs the current framework version. Prepare the code in
    // every version first, then seal nested frameworks and their parents.
    for (const item of versions) run(['codesign', '--force', '--deep', '--sign', '-', item.path], 'Re-signing framework code')
    for (const item of versions) run(['codesign', '--force', '--sign', '-', '--requirements', `=designated => identifier ${JSON.stringify(item.identifier)}`, item.path], 'Sealing a framework version')
    run(['codesign', '--force', ...(versions.length ? [] : ['--deep']), '--sign', '-', staged], 'Sealing Chrome')
    run(['codesign', '--verify', '--deep', '--strict', staged], 'Verifying Chrome')
    // Never remove a cached bundle that another browser process may still be
    // using. An invalid cache, or a concurrent preparation, gets a new generation.
    let destination = existsSync(app) ? join(directory, `Chrome-${basename(staging)}.app`) : app
    try { renameSync(staged, destination) }
    catch (error) {
      if (destination !== app || !['EEXIST', 'ENOTEMPTY'].includes((error as NodeJS.ErrnoException).code ?? '')) throw error
      destination = join(directory, `Chrome-${basename(staging)}.app`)
      renameSync(staged, destination)
    }
    return { executable: join(destination, 'Contents/MacOS', executableName), app: destination, reused: false }
  }
  finally {
    rmSync(staging, { recursive: true, force: true })
  }
}

