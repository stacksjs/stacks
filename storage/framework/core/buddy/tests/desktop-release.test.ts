import { afterEach, describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readNativeArtifact } from 'ts-pantry/native'
import { packageOnlyVersionProblem, recordMacosPantryArtifact, releaseDesktopEnvironment, releaseDesktopKind, releaseMacosEnvironment } from '../src/commands/desktop-release'

/**
 * `buddy release:desktop`, as far as the command decides it: which of a
 * project's desktop apps it releases, what its flags hand the build and
 * release actions, and what it tells Pantry about a packaged AppKit app.
 */

const scratch: string[] = []
afterEach(() => {
  for (const directory of scratch.splice(0)) rmSync(directory, { recursive: true, force: true })
})

describe('which app release:desktop releases', () => {
  test('the only one declared', () => {
    expect(releaseDesktopKind({ webview: true, macos: false })).toEqual({ kind: 'webview' })
    expect(releaseDesktopKind({ webview: false, macos: true })).toEqual({ kind: 'macos' })
  })

  test('the web view app when both are, and the AppKit one with --native, as build:desktop does', () => {
    expect(releaseDesktopKind({ webview: true, macos: true })).toEqual({ kind: 'webview' })
    expect(releaseDesktopKind({ webview: true, macos: true }, { native: true })).toEqual({ kind: 'macos' })
  })

  test('neither, or --native without a macos section, is an error that says what to do', () => {
    expect(releaseDesktopKind({ webview: false, macos: false })).toEqual({ error: expect.stringContaining('no webview or macos section') })
    expect(releaseDesktopKind({ webview: true, macos: false }, { native: true })).toEqual({ error: expect.stringContaining('no macos section') })
  })

  test('--package-only is the AppKit app\'s, and says to add --native when the web view app would be taken', () => {
    expect(releaseDesktopKind({ webview: false, macos: true }, { packageOnly: true })).toEqual({ kind: 'macos' })
    expect(releaseDesktopKind({ webview: true, macos: true }, { packageOnly: true })).toEqual({ error: expect.stringContaining('Add --native') })
    expect(releaseDesktopKind({ webview: true, macos: true }, { packageOnly: true, native: true })).toEqual({ kind: 'macos' })
    expect(releaseDesktopKind({ webview: true, macos: false }, { packageOnly: true })).toEqual({ error: expect.stringContaining('build:desktop --package') })
    expect(releaseDesktopKind({ webview: false, macos: true }, { packageOnly: true, dryRun: true })).toEqual({ error: expect.stringContaining('nothing for --dry-run to hold back') })
  })
})

describe('what the flags hand the actions', () => {
  test('the identity, the channel, the notes and a dry run, as before', () => {
    expect(releaseDesktopEnvironment({ identity: 'Developer ID Application: Example (ABCDE12345)', notaryProfile: 'example', channel: 'beta', notes: 'NOTES.md', dryRun: true, allowDirty: true, target: 'darwin-arm64' }, {})).toEqual({
      DESKTOP_TARGETS: 'darwin-arm64',
      DESKTOP_SIGNING_IDENTITY: 'Developer ID Application: Example (ABCDE12345)',
      DESKTOP_NOTARY_PROFILE: 'example',
      DESKTOP_RELEASE_CHANNEL: 'beta',
      DESKTOP_RELEASE_NOTES: 'NOTES.md',
      DESKTOP_RELEASE_DRY_RUN: '1',
      DESKTOP_RELEASE_ALLOW_DIRTY: '1',
      DESKTOP_PACKAGE: '1',
    })
  })

  test('an App Store Connect API key, under the names build:dmg and desktop:apple already read', () => {
    expect(releaseDesktopEnvironment({ notarize: true, apiKeyId: 'ABC123DEFG', apiIssuerId: '00000000-0000-0000-0000-000000000000', apiKeyPath: './AuthKey.p8' }, { DESKTOP_PACKAGE: '1' })).toEqual({
      DESKTOP_NOTARIZE: '1',
      APP_STORE_CONNECT_API_KEY_ID: 'ABC123DEFG',
      APP_STORE_CONNECT_API_ISSUER_ID: '00000000-0000-0000-0000-000000000000',
      APP_STORE_CONNECT_API_KEY_PATH: './AuthKey.p8',
    })
  })

  test('nothing is set for a flag that was not given, so CI secrets stand', () => {
    expect(releaseDesktopEnvironment({}, { DESKTOP_PACKAGE: '1' })).toEqual({})
  })

  test('an AppKit release builds the Developer ID distribution, and --package-only stops it before Apple', () => {
    expect(releaseMacosEnvironment({})).toEqual({ DESKTOP_DISTRIBUTION: 'developer-id' })
    expect(releaseMacosEnvironment({ packageOnly: true })).toEqual({ DESKTOP_DISTRIBUTION: 'developer-id', DESKTOP_RELEASE_PACKAGE_ONLY: '1' })
  })
})

describe('--package-only and Pantry', () => {
  test('the version is package.json\'s, in full: what Pantry releases and checks the bundle against', () => {
    expect(packageOnlyVersionProblem('1.4.0', '1.4.0')).toBeUndefined()
    expect(packageOnlyVersionProblem('1.4.1', '1.4.0')).toContain('macos.version is 1.4.1 but package.json says 1.4.0')
    expect(packageOnlyVersionProblem('1.4', '1.4')).toContain('major.minor.patch')
    expect(packageOnlyVersionProblem('1.4.0', undefined)).toContain('major.minor.patch')
  })

  test('the artifact record is one Pantry\'s pipeline reads back: the DMG, the app, the bundle\'s identity', async () => {
    const root = realpathSync(mkdtempSync(join(tmpdir(), 'stacks-pantry-artifact-')))
    scratch.push(root)
    mkdirSync(join(root, 'config'))
    writeFileSync(join(root, 'config/desktop.ts'), `export default { macos: { appName: 'Library', bundleId: 'com.stacksjs.library', url: 'https://library.example.com', nativeScreens: ['Main'], buildNumber: '42' } }\n`)
    const output = join(root, 'storage/framework/desktop/macos')
    await expect(recordMacosPantryArtifact(root, '1.4.0')).rejects.toThrow(/no build record/)

    const staged = join(output, 'release/darwin-arm64')
    mkdirSync(staged, { recursive: true })
    writeFileSync(join(output, 'Library.build.json'), JSON.stringify({ appName: 'Library', version: '1.4.0', distribution: 'developer-id', architecture: 'arm64', sourceRevision: null }))
    writeFileSync(join(staged, 'Library-1.4.0-arm64.dmg'), 'the image')
    expect(await recordMacosPantryArtifact(root, '1.4.0')).toBe(join(staged, 'Library-1.4.0-arm64.dmg'))

    expect(JSON.parse(readFileSync(join(root, '.pantry/native/artifact.json'), 'utf8'))).toEqual({
      path: join(staged, 'Library-1.4.0-arm64.dmg'),
      appPath: join(output, 'Library.app'),
      name: 'Library',
      bundleId: 'com.stacksjs.library',
      version: '1.4.0',
      buildNumber: '42',
      target: 'macos',
      minimumSystemVersion: '13.0',
    })
    // Pantry's own reader accepts it: complete, inside the project, the file there.
    expect(readNativeArtifact(root).path.endsWith('Library-1.4.0-arm64.dmg')).toBe(true)
  })
})
