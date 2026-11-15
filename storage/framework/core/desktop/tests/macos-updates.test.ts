import type { UpdateStore } from '../src/update-feed'
import { afterEach, describe, expect, test } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  answerUpdateArtifact,
  answerUpdateFeed,
  assembleMacosApp,
  checkForDesktopUpdate,
  desktopUpdatesCollision,
  desktopUpdatesProblems,
  generateUpdateKeypair,
  isUpdatePublicKey,
  macosBuildRecordFile,
  macosHostUpdates,
  macosPantryArtifact,
  macosReleasePlan,
  macosSelfUpdates,
  parseDeveloperIdIdentity,
  publishDesktopUpdate,
  readMacosBuildRecord,
  renderHostConfig,
  renderMacosEntitlements,
  renderMacosHostEntitlements,
  resolveMacosDesktop,
  runDesktopAgentApp,
  selectDesktopUpdates,
  validateMacosDesktop,
} from '../src/index'

/**
 * In-app updates for a native macOS app (`macos.updates`): what the config
 * may say, what reaches the AppKit host in `craft-app.json`, who the
 * Developer ID build is signed for, and the feed a project with a `macos` app
 * serves. Nothing here signs or notarizes: `assembleMacosApp` takes its
 * commands as a function.
 */

const scratch: string[] = []
function temporary(): string {
  const directory = mkdtempSync(join(tmpdir(), 'stacks-macos-updates-'))
  scratch.push(directory)
  return directory
}
afterEach(() => {
  for (const directory of scratch.splice(0)) rmSync(directory, { recursive: true, force: true })
})

const keys = generateUpdateKeypair()
const updates = { feedUrl: 'https://library.example.com/api/updates', publicKeys: { main: keys.publicKey } }
const base = {
  appName: 'Library',
  bundleId: 'com.stacksjs.library',
  teamId: '3JJRNQW6B7',
  url: 'https://library.example.com/',
  nativeScreens: ['Main', 'Settings'],
}
const app = resolveMacosDesktop({ ...base, updates }, '1.4.0')

describe('macos.updates in the config', () => {
  test('resolves with the app and validates clean', () => {
    expect(app.updates).toEqual(updates)
    expect(validateMacosDesktop(app)).toEqual([])
  })

  test('the feed is https and every key is a public key, as for a web view app', () => {
    const bad = resolveMacosDesktop({ ...base, updates: { feedUrl: 'http://library.example.com/api/updates', publicKeys: { main: keys.privateKey } } }, '1.4.0')
    expect(validateMacosDesktop(bad)).toEqual([
      'macos.updates.feedUrl must be https',
      'macos.updates.publicKeys.main is not a public key (it starts with ed25519-public:)',
    ])
    expect(validateMacosDesktop(resolveMacosDesktop({ ...base, updates: { feedUrl: 'nowhere', publicKeys: {} } }, '1.4.0'))).toEqual([
      'macos.updates.feedUrl is not a URL (got "nowhere")',
      'macos.updates.publicKeys needs at least one key (run `buddy desktop:update:keypair`)',
    ])
    // A loopback feed is how a release is rehearsed against a local server.
    expect(validateMacosDesktop(resolveMacosDesktop({ ...base, updates: { ...updates, feedUrl: 'http://127.0.0.1:3000/api/updates' } }, '1.4.0'))).toEqual([])
  })

  test('a key the host could not read is refused at build time, not ignored at run time', () => {
    const truncated = resolveMacosDesktop({ ...base, updates: { ...updates, publicKeys: { main: 'ed25519-public:MCowBQYDK2VwAyEA' } } }, '1.4.0')
    expect(validateMacosDesktop(truncated)[0]).toContain('macos.updates.publicKeys.main is not a readable Ed25519 public key')
    expect(isUpdatePublicKey(keys.publicKey)).toBe(true)
    expect(isUpdatePublicKey(keys.privateKey)).toBe(false)
    // The web view validation keeps its looser check: the prefix alone.
    expect(desktopUpdatesProblems({ ...updates, publicKeys: { main: 'ed25519-public:MCowBQYDK2VwAyEA' } }, 'webview.updates')).toEqual([])
  })

  test('the version has to be one an update can be compared against', () => {
    expect(validateMacosDesktop(resolveMacosDesktop({ ...base, updates, version: '1.4' }, '1.4.0'))[0]).toContain('macos.version must be major.minor.patch')
    // Without updates a two-part version is still a valid bundle version.
    expect(validateMacosDesktop(resolveMacosDesktop({ ...base, version: '1.4' }, '1.4.0'))).toEqual([])
  })

  test('the check interval is hours, and 0 turns it off', () => {
    expect(validateMacosDesktop(resolveMacosDesktop({ ...base, updates: { ...updates, checkEveryHours: 0 } }, '1.4.0'))).toEqual([])
    expect(validateMacosDesktop(resolveMacosDesktop({ ...base, updates: { ...updates, checkEveryHours: -1 } }, '1.4.0'))[0]).toContain('macos.updates.checkEveryHours')
  })
})

describe('craft-app.json', () => {
  test('a development and a Developer ID build carry updates, spelled out in full', () => {
    for (const distribution of ['development', 'developer-id'] as const) {
      expect(JSON.parse(renderHostConfig(app, distribution)).updates).toEqual({
        feedUrl: 'https://library.example.com/api/updates',
        publicKeys: { main: keys.publicKey },
        channel: 'stable',
        checkEveryHours: 24,
      })
    }
  })

  test('a Mac App Store build never does, nor a caller that names no distribution', () => {
    expect(JSON.parse(renderHostConfig(app, 'app-store')).updates).toBeUndefined()
    expect(JSON.parse(renderHostConfig(app)).updates).toBeUndefined()
    expect(renderHostConfig(app, 'app-store')).not.toContain('ed25519-public')
    expect(macosSelfUpdates(app, 'app-store')).toBe(false)
    expect(macosSelfUpdates(app, undefined)).toBe(false)
    expect(macosSelfUpdates(app, 'developer-id')).toBe(true)
    expect(macosSelfUpdates(resolveMacosDesktop(base, '1.4.0'), 'developer-id')).toBe(false)
  })

  test('only what an installed app needs is written: where a release is stored stays with the releaser', () => {
    const host = macosHostUpdates({ ...updates, feedUrl: 'https://library.example.com/api/updates/', channel: 'beta', checkEveryHours: 0, disk: 's3', prefix: 'library', artifactBaseUrl: 'https://cdn.example.com' })
    expect(host).toEqual({ feedUrl: 'https://library.example.com/api/updates', publicKeys: { main: keys.publicKey }, channel: 'beta', checkEveryHours: 0 })
  })

  test('an app without updates has no updates key in any build', () => {
    for (const distribution of ['development', 'developer-id', 'app-store'] as const)
      expect(JSON.parse(renderHostConfig(resolveMacosDesktop(base, '1.4.0'), distribution)).updates).toBeUndefined()
  })
})

describe('the developer-id distribution', () => {
  test('is not sandboxed and holds none of the Store entitlements, whatever macos.sandbox says', () => {
    const xml = renderMacosEntitlements(resolveMacosDesktop({ ...base, updates, sandbox: true, permissions: { camera: true, downloads: true } }, '1.4.0'), 'developer-id')
    expect(xml).not.toContain('com.apple.security.app-sandbox')
    expect(xml).not.toContain('com.apple.application-identifier')
    expect(xml).not.toContain('com.apple.developer.team-identifier')
    expect(xml).not.toContain('keychain-access-groups')
    // Sandbox-only entitlements go with the sandbox; a device entitlement is the hardened runtime's.
    expect(xml).not.toContain('com.apple.security.files.downloads')
    expect(xml).toContain('com.apple.security.device.camera')
  })

  test('the Store build of the same config keeps the sandbox and its entitlements', () => {
    const xml = renderMacosEntitlements(app, 'app-store')
    expect(xml).toContain('<key>com.apple.security.app-sandbox</key><true/>')
    expect(xml).toContain('<string>3JJRNQW6B7.com.stacksjs.library</string>')
  })

  test('an agent app keeps what Bun needs under the hardened runtime, and its host is not sandboxed either', () => {
    const agent = resolveMacosDesktop({ ...base, url: undefined, agent: true, updates, permissions: { microphone: true } }, '1.4.0')
    const xml = renderMacosEntitlements(agent, 'developer-id')
    expect(xml).toContain('com.apple.security.cs.allow-jit')
    expect(xml).not.toContain('com.apple.security.network.server')
    const host = renderMacosHostEntitlements(agent, 'developer-id')
    expect(host).not.toContain('app-sandbox')
    expect(host).not.toContain('inherit')
    expect(host).toContain('com.apple.security.device.audio-input')
  })

  function fixture(): string {
    const dir = temporary()
    writeFileSync(join(dir, 'host'), '#!host')
    writeFileSync(join(dir, 'screens.js'), 'screens')
    writeFileSync(join(dir, 'profile'), 'profile')
    return dir
  }
  const assemble = (dir: string, extra: Record<string, unknown>, commands: string[][] = []) => assembleMacosApp({
    config: app, root: dir, host: join(dir, 'host'), nativeBundle: join(dir, 'screens.js'), output: join(dir, 'out'), run: args => commands.push(args), ...extra,
  } as Parameters<typeof assembleMacosApp>[0])

  test('is signed with the identity given, under the hardened runtime with a timestamp, and carries updates', () => {
    const dir = fixture()
    const commands: string[][] = []
    const result = assemble(dir, { distribution: 'developer-id', signingIdentity: 'Developer ID Application: Example (3JJRNQW6B7)' }, commands)
    const sign = commands.find(command => command[0] === 'codesign' && command.includes('--entitlements'))!
    expect(sign).toContain('--timestamp')
    expect(sign.slice(sign.indexOf('--options'), sign.indexOf('--options') + 2)).toEqual(['--options', 'runtime'])
    expect(sign[sign.indexOf('--sign') + 1]).toBe('Developer ID Application: Example (3JJRNQW6B7)')
    expect(readFileSync(result.entitlementsPath, 'utf8')).not.toContain('app-sandbox')
    expect(existsSync(join(result.appPath, 'Contents/embedded.provisionprofile'))).toBe(false)
    expect(JSON.parse(readFileSync(join(result.appPath, 'Contents/Resources/craft-app.json'), 'utf8')).updates.feedUrl).toBe(updates.feedUrl)
  })

  test('refuses an ad hoc signature, except for a rehearsal', () => {
    const dir = fixture()
    expect(() => assemble(dir, { distribution: 'developer-id' })).toThrow(/Developer ID Application identity/)
    expect(() => assemble(dir, { distribution: 'developer-id', signingIdentity: '-' })).toThrow(/Developer ID Application identity/)
    expect(assemble(dir, { distribution: 'developer-id', rehearsal: true }).appPath.endsWith('Library.app')).toBe(true)
  })

  test('the Store bundle of an app with updates has no updates in craft-app.json', () => {
    const dir = fixture()
    const result = assemble(dir, { distribution: 'app-store', provisioningProfile: join(dir, 'profile'), signingIdentity: '3rd Party Mac Developer Application: Example (3JJRNQW6B7)' })
    const host = readFileSync(join(result.appPath, 'Contents/Resources/craft-app.json'), 'utf8')
    expect(JSON.parse(host).updates).toBeUndefined()
    expect(host).not.toContain('feedUrl')
    expect(readFileSync(result.entitlementsPath, 'utf8')).toContain('com.apple.security.app-sandbox')
  })

  test('the keychain\'s Developer ID Application certificate is found by its hash, and no other kind is', () => {
    const listing = [
      '  1) ADFF57703F039D2948CC5D60269F8E0CE9817CB1 "Apple Development: Dev (AAAAAAAAAA)"',
      '  2) 7CD06BC2B843CF71069ABD8D37101445B6AEC5AF "Developer ID Installer: Example (3JJRNQW6B7)"',
      '  3) 59BD76EE38A4781A192B166A3BC104BC955D0521 "Developer ID Application: Example (3JJRNQW6B7)"',
      '     3 valid identities found',
    ].join('\n')
    expect(parseDeveloperIdIdentity(listing)).toBe('59BD76EE38A4781A192B166A3BC104BC955D0521')
    expect(parseDeveloperIdIdentity(listing.split('\n').slice(0, 2).join('\n'))).toBeUndefined()
  })
})

describe('the build record', () => {
  test('is read back when it has what a release checks, and not when it predates it', () => {
    const output = temporary()
    expect(readMacosBuildRecord(output, 'Library')).toBeNull()
    writeFileSync(macosBuildRecordFile(output, 'Library'), JSON.stringify({ appName: 'Library', version: '1.4.0', signedWith: 'ad hoc' }))
    expect(readMacosBuildRecord(output, 'Library')).toBeNull()
    writeFileSync(macosBuildRecordFile(output, 'Library'), JSON.stringify({ appName: 'Library', version: '1.4.0', distribution: 'developer-id', architecture: 'arm64', sourceRevision: 'a'.repeat(40), updater: true }))
    expect(readMacosBuildRecord(output, 'Library')).toMatchObject({ distribution: 'developer-id', architecture: 'arm64', updater: true })
  })
})

describe('the release layout', () => {
  test('is a web view app\'s Mac layout: one zip the app updates from, one DMG a person downloads', () => {
    const plan = macosReleasePlan({ output: '/p/storage/framework/desktop/macos', appName: 'Library', version: '1.4.0', architecture: 'arm64' })
    expect(plan).toEqual({
      target: 'darwin-arm64',
      staged: '/p/storage/framework/desktop/macos/release/darwin-arm64',
      update: '/p/storage/framework/desktop/macos/release/darwin-arm64/Library-1.4.0-arm64.zip',
      dmg: '/p/storage/framework/desktop/macos/release/darwin-arm64/Library-1.4.0-arm64.dmg',
    })
    expect(macosReleasePlan({ output: '/o', appName: 'My App', version: '2.0.0', architecture: 'x64' }).update).toBe('/o/release/darwin-x64/My-App-2.0.0-x64.zip')
    expect(() => macosReleasePlan({ output: '/o', appName: 'A', version: '1.0.0', architecture: 'x86_64' })).toThrow(/arm64 or x64/)
  })

  test('what Pantry is told: the DMG it notarizes, the app it publishes, the identity it checks', () => {
    expect(macosPantryArtifact(resolveMacosDesktop({ ...base, buildNumber: '42' }, '1.4.0'), { output: '/p/storage/framework/desktop/macos', architecture: 'arm64' })).toEqual({
      path: '/p/storage/framework/desktop/macos/release/darwin-arm64/Library-1.4.0-arm64.dmg',
      appPath: '/p/storage/framework/desktop/macos/Library.app',
      name: 'Library',
      bundleId: 'com.stacksjs.library',
      version: '1.4.0',
      buildNumber: '42',
      target: 'macos',
      minimumSystemVersion: '13.0',
    })
  })
})

describe('the feed of a project with a macos app', () => {
  async function published(options: { prefix?: string } = {}): Promise<UpdateStore> {
    const files = new Map<string, string>()
    const store: UpdateStore = {
      read: async key => files.get(key) ?? null,
      write: async (key, contents) => { files.set(key, typeof contents === 'string' ? contents : '(binary)') },
      publicUrl: async key => `https://cdn.example.com/${key}`,
    }
    const artifact = join(temporary(), 'Library-1.4.0-arm64.zip')
    writeFileSync(artifact, 'the app')
    await publishDesktopUpdate({ store, artifact, version: '1.4.0', sourceRevision: 'a'.repeat(40), privateKey: keys.privateKey, platform: 'darwin', architecture: 'arm64', feedUrl: updates.feedUrl, ...options })
    return store
  }

  function project(config: string): string {
    const root = temporary()
    mkdirSync(join(root, 'config'))
    writeFileSync(join(root, 'config/desktop.ts'), `export default ${config}\n`)
    return root
  }

  test('a manifest released for it is one the app accepts, at the platform and architecture it asks for', async () => {
    const store = await published()
    const response = await answerUpdateFeed({ store, platform: 'darwin', architecture: 'arm64', currentVersion: '1.3.0' })
    expect(response.status).toBe(200)
    const manifest = await checkForDesktopUpdate({ currentVersion: '1.3.0', manifestUrl: `${updates.feedUrl}/darwin/arm64`, trustedKeys: updates.publicKeys, target: { platform: 'darwin', architecture: 'arm64' }, fetcher: async () => response })
    expect(manifest?.url).toBe('https://library.example.com/api/updates/files/stable/darwin-arm64/1.4.0/Library-1.4.0-arm64.zip')
    expect((await answerUpdateFeed({ store, platform: 'darwin', architecture: 'arm64', currentVersion: '1.4.0' })).status).toBe(204)
  })

  test('macos.updates alone is read by the feed and the artifact route: no longer "publishes no desktop updates"', async () => {
    const root = project(`{ macos: { appName: 'Library', bundleId: 'com.stacksjs.library', nativeScreens: ['Main'], updates: { feedUrl: 'https://library.example.com/api/updates', publicKeys: {}, disk: 'macos-feed-test', prefix: 'library' } } }`)
    const { Storage } = await import('@stacksjs/storage')
    const disk = temporary()
    Storage.init({ default: 'macos-feed-test', disks: { 'macos-feed-test': { driver: 'local', root: disk, visibility: 'private' } } } as Parameters<typeof Storage.init>[0])
    try {
      // Nothing released yet: the feed is there (not the 404 of an app with no updates) and has no manifest.
      const empty = await answerUpdateFeed({ root, platform: 'darwin', architecture: 'arm64' })
      expect(await empty.json()).toEqual({ error: 'No update has been published for this platform.' })
      mkdirSync(join(disk, 'library/stable/darwin-arm64/1.4.0'), { recursive: true })
      writeFileSync(join(disk, 'library/stable/darwin-arm64/1.4.0/Library-1.4.0-arm64.zip'), 'the app')
      const file = await answerUpdateArtifact({ root, channel: 'stable', target: 'darwin-arm64', version: '1.4.0', file: 'Library-1.4.0-arm64.zip' })
      expect(file.status).toBe(200)
      expect(await file.text()).toBe('the app')
    }
    finally {
      Storage.init({})
    }
  })

  test('with both apps declared, the web view app\'s updates are the default and `app` picks the other', () => {
    const webview = { prefix: 'web' }
    const macos = { prefix: 'mac' }
    expect(selectDesktopUpdates({ webview: { updates: webview }, macos: { updates: macos } })).toBe(webview)
    expect(selectDesktopUpdates({ webview: { updates: webview }, macos: { updates: macos } }, 'macos')).toBe(macos)
    expect(selectDesktopUpdates({ webview: {}, macos: { updates: macos } })).toBe(macos)
    expect(selectDesktopUpdates({ macos: { updates: macos } }, 'webview')).toBeUndefined()
    expect(selectDesktopUpdates(null)).toBeUndefined()
  })

  test('two apps on one disk and folder would replace each other\'s Mac release, and are told so', () => {
    expect(desktopUpdatesCollision({ webview: { updates: {} }, macos: { updates: {} } })).toContain('Give one of them its own `prefix`')
    expect(desktopUpdatesCollision({ webview: { updates: { prefix: '/desktop-updates/' } }, macos: { updates: {} } })).toBeString()
    expect(desktopUpdatesCollision({ webview: { updates: {} }, macos: { updates: { prefix: 'library-mac' } } })).toBeUndefined()
    expect(desktopUpdatesCollision({ webview: { updates: { disk: 's3' } }, macos: { updates: {} } })).toBeUndefined()
    expect(desktopUpdatesCollision({ macos: { updates: {} } })).toBeUndefined()
  })
})

describe('an agent app asked for its version', () => {
  test('answers with the host\'s and exits, without starting the agent or taking the instance lock', async () => {
    const dir = temporary()
    const host = join(dir, 'host')
    writeFileSync(host, '#!/bin/sh\necho "craft native macOS renderer test"\n', { mode: 0o755 })
    let started = false
    const code = await runDesktopAgentApp({
      manifest: { appName: 'Library', bundleId: 'com.stacksjs.library', version: '1.4.0', host, nativeBundle: join(dir, 'missing.js'), hostArguments: [] },
      handler: async () => { started = true; return async () => new Response('x') },
      paths: { dataDir: dir, lockFile: join(dir, 'lock'), portFile: join(dir, 'port'), logFile: join(dir, 'log') },
      logWhenDetached: false,
      argv: ['--version'],
    })
    expect(code).toBe(0)
    expect(started).toBe(false)
    expect(existsSync(join(dir, 'lock'))).toBe(false)
  })

  test('says so when the host is missing', async () => {
    const dir = temporary()
    const code = await runDesktopAgentApp({
      manifest: { appName: 'Library', bundleId: 'com.stacksjs.library', version: '1.4.0', host: join(dir, 'gone'), nativeBundle: join(dir, 'missing.js'), hostArguments: [] },
      handler: async () => async () => new Response('x'),
      logWhenDetached: false,
      argv: ['--version'],
    })
    expect(code).toBe(1)
  })
})
