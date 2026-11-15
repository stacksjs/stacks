import type { UpdateStore } from '@stacksjs/desktop-build'
import { afterEach, describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { checkForDesktopUpdate, generateUpdateKeypair, macosReleasePlan, serveUpdateFeed, verifyUpdateManifestSignature } from '@stacksjs/desktop-build'
import { assertReleasable, publishPlannedReleases, releaseSigningKey, releaseStore } from '../src/build/desktop-release-shared'
import { craftSupportsUpdater } from '../src/build/macos-native'

/**
 * The publishing half of `buddy release:desktop` for a native macOS app:
 * which Craft can build its updater, which key signs, what refuses a release
 * before anything is uploaded, and what lands on the disk. The signing,
 * notarizing and imaging are Apple's tools and are not run here; the artifacts
 * are stand-in files, published through the same code a real release uses.
 */

const scratch: string[] = []
function temporary(): string {
  const directory = mkdtempSync(join(tmpdir(), 'stacks-macos-release-'))
  scratch.push(directory)
  return directory
}
afterEach(() => {
  for (const directory of scratch.splice(0)) rmSync(directory, { recursive: true, force: true })
})

const keys = generateUpdateKeypair()
const updates = { feedUrl: 'https://library.example.com/api/updates', publicKeys: { main: keys.publicKey } }

function memoryStore(): UpdateStore & { files: Map<string, string | Uint8Array> } {
  const files = new Map<string, string | Uint8Array>()
  return {
    files,
    read: async key => (typeof files.get(key) === 'string' ? files.get(key) as string : null),
    write: async (key, contents) => { files.set(key, contents) },
    publicUrl: async key => `https://cdn.example.com/${key}`,
  }
}

describe('craftSupportsUpdater', () => {
  test('recognises the option in source and once minified', () => {
    expect(craftSupportsUpdater('const updater = options.updater ? ["-D", "CRAFT_UPDATER"] : []')).toBe(true)
    expect(craftSupportsUpdater('e.updater&&t.push("-D","CRAFT_UPDATER")')).toBe(true)
    expect(craftSupportsUpdater('const { outdir, webkit, updater } = options')).toBe(true)
  })

  test('a Craft that only mentions an updater in a comment, or takes webkit alone, does not count', () => {
    expect(craftSupportsUpdater('/** The host has no updater. */ const web = options.webkit ? [] : []')).toBe(false)
  })
})

describe('the key a release signs with', () => {
  test('is the private half of a key the app trusts, named by its id', () => {
    expect(releaseSigningKey({ ...updates, publicKeys: { old: generateUpdateKeypair().publicKey, main: keys.publicKey } }, 'macos.updates', keys.privateKey)).toEqual({ privateKey: keys.privateKey, keyId: 'main' })
  })

  test('a missing key and a key the app does not trust are both refused, naming the section', () => {
    expect(() => releaseSigningKey(updates, 'macos.updates', '')).toThrow(/DESKTOP_UPDATE_PRIVATE_KEY is not set/)
    expect(() => releaseSigningKey(updates, 'macos.updates', generateUpdateKeypair().privateKey)).toThrow(/does not match any key in macos\.updates\.publicKeys/)
  })
})

describe('what refuses a release before it is made', () => {
  const destination = (store: UpdateStore, overrides: Partial<typeof updates> = {}) => ({ store, updates: { ...updates, ...overrides }, channel: 'stable', prefix: 'desktop-updates', dryRun: false })

  test('a feed on this machine: no installed app could download from it', async () => {
    await expect(assertReleasable(destination(memoryStore(), { feedUrl: 'http://127.0.0.1:3000/api/updates' }), 'macos.updates', 'darwin-arm64', '1.4.0', 'Library-1.4.0-arm64.zip')).rejects.toThrow(/darwin-arm64: .*on this machine.*Set macos\.updates\.feedUrl/)
  })

  test('a version the feed already serves, or an older one', async () => {
    const store = memoryStore()
    const root = temporary()
    const plan = macosReleasePlan({ output: root, appName: 'Library', version: '1.4.0', architecture: 'arm64' })
    mkdirSync(plan.staged, { recursive: true })
    writeFileSync(plan.update, 'the app')
    writeFileSync(plan.dmg, 'the image')
    await publishPlannedReleases({ ...destination(store), planned: [{ target: plan.target, directory: plan.staged, update: plan.update, downloads: [plan.dmg] }], appName: 'Library', version: '1.4.0', sourceRevision: 'a'.repeat(40), privateKey: keys.privateKey, keyId: 'main', releaseDir: join(root, 'release') })
    await expect(assertReleasable(destination(store), 'macos.updates', 'darwin-arm64', '1.4.0', 'Library-1.4.0-arm64.zip')).rejects.toThrow(/1\.4\.0 is already published/)
    await expect(assertReleasable(destination(store), 'macos.updates', 'darwin-arm64', '1.3.9', 'Library-1.3.9-arm64.zip')).rejects.toThrow(/newer than 1\.3\.9/)
    await expect(assertReleasable(destination(store), 'macos.updates', 'darwin-arm64', '1.5.0', 'Library-1.5.0-arm64.zip')).resolves.toBeUndefined()
    // Another architecture has its own manifest.
    await expect(assertReleasable(destination(store), 'macos.updates', 'darwin-x64', '1.4.0', 'Library-1.4.0-x64.zip')).resolves.toBeUndefined()
  })
})

describe('publishing a macos release', () => {
  async function release(options: { dryRun?: boolean, channel?: string, notes?: string } = {}) {
    const root = temporary()
    const plan = macosReleasePlan({ output: root, appName: 'Library', version: '1.4.0', architecture: 'arm64' })
    mkdirSync(plan.staged, { recursive: true })
    writeFileSync(plan.update, 'the zipped app')
    writeFileSync(plan.dmg, 'the disk image')
    const store = options.dryRun ? await releaseStore(updates, true) : memoryStore()
    const published = await publishPlannedReleases({
      store, updates, channel: options.channel ?? 'stable', prefix: 'desktop-updates', dryRun: options.dryRun === true,
      planned: [{ target: plan.target, directory: plan.staged, update: plan.update, downloads: [plan.dmg] }],
      appName: 'Library', version: '1.4.0', sourceRevision: 'b'.repeat(40), privateKey: keys.privateKey, keyId: 'main', notes: options.notes, releaseDir: join(root, 'release'),
    })
    return { root, plan, store, published }
  }

  test('lands in the web view layout: the zip and DMG under the version, latest.json and release.json beside them', async () => {
    const { store, published } = await release({ notes: 'Faster search.' })
    expect([...(store as ReturnType<typeof memoryStore>).files.keys()].sort()).toEqual([
      'desktop-updates/stable/darwin-arm64/1.4.0/Library-1.4.0-arm64.dmg',
      'desktop-updates/stable/darwin-arm64/1.4.0/Library-1.4.0-arm64.zip',
      'desktop-updates/stable/darwin-arm64/latest.json',
      'desktop-updates/stable/release.json',
    ])
    const manifest = published[0]!.manifest
    expect(manifest).toMatchObject({ version: '1.4.0', platform: 'darwin', architecture: 'arm64', sourceRevision: 'b'.repeat(40), signingKeyId: 'main', notes: 'Faster search.' })
    expect(manifest.url).toBe('https://library.example.com/api/updates/files/stable/darwin-arm64/1.4.0/Library-1.4.0-arm64.zip')
    expect(manifest.size).toBe('the zipped app'.length)
    expect(() => verifyUpdateManifestSignature(manifest, updates.publicKeys)).not.toThrow()
    const record = JSON.parse(await store.read('desktop-updates/stable/release.json') as string)
    expect(record.targets).toHaveLength(1)
    expect(record.targets[0].update.format).toBe('zip')
    expect(record.targets[0].downloads.map((item: { name: string, format: string }) => [item.name, item.format])).toEqual([['Library-1.4.0-arm64.dmg', 'dmg']])
  })

  test('the feed then serves it to an older app, and to no app that already runs it', async () => {
    const { store } = await release()
    const feed = await serveUpdateFeed({ store, platform: 'darwin', architecture: 'arm64', currentVersion: '1.3.0' })
    const offered = await checkForDesktopUpdate({ currentVersion: '1.3.0', manifestUrl: `${updates.feedUrl}/darwin/arm64`, trustedKeys: updates.publicKeys, target: { platform: 'darwin', architecture: 'arm64' }, fetcher: async () => feed })
    expect(offered?.version).toBe('1.4.0')
    expect((await serveUpdateFeed({ store, platform: 'darwin', architecture: 'arm64', currentVersion: '1.4.0' })).status).toBe(204)
    expect((await serveUpdateFeed({ store, platform: 'darwin', architecture: 'x64' })).status).toBe(404)
  })

  test('--channel publishes beside the stable channel, not over it', async () => {
    const { store } = await release({ channel: 'beta' })
    expect([...(store as ReturnType<typeof memoryStore>).files.keys()].every(key => key.startsWith('desktop-updates/beta/'))).toBe(true)
  })

  test('a dry run uploads nothing and leaves the signed manifest and release.json in the release folder', async () => {
    const { root, plan, published } = await release({ dryRun: true })
    const local = JSON.parse(readFileSync(join(plan.staged, 'latest.json'), 'utf8'))
    expect(local).toEqual(published[0]!.manifest)
    expect(() => verifyUpdateManifestSignature(local, updates.publicKeys)).not.toThrow()
    expect(JSON.parse(readFileSync(join(root, 'release/release.json'), 'utf8')).version).toBe('1.4.0')
  })
})
