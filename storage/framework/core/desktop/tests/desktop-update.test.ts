import type { BeforeDesktopUpdate, DesktopInstallation, InstallDesktopUpdateOptions, UpdateCommandResult } from '../src/update-install'
import type { UpdateStore } from '../src/update-feed'
import type { DesktopUpdateManifest } from '../src/updater'
import { afterEach, describe, expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { publishDesktopUpdate, serveUpdateFeed, updateArtifactKey, updateFeedUrl, updateManifestKey } from '../src/update-feed'
import {
  assertMacosBundleTrusted,
  assertWindowsInstallerTrusted,
  createDesktopUpdater,
  detectInstallation,
  installDesktopUpdate,
  replaceAppImage,
  swapMacosBundle,
  UPDATE_PATH,
  updateRequestHandler,
} from '../src/update-install'
import { describeArtifact, generateUpdateKeypair, signUpdateManifest, updatePublicKey } from '../src/update-signing'
import { checkForDesktopUpdate, stageDesktopUpdate, verifyUpdateManifestSignature } from '../src/updater'

const scratch: string[] = []
function temporary(): string {
  const directory = mkdtempSync(join(tmpdir(), 'stacks-update-'))
  scratch.push(directory)
  return directory
}
afterEach(() => {
  for (const directory of scratch.splice(0)) rmSync(directory, { recursive: true, force: true })
})

const revision = 'a'.repeat(40)
const keys = generateUpdateKeypair('main')

function unsigned(overrides: Partial<DesktopUpdateManifest> = {}) {
  return { version: '0.4.0', url: 'https://updates.example.com/a.zip', sha256: 'b'.repeat(64), size: 10, sourceRevision: revision, platform: 'darwin', architecture: 'arm64', publishedAt: '2026-11-11T00:00:00.000Z', ...overrides }
}

function memoryStore(base = 'https://cdn.example.com'): UpdateStore & { files: Map<string, string | Uint8Array> } {
  const files = new Map<string, string | Uint8Array>()
  return {
    files,
    read: async key => files.has(key) ? String(files.get(key)) : null,
    write: async (key, contents) => { files.set(key, contents) },
    publicUrl: async key => `${base}/${key}`,
  }
}

describe('the update keypair', () => {
  test('is Ed25519, in the encodings the app and the release read', () => {
    const pair = generateUpdateKeypair('release-2026')
    expect(pair.keyId).toBe('release-2026')
    expect(pair.publicKey).toStartWith('ed25519-public:')
    expect(pair.privateKey).toStartWith('ed25519-private:')
    expect(updatePublicKey(pair.privateKey)).toBe(pair.publicKey)
    expect(generateUpdateKeypair().privateKey).not.toBe(pair.privateKey)
  })

  test('a key id that could not be a manifest field is refused', () => {
    expect(() => generateUpdateKeypair('has space')).toThrow('key id')
  })

  test('a public key, or anything else, is not a private key', () => {
    expect(() => signUpdateManifest(unsigned(), keys.publicKey)).toThrow('ed25519-private:')
    expect(() => signUpdateManifest(unsigned(), 'ed25519-private:AAAA')).toThrow('could not be read')
  })
})

describe('signing and verifying a manifest', () => {
  test('what is signed verifies against the public key', () => {
    const manifest = signUpdateManifest(unsigned(), keys.privateKey, 'main')
    expect(manifest.signingKeyId).toBe('main')
    expect(() => verifyUpdateManifestSignature(manifest, { main: keys.publicKey })).not.toThrow()
  })

  test('every signed field is covered: changing any one breaks the signature', () => {
    const manifest = signUpdateManifest(unsigned({ notes: 'Fixes.' }), keys.privateKey)
    const tampered: Array<Partial<DesktopUpdateManifest>> = [
      { version: '9.9.9' },
      { url: 'https://evil.example/a.zip' },
      { sha256: 'c'.repeat(64) },
      { size: 11 },
      { sourceRevision: 'd'.repeat(40) },
      { platform: 'linux' },
      { architecture: 'x64' },
      { publishedAt: '2027-01-01T00:00:00.000Z' },
      { notes: 'Fixes. Also installs a miner.' },
    ]
    for (const change of tampered)
      expect(() => verifyUpdateManifestSignature({ ...manifest, ...change }, { main: keys.publicKey })).toThrow('signature verification failed')
  })

  test('a manifest signed with another key is refused, even under the trusted key\'s id', () => {
    const other = generateUpdateKeypair('main')
    const forged = signUpdateManifest(unsigned(), other.privateKey, 'main')
    expect(() => verifyUpdateManifestSignature(forged, { main: keys.publicKey })).toThrow('signature verification failed')
  })

  test('a key id the app does not trust is refused', () => {
    const manifest = signUpdateManifest(unsigned(), keys.privateKey, 'rotated')
    expect(() => verifyUpdateManifestSignature(manifest, { main: keys.publicKey })).toThrow('not trusted: rotated')
  })

  test('a check refuses a tampered manifest from the feed, and one for another machine', async () => {
    const manifest = signUpdateManifest(unsigned(), keys.privateKey)
    const serve = (body: unknown) => async () => Response.json(body)
    const options = { currentVersion: '0.3.0', manifestUrl: 'https://example.com/api/updates/darwin/arm64', trustedKeys: { main: keys.publicKey }, target: { platform: 'darwin', architecture: 'arm64' } }
    expect((await checkForDesktopUpdate({ ...options, fetcher: serve(manifest) }))?.version).toBe('0.4.0')
    expect(await checkForDesktopUpdate({ ...options, currentVersion: '0.4.0', fetcher: serve(manifest) })).toBeNull()
    expect(checkForDesktopUpdate({ ...options, fetcher: serve({ ...manifest, url: 'https://evil.example/a.zip' }) })).rejects.toThrow('signature verification failed')
    expect(checkForDesktopUpdate({ ...options, target: { platform: 'linux', architecture: 'x64' }, fetcher: serve(manifest) })).rejects.toThrow('not this app\'s linux-x64')
    expect(await checkForDesktopUpdate({ ...options, fetcher: async () => new Response(null, { status: 204 }) })).toBeNull()
  })
})

describe('publishing and the feed', () => {
  test('keys are per channel, platform and architecture, and artifacts are per version', () => {
    expect(updateManifestKey({ platform: 'darwin', architecture: 'arm64' })).toBe('desktop-updates/stable/darwin-arm64/latest.json')
    expect(updateManifestKey({ platform: 'win32', architecture: 'x64', channel: 'beta', prefix: '/fettler/updates/' })).toBe('fettler/updates/beta/win32-x64/latest.json')
    expect(updateArtifactKey({ platform: 'linux', architecture: 'x64' }, '0.4.0', 'Fettler-0.4.0-x86_64.AppImage')).toBe('desktop-updates/stable/linux-x64/0.4.0/Fettler-0.4.0-x86_64.AppImage')
    expect(() => updateManifestKey({ platform: 'plan9', architecture: 'x64' })).toThrow('Unknown desktop platform')
    expect(() => updateManifestKey({ platform: 'darwin', architecture: '../x' })).toThrow('architecture')
    expect(() => updateManifestKey({ platform: 'darwin', architecture: 'x64', channel: '../../etc' })).toThrow('channel')
    expect(() => updateArtifactKey({ platform: 'darwin', architecture: 'x64' }, '0.4.0', '../a.zip')).toThrow('Invalid artifact name')
  })

  test('the app asks <feed>/<platform>/<arch> and says what it runs', () => {
    expect(updateFeedUrl('https://fettler.org/api/updates/', { platform: 'darwin', architecture: 'arm64' }, { currentVersion: '0.3.0' })).toBe('https://fettler.org/api/updates/darwin/arm64?current=0.3.0')
    expect(updateFeedUrl('https://fettler.org/api/updates', { platform: 'win32', architecture: 'x64' }, { channel: 'beta' })).toBe('https://fettler.org/api/updates/win32/x64?channel=beta')
  })

  test('a published update is the artifact, then a signed manifest that describes it', async () => {
    const store = memoryStore()
    const artifact = join(temporary(), 'Fettler-0.4.0.zip')
    writeFileSync(artifact, 'the app, zipped')
    expect(await describeArtifact(artifact)).toEqual({ size: 15, sha256: createHash('sha256').update('the app, zipped').digest('hex') })

    const manifest = await publishDesktopUpdate({ store, artifact, version: '0.4.0', sourceRevision: revision, privateKey: keys.privateKey, platform: 'darwin', architecture: 'arm64', notes: 'Faster.' })
    expect([...store.files.keys()]).toEqual(['desktop-updates/stable/darwin-arm64/0.4.0/Fettler-0.4.0.zip', 'desktop-updates/stable/darwin-arm64/latest.json'])
    expect(manifest.url).toBe('https://cdn.example.com/desktop-updates/stable/darwin-arm64/0.4.0/Fettler-0.4.0.zip')
    expect(manifest.size).toBe(15)
    expect(() => verifyUpdateManifestSignature(manifest, { main: keys.publicKey })).not.toThrow()

    const elsewhere = await publishDesktopUpdate({ store, artifact, version: '0.4.0', sourceRevision: revision, privateKey: keys.privateKey, platform: 'linux', architecture: 'x64', artifactBaseUrl: 'https://downloads.fettler.org/' })
    expect(elsewhere.url).toBe('https://downloads.fettler.org/desktop-updates/stable/linux-x64/0.4.0/Fettler-0.4.0.zip')
  })

  test('the feed serves what was published, verbatim, and the app accepts it', async () => {
    const store = memoryStore()
    const artifact = join(temporary(), 'Fettler.zip')
    writeFileSync(artifact, 'bytes')
    await publishDesktopUpdate({ store, artifact, version: '0.4.0', sourceRevision: revision, privateKey: keys.privateKey, platform: 'darwin', architecture: 'arm64' })

    const response = await serveUpdateFeed({ store, platform: 'darwin', architecture: 'arm64', currentVersion: '0.3.9' })
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    const found = await checkForDesktopUpdate({ currentVersion: '0.3.9', manifestUrl: 'https://x.example/api/updates/darwin/arm64', trustedKeys: { main: keys.publicKey }, target: { platform: 'darwin', architecture: 'arm64' }, fetcher: async () => response })
    expect(found?.version).toBe('0.4.0')
  })

  test('204 for an app already on that version or newer; 404 where nothing was published', async () => {
    const store = memoryStore()
    const artifact = join(temporary(), 'Fettler.zip')
    writeFileSync(artifact, 'bytes')
    await publishDesktopUpdate({ store, artifact, version: '0.4.0', sourceRevision: revision, privateKey: keys.privateKey, platform: 'darwin', architecture: 'arm64' })
    expect((await serveUpdateFeed({ store, platform: 'darwin', architecture: 'arm64', currentVersion: '0.4.0' })).status).toBe(204)
    expect((await serveUpdateFeed({ store, platform: 'darwin', architecture: 'arm64', currentVersion: '0.5.0' })).status).toBe(204)
    expect((await serveUpdateFeed({ store, platform: 'darwin', architecture: 'arm64', currentVersion: 'garbage' })).status).toBe(200)
    expect((await serveUpdateFeed({ store, platform: 'darwin', architecture: 'x64' })).status).toBe(404)
    expect((await serveUpdateFeed({ store, platform: 'darwin', architecture: 'arm64', channel: 'beta' })).status).toBe(404)
    expect((await serveUpdateFeed({ store, platform: 'beos', architecture: 'arm64' })).status).toBe(404)
    expect((await serveUpdateFeed({ store, platform: 'darwin', architecture: '..%2f..' })).status).toBe(404)
  })

  test('a stored manifest that is not one is a server error, not something to hand an app', async () => {
    const store = memoryStore()
    store.files.set('desktop-updates/stable/darwin-arm64/latest.json', '{"version":"nope"}')
    expect((await serveUpdateFeed({ store, platform: 'darwin', architecture: 'arm64' })).status).toBe(500)
  })
})

describe('how a copy was installed', () => {
  test('by where its executable is', () => {
    expect(detectInstallation({ platform: 'darwin', execPath: '/Applications/Fettler.app/Contents/MacOS/Fettler', env: {} })).toEqual({ kind: 'macos-bundle', path: '/Applications/Fettler.app', executable: '/Applications/Fettler.app/Contents/MacOS/Fettler' })
    expect(detectInstallation({ platform: 'darwin', execPath: '/tmp/fettler', env: {} }).kind).toBe('unmanaged')
    expect(detectInstallation({ platform: 'win32', execPath: 'C:\\Program Files\\Fettler\\Fettler.exe', env: {} }).kind).toBe('windows-msi')
    expect(detectInstallation({ platform: 'linux', execPath: '/tmp/.mount_FettlXYZ/usr/bin/fettler', env: { APPIMAGE: '/home/x/Apps/Fettler.AppImage' } })).toEqual({ kind: 'linux-appimage', path: '/home/x/Apps/Fettler.AppImage', executable: '/home/x/Apps/Fettler.AppImage' })
    expect(detectInstallation({ platform: 'linux', execPath: '/usr/bin/fettler', env: {} }).kind).toBe('linux-package')
    expect(detectInstallation({ platform: 'linux', execPath: '/home/x/build/fettler', env: {} }).kind).toBe('unmanaged')
    expect(detectInstallation({ platform: 'darwin', execPath: '/Users/x/.bun/bin/bun', env: {} }).kind).toBe('unmanaged')
  })
})

/** A `.app` on disk with a marker saying which version it is. */
function fixtureBundle(directory: string, name: string, version: string): string {
  const bundle = join(directory, name)
  mkdirSync(join(bundle, 'Contents', 'MacOS'), { recursive: true })
  writeFileSync(join(bundle, 'Contents', 'MacOS', 'Fettler'), `#!/bin/sh\necho ${version}\n`, { mode: 0o755 })
  writeFileSync(join(bundle, 'Contents', 'Info.plist'), `<plist><string>${version}</string></plist>`)
  return bundle
}

/** A stand-in for codesign: who signed each bundle, and whether its seal is intact. */
function codesign(signers: Record<string, { team?: string, identifier?: string, broken?: boolean }>): (command: string[]) => UpdateCommandResult {
  return (command) => {
    const target = command.at(-1)!
    const signer = Object.entries(signers).find(([suffix]) => target.endsWith(suffix))?.[1] ?? {}
    if (command.includes('--verify')) return signer.broken ? { exitCode: 1, stdout: '', stderr: 'a sealed resource is missing or invalid' } : { exitCode: 0, stdout: '', stderr: '' }
    return { exitCode: 0, stdout: '', stderr: `Identifier=${signer.identifier ?? 'org.fettler.app'}\nTeamIdentifier=${signer.team ?? 'not set'}\n` }
  }
}

describe('macOS: swapping the bundle', () => {
  function staged(version = '0.4.0', name = 'Fettler.app'): { archive: string, extract: (archive: string, into: string) => void } {
    const source = fixtureBundle(temporary(), name, version)
    // The archive's contents, unpacked the way ditto would: the bundle at the top level.
    return { archive: `${source}.zip`, extract: (_archive, into) => cpSync(source, join(into, name), { recursive: true }) }
  }

  test('a bundle from the same team replaces the running one, and nothing is left behind', () => {
    const applications = temporary()
    const bundle = fixtureBundle(applications, 'Fettler.app', '0.3.0')
    swapMacosBundle({ ...staged(), bundle, run: codesign({ 'Fettler.app': { team: 'ABCDE12345' } }) })
    expect(readFileSync(join(bundle, 'Contents', 'MacOS', 'Fettler'), 'utf8')).toContain('0.4.0')
    expect(statSync(join(bundle, 'Contents', 'MacOS', 'Fettler')).mode & 0o111).toBe(0o111)
    expect(readdirSync(applications)).toEqual(['Fettler.app'])
  })

  test('a bundle signed by another team is refused and the running app is untouched', () => {
    const applications = temporary()
    const bundle = fixtureBundle(applications, 'Fettler.app', '0.3.0')
    const run = (command: string[]): UpdateCommandResult => codesign({ [`${applications}/Fettler.app`]: { team: 'ABCDE12345' }, 'Fettler.app': { team: 'EVIL000000' } })(command)
    expect(() => swapMacosBundle({ ...staged(), bundle, run })).toThrow('signed by EVIL000000, not by this app\'s team ABCDE12345')
    expect(readFileSync(join(bundle, 'Contents', 'MacOS', 'Fettler'), 'utf8')).toContain('0.3.0')
    expect(readdirSync(applications)).toEqual(['Fettler.app'])
  })

  test('a broken seal, an unsigned update, or a different app is refused', () => {
    const bundle = fixtureBundle(temporary(), 'Fettler.app', '0.3.0')
    const next = fixtureBundle(temporary(), 'Next.app', '0.4.0')
    const team = 'ABCDE12345'
    expect(() => assertMacosBundleTrusted(bundle, next, { run: codesign({ 'Fettler.app': { team }, 'Next.app': { team, broken: true } }) })).toThrow('signature is not valid')
    expect(() => assertMacosBundleTrusted(bundle, next, { run: codesign({ 'Fettler.app': { team }, 'Next.app': {} }) })).toThrow('signed by no one')
    expect(() => assertMacosBundleTrusted(bundle, next, { run: codesign({ 'Fettler.app': { team }, 'Next.app': { team, identifier: 'org.other.app' } }) })).toThrow('a different app (org.other.app)')
    expect(() => assertMacosBundleTrusted(bundle, next, { run: codesign({ 'Fettler.app': { team }, 'Next.app': { team } }) })).not.toThrow()
  })

  test('an ad hoc running app has no signer to compare with, so it is replaced only when told to', () => {
    const applications = temporary()
    const bundle = fixtureBundle(applications, 'Fettler.app', '0.3.0')
    expect(() => swapMacosBundle({ ...staged(), bundle, run: codesign({}) })).toThrow('not signed with a Developer ID')
    expect(readFileSync(join(bundle, 'Contents', 'MacOS', 'Fettler'), 'utf8')).toContain('0.3.0')
    swapMacosBundle({ ...staged(), bundle, run: codesign({}), allowUnsigned: true })
    expect(readFileSync(join(bundle, 'Contents', 'MacOS', 'Fettler'), 'utf8')).toContain('0.4.0')
  })

  test('an archive that is not exactly one app is refused', () => {
    const applications = temporary()
    const bundle = fixtureBundle(applications, 'Fettler.app', '0.3.0')
    expect(() => swapMacosBundle({ archive: 'x.zip', bundle, extract: () => {}, run: codesign({}) })).toThrow('holds 0 apps')
    expect(readdirSync(applications)).toEqual(['Fettler.app'])
  })

  test('a real zip made by ditto unpacks and swaps', () => {
    if (process.platform !== 'darwin') return
    const applications = temporary()
    const bundle = fixtureBundle(applications, 'Fettler.app', '0.3.0')
    const source = fixtureBundle(temporary(), 'Fettler.app', '0.4.0')
    const archive = join(temporary(), 'Fettler.zip')
    expect(Bun.spawnSync(['ditto', '-c', '-k', '--keepParent', source, archive]).exitCode).toBe(0)
    swapMacosBundle({ archive, bundle, run: codesign({ 'Fettler.app': { team: 'ABCDE12345' } }) })
    expect(readFileSync(join(bundle, 'Contents', 'MacOS', 'Fettler'), 'utf8')).toContain('0.4.0')
    expect(statSync(join(bundle, 'Contents', 'MacOS', 'Fettler')).mode & 0o111).toBe(0o111)
  })

  test('installing relaunches through LaunchServices and waits for this process', () => {
    const applications = temporary()
    const bundle = fixtureBundle(applications, 'Fettler.app', '0.3.0')
    const spawned: string[][] = []
    const { archive, extract } = staged()
    const result = installDesktopUpdate({
      staged: archive,
      extract,
      manifest: { version: '0.4.0', url: 'https://x.example/a.zip' },
      installation: { kind: 'macos-bundle', path: bundle, executable: join(bundle, 'Contents', 'MacOS', 'Fettler') },
      run: codesign({ 'Fettler.app': { team: 'ABCDE12345' } }),
      spawn: command => spawned.push(command),
      pid: 4242,
    })
    expect(result.status).toBe('installed')
    expect(spawned).toEqual([])
    if (result.status === 'installed') result.relaunch()
    expect(spawned).toEqual([['open', '-n', bundle, '--args', '--wait-pid=4242']])
  })
})

describe('Linux: replacing the AppImage', () => {
  test('the staged image takes the old one\'s place, executable, with no leftovers', () => {
    const directory = temporary()
    const appImage = join(directory, 'Fettler.AppImage')
    writeFileSync(appImage, 'old image', { mode: 0o755 })
    const staged = join(temporary(), 'update.AppImage')
    writeFileSync(staged, 'new image', { mode: 0o600 })
    replaceAppImage(staged, appImage)
    expect(readFileSync(appImage, 'utf8')).toBe('new image')
    expect(statSync(appImage).mode & 0o111).toBe(0o111)
    expect(readdirSync(directory)).toEqual(['Fettler.AppImage'])
  })

  test('a staged file that is gone leaves the running image alone', () => {
    const directory = temporary()
    const appImage = join(directory, 'Fettler.AppImage')
    writeFileSync(appImage, 'old image')
    expect(() => replaceAppImage(join(directory, 'missing'), appImage)).toThrow()
    expect(readFileSync(appImage, 'utf8')).toBe('old image')
    expect(readdirSync(directory)).toEqual(['Fettler.AppImage'])
  })

  test('installing relaunches the image itself', () => {
    const appImage = join(temporary(), 'Fettler.AppImage')
    writeFileSync(appImage, 'old image')
    const staged = join(temporary(), 'update.AppImage')
    writeFileSync(staged, 'new image')
    const spawned: string[][] = []
    const result = installDesktopUpdate({ staged, manifest: { version: '0.4.0', url: 'https://x.example/a' }, installation: { kind: 'linux-appimage', path: appImage, executable: appImage }, spawn: command => spawned.push(command), pid: 7 })
    expect(result.status).toBe('installed')
    if (result.status === 'installed') result.relaunch()
    expect(spawned).toEqual([[appImage, '--wait-pid=7']])
  })

  test('a deb or rpm install is told a version exists, and nothing is run', () => {
    const spawned: string[][] = []
    const result = installDesktopUpdate({ staged: '', appName: 'Fettler', manifest: { version: '0.4.0', url: 'https://downloads.fettler.org/x/Fettler.AppImage' }, installation: { kind: 'linux-package', executable: '/usr/bin/fettler' }, spawn: command => spawned.push(command) })
    expect(result).toEqual({ status: 'notice', message: 'Fettler 0.4.0 is available. This copy was installed as a system package: update it with your package manager, or download the new package from https://downloads.fettler.org.' })
    expect(spawned).toEqual([])
  })
})

describe('Windows: running the MSI', () => {
  /** A stand-in for Get-AuthenticodeSignature. */
  function authenticode(signers: Record<string, { status: string, subject?: string }>): (command: string[]) => UpdateCommandResult {
    return (command) => {
      const script = command.at(-1)!
      const signer = Object.entries(signers).find(([file]) => script.includes(file))?.[1] ?? { status: 'NotSigned' }
      return { exitCode: 0, stdout: `${signer.status}\r\n${signer.subject ?? ''}\r\n`, stderr: '' }
    }
  }
  const installation: DesktopInstallation = { kind: 'windows-msi', executable: 'C:\\Program Files\\Fettler\\Fettler.exe' }
  const publisher = 'CN=Stacks.js, O=Stacks.js, C=US'

  test('the installer runs detached, then starts the new version once this one is gone', () => {
    const spawned: string[][] = []
    const result = installDesktopUpdate({ staged: 'C:\\Users\\x\\AppData\\Roaming\\Fettler\\updates\\0.4.0\\update.msi', manifest: { version: '0.4.0', url: 'https://x.example/a.msi' }, installation, run: authenticode({ 'Fettler.exe': { status: 'Valid', subject: publisher }, 'update.msi': { status: 'Valid', subject: publisher } }), spawn: command => spawned.push(command), pid: 99 })
    expect(result).toEqual({ status: 'installing' })
    expect(spawned).toHaveLength(1)
    expect(spawned[0]!.slice(0, 4)).toEqual(['cmd.exe', '/d', '/s', '/c'])
    expect(spawned[0]![4]).toBe('msiexec /i "C:\\Users\\x\\AppData\\Roaming\\Fettler\\updates\\0.4.0\\update.msi" /passive /norestart && start "" "C:\\Program Files\\Fettler\\Fettler.exe" --wait-pid=99')
  })

  test('a signed app refuses an installer that is unsigned or from another publisher', () => {
    const spawned: string[][] = []
    const options = { staged: 'C:\\u\\update.msi', manifest: { version: '0.4.0', url: 'https://x.example/a.msi' }, installation, spawn: (command: string[]) => { spawned.push(command) } }
    expect(() => installDesktopUpdate({ ...options, run: authenticode({ 'Fettler.exe': { status: 'Valid', subject: publisher } }) })).toThrow('not validly signed')
    expect(() => installDesktopUpdate({ ...options, run: authenticode({ 'Fettler.exe': { status: 'Valid', subject: publisher }, 'update.msi': { status: 'HashMismatch', subject: publisher } }) })).toThrow('not validly signed')
    expect(() => installDesktopUpdate({ ...options, run: authenticode({ 'Fettler.exe': { status: 'Valid', subject: publisher }, 'update.msi': { status: 'Valid', subject: 'CN=Someone Else' } }) })).toThrow('signed by CN=Someone Else')
    expect(spawned).toEqual([])
  })

  test('an unsigned app relies on the manifest alone, unless told not to', () => {
    expect(() => assertWindowsInstallerTrusted('C:\\F\\Fettler.exe', 'C:\\u\\update.msi', { run: authenticode({}) })).not.toThrow()
    expect(() => assertWindowsInstallerTrusted('C:\\F\\Fettler.exe', 'C:\\u\\update.msi', { run: authenticode({}), allowUnsigned: false })).toThrow('not Authenticode-signed')
  })
})

describe('the updater an agent holds', () => {
  const artifactBytes = new TextEncoder().encode('new version bytes')
  const target = { platform: 'darwin', architecture: 'arm64' }
  function release(version = '0.4.0'): DesktopUpdateManifest {
    return signUpdateManifest(unsigned({ version, url: 'https://cdn.example.com/Fettler.zip', size: artifactBytes.byteLength, sha256: createHash('sha256').update(artifactBytes).digest('hex'), notes: 'Faster.' }), keys.privateKey)
  }
  function fetcher(manifest: DesktopUpdateManifest | null, seen: string[] = []) {
    return async (input: string | URL | Request): Promise<Response> => {
      const url = String(input)
      seen.push(url)
      if (url.includes('/api/updates/')) return manifest ? Response.json(manifest) : new Response(null, { status: 204 })
      return new Response(artifactBytes)
    }
  }
  function updater(overrides: Partial<Parameters<typeof createDesktopUpdater>[0]> = {}) {
    const installs: InstallDesktopUpdateOptions[] = []
    const relaunched: string[] = []
    const made = createDesktopUpdater({
      appName: 'Fettler',
      currentVersion: '0.3.0',
      feedUrl: 'https://fettler.org/api/updates',
      trustedKeys: { main: keys.publicKey },
      updatesDir: join(temporary(), 'updates'),
      target,
      fetcher: fetcher(release()),
      installation: { kind: 'macos-bundle', path: '/Applications/Fettler.app', executable: '/Applications/Fettler.app/Contents/MacOS/Fettler' },
      install: (options) => {
        installs.push({ ...options, staged: existsSync(options.staged) ? readFileSync(options.staged, 'utf8') : options.staged })
        return { status: 'installed', relaunch: () => relaunched.push('relaunch') }
      },
      ...overrides,
    })
    return { updater: made, installs, relaunched }
  }

  test('check, install, relaunch', async () => {
    const seen: string[] = []
    const { updater: made, installs, relaunched } = updater({ fetcher: fetcher(release(), seen) })
    expect(made.status()).toMatchObject({ state: 'idle', currentVersion: '0.3.0', selfUpdating: true, installKind: 'macos-bundle' })
    expect(await made.check()).toMatchObject({ state: 'available', version: '0.4.0', notes: 'Faster.' })
    expect(seen[0]).toBe('https://fettler.org/api/updates/darwin/arm64?current=0.3.0')
    expect(await made.install()).toMatchObject({ state: 'installed', version: '0.4.0' })
    // What was handed to the installer is the verified download.
    expect(installs[0]!.staged).toBe('new version bytes')
    expect(relaunched).toEqual([])
    await made.relaunchIfInstalled()
    await made.relaunchIfInstalled()
    expect(relaunched).toEqual(['relaunch'])
    // The next check does not look again or undo the state.
    expect((await made.check()).state).toBe('installed')
  })

  test('nothing newer is "current"; a failing feed is an error state, not a throw', async () => {
    expect((await updater({ fetcher: fetcher(null) }).updater.check()).state).toBe('current')
    const failing = updater({ fetcher: async () => new Response('down', { status: 503 }) }).updater
    expect(await failing.check()).toMatchObject({ state: 'error', error: 'Desktop update check failed with HTTP 503' })
  })

  test('a manifest signed by someone else never becomes available', async () => {
    const forged = signUpdateManifest(unsigned({ version: '9.0.0' }), generateUpdateKeypair().privateKey)
    const { updater: made, installs } = updater({ fetcher: fetcher(forged) })
    expect(await made.check()).toMatchObject({ state: 'error', error: 'Desktop update manifest signature verification failed' })
    expect((await made.install()).error).toContain('no update to install')
    expect(installs).toEqual([])
  })

  test('a download that does not match its manifest is not installed', async () => {
    const { updater: made, installs } = updater({
      fetcher: async (input) => String(input).includes('/api/updates/') ? Response.json(release()) : new Response('something else entirely'),
    })
    await made.check()
    expect(await made.install()).toMatchObject({ state: 'error' })
    expect(installs).toEqual([])
  })

  test('the app can refuse an update', async () => {
    const seen: Array<[string, string]> = []
    const beforeUpdate: BeforeDesktopUpdate = (manifest, current) => {
      seen.push([manifest.version, current.version])
      return { refuse: 'This build needs macOS 15.' }
    }
    const { updater: made, installs } = updater({ beforeUpdate })
    expect(await made.check()).toMatchObject({ state: 'refused', message: 'This build needs macOS 15.', version: '0.4.0' })
    expect(seen).toEqual([['0.4.0', '0.3.0']])
    expect((await made.install()).state).toBe('error')
    expect(installs).toEqual([])
  })

  test('the app can warn first: the update waits for the person to say yes', async () => {
    const warning = 'Your license covers updates until 0.3. Version 0.4.0 would run as the free tier.'
    const { updater: made, installs } = updater({ beforeUpdate: async () => ({ warn: warning }) })
    expect(await made.check()).toMatchObject({ state: 'available', warning })
    expect(await made.install()).toMatchObject({ state: 'error', error: warning })
    expect(installs).toEqual([])
    await made.check()
    expect((await made.install({ acknowledge: true })).state).toBe('installed')
    expect(installs).toHaveLength(1)
  })

  test('a package-manager install downloads nothing and gets the notice', async () => {
    const seen: string[] = []
    const made = createDesktopUpdater({ appName: 'Fettler', currentVersion: '0.3.0', feedUrl: 'https://fettler.org/api/updates', trustedKeys: { main: keys.publicKey }, updatesDir: join(temporary(), 'updates'), target, fetcher: fetcher(release(), seen), installation: { kind: 'linux-package', executable: '/usr/bin/fettler' } })
    expect(await made.check()).toMatchObject({ state: 'available', selfUpdating: false })
    const after = await made.install()
    expect(after.message).toContain('update it with your package manager')
    expect(seen).toHaveLength(1)
  })

  test('the window reads and drives it at /__desktop/update', async () => {
    const { updater: made } = updater()
    const handle = updateRequestHandler(made)
    const at = `http://127.0.0.1:1${UPDATE_PATH}`
    expect(await handle(new Request('http://127.0.0.1:1/other'))).toBeUndefined()
    expect(await (await handle(new Request(at)))!.json()).toMatchObject({ state: 'idle' })
    const post = (body: unknown) => handle(new Request(at, { method: 'POST', body: JSON.stringify(body) }))
    expect(await (await post({ action: 'check' }))!.json()).toMatchObject({ state: 'available', version: '0.4.0' })
    expect(await (await post({ action: 'install' }))!.json()).toMatchObject({ state: 'installed' })
    expect((await post({ action: 'format-disk' }))!.status).toBe(400)
    expect((await handle(new Request(at, { method: 'DELETE' })))!.status).toBe(405)
  })

  test('staging is what the real install would be given', async () => {
    const manifest = release()
    const destination = join(temporary(), 'update.zip')
    const staged = await stageDesktopUpdate(manifest, destination, async () => new Response(artifactBytes), { main: keys.publicKey }, target)
    expect(staged.bytes).toBe(artifactBytes.byteLength)
    expect(readFileSync(destination, 'utf8')).toBe('new version bytes')
  })
})
