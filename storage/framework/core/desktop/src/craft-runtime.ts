import type { DesktopTargetName } from '@stacksjs/types'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

/**
 * The Craft web view runtime for a platform this machine cannot supply
 * itself. A desktop build copies each target's own Craft binary into the app;
 * the host's comes from the installed Craft, and the others are the archives
 * Craft publishes with every release (`craft-<os>-<arch>.zip`), fetched here
 * once and kept.
 *
 * What is unpacked is only ever the file the release's own
 * `release-manifest.json` describes: the archive's size and SHA-256 are
 * checked against it first. That catches a truncated or swapped download; it
 * is the same trust as installing Craft from that release, no more.
 */

export const CRAFT_RELEASE_REPOSITORY = 'craft-native/craft'

/** The archive Craft publishes for a target, or null when it publishes none. */
export function craftRuntimeAsset(target: DesktopTargetName): string | null {
  const names: Partial<Record<DesktopTargetName, string>> = {
    'darwin-arm64': 'craft-darwin-arm64.zip',
    'darwin-x64': 'craft-darwin-x64.zip',
    'linux-x64': 'craft-linux-x64.zip',
    'win32-x64': 'craft-windows-x64.zip',
  }
  return names[target] ?? null
}

/** The runtime's file name inside that archive. */
export function craftRuntimeBinaryName(target: DesktopTargetName): string {
  return target.startsWith('win32-') ? 'craft.exe' : 'craft'
}

/** Files a Windows app needs beside the runtime, when they sit beside it: Craft ships `WebView2Loader.dll` in its archive. */
export const WINDOWS_RUNTIME_COMPANIONS = ['WebView2Loader.dll'] as const

/**
 * The companions found beside a Windows runtime that the app does not
 * already name, so a build includes `WebView2Loader.dll` without being told.
 */
export function windowsRuntimeCompanions(runtime: string, alreadyNamed: readonly string[] = []): string[] {
  const named = new Set(alreadyNamed.map(file => file.split(/[\\/]/).pop()!.toLowerCase()))
  return WINDOWS_RUNTIME_COMPANIONS
    .filter(name => !named.has(name.toLowerCase()))
    .map(name => join(dirname(runtime), name))
    .filter(file => existsSync(file))
}

export interface CraftReleaseManifest {
  tag: string
  assets: Array<{ name: string, size: number, sha256: string }>
}

/** A release manifest, checked for the shape this reads. Throws on anything else. */
export function parseCraftReleaseManifest(text: string, tag: string): CraftReleaseManifest {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  }
  catch {
    throw new Error(`Craft ${tag}: release-manifest.json is not JSON`)
  }
  const manifest = parsed as Partial<CraftReleaseManifest>
  if (manifest?.tag !== tag) throw new Error(`Craft ${tag}: release-manifest.json is for ${String(manifest?.tag)}`)
  if (!Array.isArray(manifest.assets)) throw new Error(`Craft ${tag}: release-manifest.json lists no assets`)
  for (const asset of manifest.assets) {
    if (typeof asset?.name !== 'string' || !Number.isSafeInteger(asset.size) || typeof asset.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(asset.sha256))
      throw new Error(`Craft ${tag}: release-manifest.json has an asset without a name, size and SHA-256`)
  }
  return manifest as CraftReleaseManifest
}

export interface FetchCraftRuntimeOptions {
  target: DesktopTargetName
  /** The Craft version to fetch (`0.0.499`): the one the installed `craft-native` is. */
  version: string
  /** Where this target's runtime is kept: `storage/framework/desktop/runtimes/<target>`. */
  directory: string
  fetcher?: (url: string) => Promise<Response>
  /** Unpack `archive` into `directory`. Default: the system's `unzip`, else `tar`. */
  unpack?: (archive: string, directory: string) => void
  /** Told when a download starts, so a build can say what it is waiting for. */
  onFetch?: (url: string) => void
}

export interface CraftRuntime {
  /** The native Craft binary for the target. */
  binary: string
  version: string
  /** False when the kept copy was used and nothing was downloaded. */
  fetched: boolean
}

function unpackArchive(archive: string, directory: string): void {
  // `unzip` on macOS and Linux; Windows has no unzip but its tar reads a zip.
  const attempts = [['unzip', '-oq', archive, '-d', directory], ['tar', '-xf', archive, '-C', directory]]
  let failure = ''
  for (const command of attempts) {
    try {
      const result = Bun.spawnSync(command, { stdout: 'ignore', stderr: 'pipe' })
      if (result.exitCode === 0) return
      failure = result.stderr.toString().trim() || `${command[0]} exited with ${result.exitCode}`
    }
    catch (error) {
      failure = error instanceof Error ? error.message : String(error)
    }
  }
  throw new Error(`Could not unpack ${archive}: ${failure}`)
}

/**
 * The Craft runtime for `target`, from `directory` when the version kept
 * there is the one asked for, else downloaded from that Craft release,
 * verified and unpacked there.
 */
export async function fetchCraftRuntime(options: FetchCraftRuntimeOptions): Promise<CraftRuntime> {
  const { target, directory } = options
  const version = options.version.replace(/^v/, '')
  if (!/^\d+\.\d+\.\d+(?:-[\w.]+)?$/.test(version)) throw new Error(`Not a Craft version: ${options.version}`)
  const tag = `v${version}`
  const asset = craftRuntimeAsset(target)
  if (!asset) throw new Error(`Craft publishes no runtime for ${target}. Build one there and name it in desktop.webview.runtime['${target}'].`)

  const binary = join(directory, craftRuntimeBinaryName(target))
  const stamp = join(directory, '.craft-version')
  if (existsSync(binary) && existsSync(stamp) && readFileSync(stamp, 'utf8').split(' ')[0] === tag)
    return { binary, version, fetched: false }

  const fetcher = options.fetcher ?? (url => fetch(url))
  const base = `https://github.com/${CRAFT_RELEASE_REPOSITORY}/releases/download/${tag}`
  const get = async (name: string): Promise<Response> => {
    const url = `${base}/${name}`
    options.onFetch?.(url)
    let response: Response
    try {
      response = await fetcher(url)
    }
    catch (error) {
      throw new Error(`Could not download ${url}: ${error instanceof Error ? error.message : String(error)}`)
    }
    if (!response.ok) throw new Error(`Could not download ${url}: HTTP ${response.status}`)
    return response
  }

  const manifest = parseCraftReleaseManifest(await (await get('release-manifest.json')).text(), tag)
  const listed = manifest.assets.find(entry => entry.name === asset)
  if (!listed) throw new Error(`Craft ${tag} lists no ${asset} in its release manifest.`)

  const bytes = new Uint8Array(await (await get(asset)).arrayBuffer())
  const sha256 = createHash('sha256').update(bytes).digest('hex')
  // A file that is not the one the release describes is not unpacked, whatever it is.
  if (bytes.byteLength !== listed.size || sha256 !== listed.sha256)
    throw new Error(`${asset} from Craft ${tag} is not the published file: got ${bytes.byteLength} bytes, sha256 ${sha256}; the release manifest says ${listed.size} bytes, sha256 ${listed.sha256}.`)

  // Unpacked beside the kept copy and moved into place whole, so a failure leaves the old one usable.
  const staging = `${directory}.fetching`
  rmSync(staging, { recursive: true, force: true })
  mkdirSync(staging, { recursive: true })
  try {
    const archive = join(staging, asset)
    writeFileSync(archive, bytes)
    ;(options.unpack ?? unpackArchive)(archive, staging)
    rmSync(archive, { force: true })
    if (!existsSync(join(staging, craftRuntimeBinaryName(target))))
      throw new Error(`${asset} from Craft ${tag} has no ${craftRuntimeBinaryName(target)} inside (it has: ${readdirSync(staging).join(', ') || 'nothing'}).`)
    writeFileSync(join(staging, '.craft-version'), `${tag} ${sha256}`)
    rmSync(directory, { recursive: true, force: true })
    mkdirSync(dirname(directory), { recursive: true })
    renameSync(staging, directory)
  }
  finally {
    rmSync(staging, { recursive: true, force: true })
  }
  return { binary, version, fetched: true }
}

/** The version of the `craft-native` package a project resolves, which names the Craft release its runtimes come from. */
export function installedCraftVersion(root: string): string | null {
  for (const from of [root, import.meta.dir]) {
    try {
      // Its package.json is not an export, so it is found above the entry that is.
      let folder = dirname(Bun.resolveSync('craft-native', from))
      for (let depth = 0; depth < 6; depth++, folder = dirname(folder)) {
        const file = join(folder, 'package.json')
        if (!existsSync(file)) continue
        const pkg = JSON.parse(readFileSync(file, 'utf8')) as { name?: string, version?: string }
        if (pkg.name === 'craft-native' && pkg.version) return pkg.version
      }
    }
    catch {
      // Not resolvable from here; try the next.
    }
  }
  return null
}
