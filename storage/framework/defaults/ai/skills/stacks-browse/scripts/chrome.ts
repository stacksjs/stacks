// Shared Chrome executable preparation for the standalone skill and testing package.
import { createHash } from 'node:crypto'
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, readlinkSync, renameSync, rmSync, writeFileSync } from 'node:fs'
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

/**
 * The framework versions a private copy has no use for: every one that
 * `Versions/Current` does not point at.
 *
 * Chrome's updater keeps the version it replaced beside the new one, for the
 * browser that is still running it, and keeps it until that browser is
 * relaunched. Each is some 700 MB of code. A private copy is always started
 * fresh and only ever loads `Current`, yet every one of them was signed when
 * the copy was made and verified again before each reuse: with two updates
 * pending that was 2.1 GB and 20 to 28 seconds before a browser could start,
 * which is longer than a test waits. A framework with no `Current` link is
 * left whole, since nothing says which of its versions is the one in use.
 */
function supersededFrameworkVersions(directory: string): string[] {
  const result: string[] = []
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const child = join(directory, entry.name)
    result.push(...supersededFrameworkVersions(child))
    const versions = join(child, 'Versions')
    if (!entry.name.endsWith('.framework') || !existsSync(versions)) continue
    let current: string
    try { current = basename(readlinkSync(join(versions, 'Current'))) }
    catch { continue }
    if (!existsSync(join(versions, current))) continue
    for (const version of readdirSync(versions, { withFileTypes: true })) {
      if (version.isDirectory() && version.name !== current)
        result.push(join(versions, version.name))
    }
  }
  return result
}

function validSignature(app: string): boolean {
  return Bun.spawnSync(['codesign', '--verify', '--deep', '--strict', app], { stdout: 'pipe', stderr: 'pipe' }).exitCode === 0
}

/**
 * What a copy looked like when its signature was last verified: every file's
 * path, size and modification time, and every link's target, as one digest.
 *
 * Strict verification reads the whole bundle, about 15 seconds for one Chrome
 * version, and every test process that started a browser paid it again for a
 * copy nothing had touched. A copy whose files are all where they were, the
 * size they were and as old as they were is the copy that was verified, so
 * it is reused without being read again. Anything else, a file rewritten,
 * removed by the temp cleaner or added, changes the digest and the copy is
 * verified in full before it is trusted.
 */
function bundleFingerprint(app: string): string {
  const lines: string[] = []
  const walk = (directory: string, prefix: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
      const path = join(directory, entry.name), relative = `${prefix}${entry.name}`
      if (entry.isSymbolicLink()) { lines.push(`${relative}\tlink\t${readlinkSync(path)}`); continue }
      if (entry.isDirectory()) { walk(path, `${relative}/`); continue }
      const stat = lstatSync(path, { bigint: true })
      lines.push(`${relative}\tfile\t${stat.size}\t${stat.mtimeNs}`)
    }
  }
  walk(app, '')
  return createHash('sha256').update(lines.join('\n')).digest('hex')
}

/** Kept beside the copy, never inside it: a file added to a bundle breaks its seal. */
const stampOf = (app: string): string => `${app}.verified`
const STAMP_FORMAT = 'stacks-chrome-verified-1'

function verifiedUnchanged(app: string): boolean {
  try { return readFileSync(stampOf(app), 'utf8') === `${STAMP_FORMAT}\n${bundleFingerprint(app)}\n` }
  catch { return false }
}

/** Record that `app`, as it is now, passed strict verification. Written whole or not at all. */
function recordVerified(app: string): void {
  const pending = `${stampOf(app)}.${process.pid}`
  try {
    writeFileSync(pending, `${STAMP_FORMAT}\n${bundleFingerprint(app)}\n`)
    renameSync(pending, stampOf(app))
  }
  catch {
    // The copy is still valid without its stamp; the next run verifies it again.
    rmSync(pending, { force: true })
  }
}

/** A cached copy that may be launched: unchanged since it was verified, or verified now. */
function trustedCopy(app: string): boolean {
  if (verifiedUnchanged(app)) return true
  if (!validSignature(app)) return false
  recordVerified(app)
  return true
}

/**
 * A private clone of a macOS Chrome that GoogleUpdater leaves alone (see the
 * module docs): `cp -cR`, the `KS*` keys deleted from `Info.plist`, its own
 * `CFBundleIdentifier`, and a complete ad-hoc signature. Every framework
 * version shares an explicit designated requirement, as required for a
 * multi-version bundle (Apple TN2206). Framework versions the updater kept
 * for a browser that is still running are left out of the copy, which only
 * ever runs the current one. Kept in `directory` (default a per-version temp
 * folder) and reused only when it is the copy that passed strict signature
 * validation: unchanged since, by every file's size and age, or validated
 * again now.
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
    // A copy made before superseded versions were left out still verifies,
    // slowly. It is passed over, not removed: a browser may be running it.
    if (existsSync(executable) && plist(info, 'Print :CFBundleIdentifier').out === PRIVATE_BUNDLE_ID
      && plist(info, 'Print :CFBundleShortVersionString').out === version
      && supersededFrameworkVersions(candidate).length === 0 && trustedCopy(candidate))
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
    // The clone keeps the installed app's extended attributes (Finder info,
    // provenance, quarantine), and codesign refuses to sign over them:
    // "resource fork, Finder information, or similar detritus not allowed".
    run(['/usr/bin/xattr', '-cr', staged], 'Clearing extended attributes')
    const stagedInfo = join(staged, 'Contents/Info.plist')
    for (const key of UPDATER_KEYS) plist(stagedInfo, `Delete :${key}`)
    run(['/usr/libexec/PlistBuddy', '-c', `Set :CFBundleIdentifier ${PRIVATE_BUNDLE_ID}`, stagedInfo], 'Renaming the Chrome bundle')
    // Before signing, so what is left out is neither signed nor sealed into
    // the copy. Only the clone is touched: the installed app keeps them all.
    for (const superseded of supersededFrameworkVersions(staged)) rmSync(superseded, { recursive: true, force: true })
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
    // Verified a moment ago, as the staged copy. Moving it changed no file.
    recordVerified(destination)
    return { executable: join(destination, 'Contents/MacOS', executableName), app: destination, reused: false }
  }
  finally {
    rmSync(staging, { recursive: true, force: true })
  }
}

