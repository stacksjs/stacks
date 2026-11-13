import type { WebviewBuildRecord } from '../src/webview-build-record'
import { afterEach, describe, expect, test } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { releaseArtifactFormat, releaseArtifactNames, resignWebviewMacosApp, signingIdentityNote } from '../src/webview-app'
import { describeBuildArtifact, findPackagedInstallers, importWebviewBuild, mergeBuildRecord, recordPackagedInstallers } from '../src/webview-build-record'

const scratch: string[] = []
function temporary(): string {
  const directory = mkdtempSync(join(tmpdir(), 'stacks-build-record-'))
  scratch.push(directory)
  return directory
}
afterEach(() => {
  for (const directory of scratch.splice(0)) rmSync(directory, { recursive: true, force: true })
})

const HEAD = 'a'.repeat(40)
const app = { appId: 'app.tinkerbelle', version: '0.2.2', sourceRevision: HEAD, host: 'darwin-arm64' }

/** What a CI runner's `buddy build:desktop --target linux-x64,win32-x64 --package` leaves: the Linux installers made, the Windows folder only staged. */
function ciBuild(overrides: Partial<WebviewBuildRecord> = {}): string {
  const output = temporary()
  mkdirSync(join(output, 'linux-x64/packages'), { recursive: true })
  mkdirSync(join(output, 'win32-x64'), { recursive: true })
  writeFileSync(join(output, 'linux-x64/tinkerbelle'), 'ELF agent')
  writeFileSync(join(output, 'linux-x64/packages/TinkerBelle-0.2.2.AppImage'), 'AppImage bytes')
  writeFileSync(join(output, 'linux-x64/packages/tinkerbelle_0.2.2_amd64.deb'), 'deb bytes')
  writeFileSync(join(output, 'win32-x64/TinkerBelle.exe'), 'MZ agent')
  writeFileSync(join(output, 'win32-x64/craft-package.json'), '{}')
  const record: WebviewBuildRecord = {
    appName: 'TinkerBelle',
    appId: app.appId,
    version: app.version,
    sourceRevision: HEAD,
    builtOn: 'linux-x64',
    bun: '1.4.4',
    targets: [
      { target: 'linux-x64', directory: 'linux-x64', artifacts: ['tinkerbelle', 'packages/TinkerBelle-0.2.2.AppImage', 'packages/tinkerbelle_0.2.2_amd64.deb'].map(name => describeBuildArtifact(join(output, 'linux-x64'), name)) },
      { target: 'win32-x64', directory: 'win32-x64', artifacts: ['TinkerBelle.exe', 'craft-package.json'].map(name => describeBuildArtifact(join(output, 'win32-x64'), name)), remaining: 'The MSI is made on Windows.' },
    ],
    ...overrides,
  }
  writeFileSync(join(output, 'build.json'), JSON.stringify(record))
  return output
}

function macBuild(): string {
  const output = temporary()
  mkdirSync(join(output, 'darwin-arm64/TinkerBelle.app'), { recursive: true })
  const record: WebviewBuildRecord = { appName: 'TinkerBelle', appId: app.appId, version: app.version, sourceRevision: HEAD, builtOn: 'darwin-arm64', bun: '1.4.4', targets: [{ target: 'darwin-arm64', directory: 'darwin-arm64', artifacts: [{ name: 'TinkerBelle.app' }] }] }
  writeFileSync(join(output, 'build.json'), JSON.stringify(record))
  return output
}

const read = (output: string): WebviewBuildRecord => JSON.parse(readFileSync(join(output, 'build.json'), 'utf8')) as WebviewBuildRecord

describe('importing targets built on another machine', () => {
  test('adds them to the local record beside what was built here, files and all', () => {
    const output = macBuild()
    const result = importWebviewBuild({ from: ciBuild(), output, ...app })
    expect(result.imported.map(item => item.target)).toEqual(['linux-x64', 'win32-x64'])
    const record = read(output)
    expect(record.targets.map(item => item.target)).toEqual(['darwin-arm64', 'linux-x64', 'win32-x64'])
    expect(record.builtOn).toBe('darwin-arm64')
    const linux = record.targets.find(item => item.target === 'linux-x64')!
    expect(linux.builtOn).toBe('linux-x64')
    expect(linux.artifacts.map(artifact => artifact.name)).toContain('packages/TinkerBelle-0.2.2.AppImage')
    // What a release looks for is there, where the record says.
    expect(readFileSync(join(output, 'linux-x64/packages/TinkerBelle-0.2.2.AppImage'), 'utf8')).toBe('AppImage bytes')
    expect(existsSync(join(output, 'darwin-arm64/TinkerBelle.app'))).toBe(true)
  })

  test('takes one target, by --target or by pointing at its folder', () => {
    const from = ciBuild()
    const byFlag = macBuild()
    expect(importWebviewBuild({ from, output: byFlag, ...app, targets: ['linux-x64'] }).imported.map(item => item.target)).toEqual(['linux-x64'])
    expect(read(byFlag).targets.map(item => item.target)).toEqual(['darwin-arm64', 'linux-x64'])
    const byFolder = macBuild()
    expect(importWebviewBuild({ from: join(from, 'win32-x64'), output: byFolder, ...app }).imported.map(item => item.target)).toEqual(['win32-x64'])
    expect(() => importWebviewBuild({ from, output: macBuild(), ...app, targets: ['linux-arm64'] })).toThrow('lists none of the targets asked for')
  })

  test('a target the record lists but whose folder was not carried over is left out, unless it was asked for', () => {
    const from = ciBuild()
    rmSync(join(from, 'win32-x64'), { recursive: true })
    const output = macBuild()
    const result = importWebviewBuild({ from, output, ...app })
    expect(result.imported.map(item => item.target)).toEqual(['linux-x64'])
    expect(result.skipped).toEqual(['win32-x64'])
    expect(() => importWebviewBuild({ from, output, ...app, targets: ['win32-x64'] })).toThrow('is not beside')
  })

  test('refuses a build of another commit, version or app, and a file that is not the one that was built', () => {
    const output = macBuild()
    expect(() => importWebviewBuild({ from: ciBuild({ sourceRevision: 'b'.repeat(40) }), output, ...app })).toThrow('A release is one commit')
    expect(() => importWebviewBuild({ from: ciBuild({ version: '0.2.1' }), output, ...app })).toThrow('is version 0.2.1')
    expect(() => importWebviewBuild({ from: ciBuild({ appId: 'app.other' }), output, ...app })).toThrow('is a build of app.other')

    const tampered = ciBuild()
    writeFileSync(join(tampered, 'linux-x64/packages/TinkerBelle-0.2.2.AppImage'), 'other bytes!!!')
    expect(() => importWebviewBuild({ from: tampered, output, ...app })).toThrow('is not the file that was built')
    const missing = ciBuild()
    rmSync(join(missing, 'win32-x64/TinkerBelle.exe'))
    expect(() => importWebviewBuild({ from: missing, output, ...app })).toThrow('is in the record but not in')
    expect(() => importWebviewBuild({ from: temporary(), output, ...app })).toThrow('has no build.json')

    // Nothing was copied by any of the refusals.
    expect(read(output).targets.map(item => item.target)).toEqual(['darwin-arm64'])
    expect(existsSync(join(output, 'linux-x64'))).toBe(false)
  })

  test('a record cannot point outside its own folder', () => {
    const from = ciBuild()
    const record = read(from)
    record.targets[0]!.directory = '../../etc'
    writeFileSync(join(from, 'build.json'), JSON.stringify(record))
    // Never read: left out like a folder that was not carried over, and refused when asked for by name.
    const output = macBuild()
    expect(importWebviewBuild({ from, output, ...app }).skipped).toEqual(['linux-x64'])
    expect(read(output).targets.map(item => item.target)).toEqual(['darwin-arm64', 'win32-x64'])
    expect(() => importWebviewBuild({ from, output: macBuild(), ...app, targets: ['linux-x64'] })).toThrow('is not beside')
    const inner = ciBuild()
    const escaped = read(inner)
    escaped.targets[0]!.artifacts.push({ name: '../win32-x64/TinkerBelle.exe' })
    writeFileSync(join(inner, 'build.json'), JSON.stringify(escaped))
    expect(() => importWebviewBuild({ from: inner, output: macBuild(), ...app })).toThrow('is not inside its folder')
  })

  test('an MSI packaged after the record was written is recorded as found', () => {
    const from = ciBuild()
    mkdirSync(join(from, 'win32-x64/packages'))
    writeFileSync(join(from, 'win32-x64/packages/TinkerBelle-0.2.2.msi'), 'MSI bytes')
    const output = macBuild()
    const result = importWebviewBuild({ from, output, ...app })
    expect(result.imported.find(item => item.target === 'win32-x64')!.unrecorded).toEqual(['packages/TinkerBelle-0.2.2.msi'])
    const windows = read(output).targets.find(item => item.target === 'win32-x64')!
    expect(windows.artifacts.find(artifact => artifact.name === 'packages/TinkerBelle-0.2.2.msi')).toEqual(describeBuildArtifact(join(output, 'win32-x64'), 'packages/TinkerBelle-0.2.2.msi'))
    // It has its installer now: nothing is left to do for it.
    expect(windows.remaining).toBeUndefined()
  })

  test('in place: a folder dropped straight into the output is checked and recorded where it is', () => {
    const output = ciBuild()
    mkdirSync(join(output, 'win32-x64/packages'))
    writeFileSync(join(output, 'win32-x64/packages/TinkerBelle-0.2.2.msi'), 'MSI bytes')
    importWebviewBuild({ from: output, output, ...app })
    expect(read(output).targets.find(item => item.target === 'win32-x64')!.artifacts.map(artifact => artifact.name)).toEqual(['TinkerBelle.exe', 'craft-package.json', 'packages/TinkerBelle-0.2.2.msi'])
    expect(readFileSync(join(output, 'linux-x64/tinkerbelle'), 'utf8')).toBe('ELF agent')
  })

  test('a local record from another commit is replaced, and says which targets went', () => {
    const output = macBuild()
    const stale = read(output)
    stale.sourceRevision = 'c'.repeat(40)
    writeFileSync(join(output, 'build.json'), JSON.stringify(stale))
    const result = importWebviewBuild({ from: ciBuild(), output, ...app })
    expect(result.dropped).toEqual(['darwin-arm64'])
    expect(read(output).targets.map(item => item.target)).toEqual(['linux-x64', 'win32-x64'])
  })

  test('packaging a staged target records what it made', () => {
    const output = ciBuild()
    mkdirSync(join(output, 'win32-x64/packages'))
    writeFileSync(join(output, 'win32-x64/packages/TinkerBelle-0.2.2.msi'), 'MSI bytes')
    expect(recordPackagedInstallers(output, 'win32-x64')).toEqual(['packages/TinkerBelle-0.2.2.msi'])
    expect(findPackagedInstallers(join(output, 'linux-x64'))).toEqual(['packages/TinkerBelle-0.2.2.AppImage', 'packages/tinkerbelle_0.2.2_amd64.deb'])
    expect(read(output).targets.find(item => item.target === 'win32-x64')!.remaining).toBeUndefined()
  })

  test('a build keeps the targets of an earlier run of the same commit', () => {
    const base = { appName: 'TinkerBelle', appId: app.appId, version: app.version, sourceRevision: HEAD, builtOn: 'darwin-arm64', bun: '1.4.4' }
    const first = mergeBuildRecord(null, base, [{ target: 'linux-x64', directory: 'linux-x64', artifacts: [] }]).record
    const second = mergeBuildRecord(first, base, [{ target: 'darwin-arm64', directory: 'darwin-arm64', artifacts: [{ name: 'TinkerBelle.app' }] }])
    expect(second.record.targets.map(item => item.target)).toEqual(['darwin-arm64', 'linux-x64'])
    const rebuilt = mergeBuildRecord(second.record, { ...base, sourceRevision: 'd'.repeat(40) }, [{ target: 'darwin-arm64', directory: 'darwin-arm64', artifacts: [] }])
    expect(rebuilt.record.targets.map(item => item.target)).toEqual(['darwin-arm64'])
    expect(rebuilt.dropped).toEqual(['linux-x64'])
  })
})

describe('what a person downloads', () => {
  const config = { appName: 'Tinker Belle', version: '0.2.2' }
  test('is listed for every platform, the usual installer first', () => {
    expect(releaseArtifactNames(config, 'darwin-arm64')).toEqual({ update: 'Tinker-Belle-0.2.2-arm64.zip', downloads: ['Tinker-Belle-0.2.2-arm64.dmg'] })
    expect(releaseArtifactNames(config, 'win32-x64')).toEqual({ update: 'Tinker-Belle-0.2.2-x64.msi', downloads: ['Tinker-Belle-0.2.2-x64.msi'] })
    expect(releaseArtifactNames(config, 'linux-x64')).toEqual({ update: 'Tinker-Belle-0.2.2-x64.AppImage', downloads: ['Tinker-Belle-0.2.2-x64.AppImage', 'Tinker-Belle-0.2.2-x64.deb', 'Tinker-Belle-0.2.2-x64.rpm'] })
  })

  test('each with its format', () => {
    expect(['a.dmg', 'a.zip', 'a.msi', 'A-1.2.AppImage', 'a.deb', 'a.rpm', 'https://x.example/files/stable/linux-x64/0.2.2/A.AppImage'].map(releaseArtifactFormat)).toEqual(['dmg', 'zip', 'msi', 'appimage', 'deb', 'rpm', 'appimage'])
  })
})

describe('the identity a Mac app is signed with', () => {
  test('is said at build time when a release could not use it', () => {
    // Told which to use, by name or by hash: nothing to say.
    expect(signingIdentityNote('Developer ID Application: Example (ABCDE12345)', true)).toBeUndefined()
    expect(signingIdentityNote('ADFF57703F039D2948CC5D60269F8E0CE9817CB1', true)).toBeUndefined()
    // The one it found itself is an Apple Development certificate, by its hash.
    const found = signingIdentityNote('ADFF57703F039D2948CC5D60269F8E0CE9817CB1', false)!
    expect(found).not.toContain('ADFF57703F039D2948CC5D60269F8E0CE9817CB1')
    expect(found).toContain('cannot be notarized')
    expect(found).toContain('DESKTOP_SIGNING_IDENTITY')
    expect(signingIdentityNote('-', false)).toContain('Signed ad hoc')
  })

  test('a release signs the bundle again: the runtime first, then the app with its entitlements', () => {
    const directory = temporary()
    const appPath = join(directory, 'TinkerBelle.app')
    mkdirSync(join(appPath, 'Contents/MacOS'), { recursive: true })
    writeFileSync(join(appPath, 'Contents/MacOS/craft-runtime'), 'runtime')
    const ran: string[][] = []
    resignWebviewMacosApp({ appPath, config: {}, signingIdentity: 'Developer ID Application: Example (ABCDE12345)', run: (command) => { ran.push(command) } })
    const entitlements = join(directory, 'TinkerBelle.entitlements')
    expect(existsSync(entitlements)).toBe(true)
    expect(ran.map(command => command.at(-1))).toEqual([join(appPath, 'Contents/MacOS/craft-runtime'), appPath])
    expect(ran.every(command => command.includes('Developer ID Application: Example (ABCDE12345)') && command.includes('--timestamp') && command.includes('runtime'))).toBe(true)
    expect(ran[0]).not.toContain('--entitlements')
    expect(ran[1]).toContain(entitlements)

    const kept = join(directory, 'kept.entitlements')
    writeFileSync(kept, '<plist/>')
    ran.length = 0
    resignWebviewMacosApp({ appPath, config: {}, signingIdentity: 'X', entitlementsPath: kept, run: (command) => { ran.push(command) } })
    expect(ran[1]).toContain(kept)
    expect(() => resignWebviewMacosApp({ appPath: join(directory, 'Other.app'), config: {}, signingIdentity: 'X', run: () => {} })).toThrow('has no craft-runtime')
  })
})
