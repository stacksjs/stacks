import type { ReleaseRecord } from '../src/update-feed'
import { afterEach, describe, expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { craftRuntimeAsset, fetchCraftRuntime, installedCraftVersion, parseCraftReleaseManifest, windowsRuntimeCompanions } from '../src/craft-runtime'
import { mergeReleaseRecord, releaseRecordKey } from '../src/update-feed'
import { configuredWebviewRuntime, webviewRuntimeFor } from '../src/webview-app'

const scratch: string[] = []
function temporary(): string {
  const directory = mkdtempSync(join(tmpdir(), 'stacks-craft-runtime-'))
  scratch.push(directory)
  return directory
}
afterEach(() => {
  for (const directory of scratch.splice(0)) rmSync(directory, { recursive: true, force: true })
})

/** A Craft release as GitHub serves it: a manifest and the archives it describes. The "archive" is unpacked by the test's own unpacker. */
function release(tag: string, files: Record<string, string>, overrides: { sha256?: string, size?: number, manifestTag?: string } = {}) {
  const archive = new TextEncoder().encode(JSON.stringify(files))
  const asked: string[] = []
  const manifest = {
    schemaVersion: 1,
    repository: 'craft-native/craft',
    tag: overrides.manifestTag ?? tag,
    assets: [{ name: 'craft-windows-x64.zip', size: overrides.size ?? archive.byteLength, sha256: overrides.sha256 ?? createHash('sha256').update(archive).digest('hex') }],
  }
  return {
    asked,
    fetcher: async (url: string): Promise<Response> => {
      asked.push(url)
      if (url === `https://github.com/craft-native/craft/releases/download/${tag}/release-manifest.json`) return new Response(JSON.stringify(manifest))
      if (url === `https://github.com/craft-native/craft/releases/download/${tag}/craft-windows-x64.zip`) return new Response(archive)
      return new Response('missing', { status: 404 })
    },
    unpack: (file: string, directory: string): void => {
      for (const [name, contents] of Object.entries(JSON.parse(readFileSync(file, 'utf8')) as Record<string, string>)) writeFileSync(join(directory, name), contents)
    },
  }
}

describe('a Craft runtime for another platform', () => {
  test('is fetched from the release of the installed Craft version, verified, unpacked and kept', async () => {
    const directory = join(temporary(), 'runtimes', 'win32-x64')
    const craft = release('v0.0.499', { 'craft.exe': 'MZ runtime', 'WebView2Loader.dll': 'MZ loader' })
    const first = await fetchCraftRuntime({ target: 'win32-x64', version: '0.0.499', directory, fetcher: craft.fetcher, unpack: craft.unpack })
    expect(first).toEqual({ binary: join(directory, 'craft.exe'), version: '0.0.499', fetched: true })
    expect(readFileSync(first.binary, 'utf8')).toBe('MZ runtime')
    expect(existsSync(join(directory, 'craft-windows-x64.zip'))).toBe(false)
    expect(craft.asked).toHaveLength(2)

    // The kept copy is used: a second build touches no network.
    const again = await fetchCraftRuntime({ target: 'win32-x64', version: 'v0.0.499', directory, fetcher: async () => { throw new Error('offline') } })
    expect(again).toEqual({ binary: first.binary, version: '0.0.499', fetched: false })

    // Another Craft version is another runtime.
    const newer = release('v0.0.500', { 'craft.exe': 'MZ newer' })
    expect((await fetchCraftRuntime({ target: 'win32-x64', version: '0.0.500', directory, fetcher: newer.fetcher, unpack: newer.unpack })).fetched).toBe(true)
    expect(readFileSync(first.binary, 'utf8')).toBe('MZ newer')
    expect(existsSync(join(directory, 'WebView2Loader.dll'))).toBe(false)
  })

  test('is never unpacked when it is not the file the release describes, and the kept copy survives', async () => {
    const directory = join(temporary(), 'win32-x64')
    const good = release('v0.0.499', { 'craft.exe': 'MZ good' })
    await fetchCraftRuntime({ target: 'win32-x64', version: '0.0.499', directory, fetcher: good.fetcher, unpack: good.unpack })

    let unpacked = 0
    const unpack = (): void => { unpacked++ }
    const swapped = release('v0.0.500', { 'craft.exe': 'MZ evil' }, { sha256: 'a'.repeat(64) })
    await expect(fetchCraftRuntime({ target: 'win32-x64', version: '0.0.500', directory, fetcher: swapped.fetcher, unpack })).rejects.toThrow('is not the published file')
    const truncated = release('v0.0.500', { 'craft.exe': 'MZ' }, { size: 9999 })
    await expect(fetchCraftRuntime({ target: 'win32-x64', version: '0.0.500', directory, fetcher: truncated.fetcher, unpack })).rejects.toThrow('is not the published file')
    const otherTag = release('v0.0.500', { 'craft.exe': 'MZ' }, { manifestTag: 'v0.0.1' })
    await expect(fetchCraftRuntime({ target: 'win32-x64', version: '0.0.500', directory, fetcher: otherTag.fetcher, unpack })).rejects.toThrow('release-manifest.json is for v0.0.1')
    const empty = release('v0.0.500', { 'readme.txt': 'no runtime here' })
    await expect(fetchCraftRuntime({ target: 'win32-x64', version: '0.0.500', directory, fetcher: empty.fetcher, unpack: empty.unpack })).rejects.toThrow('has no craft.exe inside')
    await expect(fetchCraftRuntime({ target: 'win32-x64', version: '0.0.501', directory, fetcher: good.fetcher })).rejects.toThrow('HTTP 404')
    expect(unpacked).toBe(0)
    expect(readFileSync(join(directory, 'craft.exe'), 'utf8')).toBe('MZ good')
    expect(existsSync(`${directory}.fetching`)).toBe(false)
  })

  test('says so for a target Craft publishes nothing for, and for a version that is not one', async () => {
    expect(craftRuntimeAsset('linux-x64')).toBe('craft-linux-x64.zip')
    expect(craftRuntimeAsset('darwin-arm64')).toBe('craft-darwin-arm64.zip')
    expect(craftRuntimeAsset('linux-arm64')).toBeNull()
    await expect(fetchCraftRuntime({ target: 'linux-arm64', version: '0.0.499', directory: temporary() })).rejects.toThrow('Craft publishes no runtime for linux-arm64')
    await expect(fetchCraftRuntime({ target: 'linux-x64', version: '../../evil', directory: temporary() })).rejects.toThrow('Not a Craft version')
    expect(() => parseCraftReleaseManifest('{"tag":"v1.2.3","assets":[{"name":"a","size":1,"sha256":"nope"}]}', 'v1.2.3')).toThrow('without a name, size and SHA-256')
    expect(() => parseCraftReleaseManifest('<html>', 'v1.2.3')).toThrow('is not JSON')
  })

  test('the version asked for is the installed craft-native', () => {
    expect(installedCraftVersion(import.meta.dir)).toMatch(/^\d+\.\d+\.\d+/)
  })

  test('a runtime the config or the environment names still wins, and the host supplies its own', () => {
    const root = temporary()
    mkdirSync(join(root, 'vendor'))
    writeFileSync(join(root, 'vendor/craft.exe'), 'MZ')
    writeFileSync(join(root, 'env-craft'), 'ELF')
    const options = { root, env: { CRAFT_BIN_LINUX_X64: join(root, 'env-craft') }, host: 'darwin-arm64' as const, hostRuntime: () => '/host/craft' }
    expect(configuredWebviewRuntime({ runtime: { 'win32-x64': 'vendor/craft.exe' } }, 'win32-x64', options)).toBe(join(root, 'vendor/craft.exe'))
    expect(configuredWebviewRuntime({}, 'linux-x64', options)).toBe(join(root, 'env-craft'))
    expect(configuredWebviewRuntime({}, 'darwin-arm64', options)).toBe('/host/craft')
    // Nothing configured: the build fetches it.
    expect(configuredWebviewRuntime({}, 'win32-x64', options)).toBeNull()
    expect(() => webviewRuntimeFor({}, 'win32-x64', options)).toThrow('No Craft runtime for win32-x64')
    expect(() => configuredWebviewRuntime({ runtime: { 'win32-x64': 'vendor/missing.exe' } }, 'win32-x64', options)).toThrow('does not exist')
  })

  test('WebView2Loader.dll beside a Windows runtime is included unless the app already names one', () => {
    const directory = temporary()
    writeFileSync(join(directory, 'craft.exe'), 'MZ')
    expect(windowsRuntimeCompanions(join(directory, 'craft.exe'))).toEqual([])
    writeFileSync(join(directory, 'WebView2Loader.dll'), 'MZ')
    expect(windowsRuntimeCompanions(join(directory, 'craft.exe'))).toEqual([join(directory, 'WebView2Loader.dll')])
    expect(windowsRuntimeCompanions(join(directory, 'craft.exe'), ['vendor/webview2loader.dll'])).toEqual([])
    expect(windowsRuntimeCompanions(join(directory, 'craft.exe'), ['vendor\\Other.dll'])).toEqual([join(directory, 'WebView2Loader.dll')])
  })
})

describe('release.json across the runs of one release', () => {
  const entry = (target: string, version: string) => ({ target, update: { url: `https://x.example/${target}/${version}`, sha256: 'a'.repeat(64), bytes: 1 }, downloads: [] })
  const record = (version: string, targets: string[], channel = 'stable'): ReleaseRecord => ({ version, channel, sourceRevision: 'b'.repeat(40), publishedAt: '2026-11-12T00:00:00.000Z', targets: targets.map(target => entry(target, version)) })

  test('a later run for the same version adds its platforms and keeps the others', () => {
    const mac = record('0.2.0', ['darwin-arm64'])
    const merged = mergeReleaseRecord(JSON.stringify(mac), { ...record('0.2.0', ['linux-x64', 'win32-x64']), publishedAt: '2026-11-13T00:00:00.000Z' })
    expect(merged.targets.map(item => item.target)).toEqual(['darwin-arm64', 'linux-x64', 'win32-x64'])
    expect(merged.targets[0]).toEqual(mac.targets[0]!)
    expect(merged.publishedAt).toBe('2026-11-13T00:00:00.000Z')
  })

  test('a platform released again replaces its own entry', () => {
    const again = { ...entry('darwin-arm64', '0.2.0'), update: { url: 'https://x.example/again', sha256: 'c'.repeat(64), bytes: 2 } }
    const merged = mergeReleaseRecord(JSON.stringify(record('0.2.0', ['darwin-arm64', 'linux-x64'])), { ...record('0.2.0', []), targets: [again] })
    expect(merged.targets).toEqual([again, entry('linux-x64', '0.2.0')])
  })

  test('another version, another channel or an unreadable record starts a new one', () => {
    const next = record('0.3.0', ['linux-x64'])
    expect(mergeReleaseRecord(JSON.stringify(record('0.2.0', ['darwin-arm64'])), next)).toEqual(next)
    expect(mergeReleaseRecord(JSON.stringify(record('0.3.0', ['darwin-arm64'], 'beta')), next)).toEqual(next)
    expect(mergeReleaseRecord('not json', next)).toEqual(next)
    expect(mergeReleaseRecord(null, next)).toEqual(next)
    expect(mergeReleaseRecord(JSON.stringify({ version: '0.3.0', channel: 'stable', targets: [{ target: 'darwin-arm64' }, 'junk'] }), next)).toEqual(next)
  })

  test('the record sits beside the channel\'s manifests', () => {
    expect(releaseRecordKey({})).toBe('desktop-updates/stable/release.json')
    expect(releaseRecordKey({ channel: 'beta', prefix: '/tinkerbelle/updates/' })).toBe('tinkerbelle/updates/beta/release.json')
    expect(() => releaseRecordKey({ channel: '../x' })).toThrow('Invalid release channel')
  })
})
