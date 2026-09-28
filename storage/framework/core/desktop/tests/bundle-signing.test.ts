import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { bundleDirectoryFor, codesignArgs, isMachO } from '../src/index'

/**
 * Signing what `build:dmg` produces.
 *
 * It copied everything `build:desktop` emitted into Contents/MacOS, manifest
 * and checksums included, and `codesign` treats everything there as code: it
 * refused the launcher and the bundle with "code object is not signed at all.
 * In subcomponent: .../Contents/MacOS/desktop.json". No DMG it made could be
 * signed, and so none could be notarized. Found shipping Uplink.app.
 */

const scratch = mkdtempSync(join(tmpdir(), 'stacks-bundle-signing-'))
afterAll(() => rmSync(scratch, { recursive: true, force: true }))

const machOBinary = join(scratch, 'synthetic-mach-o')
writeFileSync(machOBinary, Uint8Array.from([0xFE, 0xED, 0xFA, 0xCF]))
const launcherSource = join(scratch, 'launcher.ts')
const compiledBinary = join(scratch, 'launcher')
const manifest = join(scratch, 'desktop.json')
writeFileSync(manifest, '{"title":"Test"}\n')

describe('bundleDirectoryFor', () => {
  test('puts executables in MacOS and data in Resources', () => {
    expect(isMachO(machOBinary)).toBe(true)
    expect(bundleDirectoryFor(machOBinary)).toBe('MacOS')
    expect(isMachO(manifest)).toBe(false)
    expect(bundleDirectoryFor(manifest)).toBe('Resources')
    expect(isMachO(join(scratch, 'missing'))).toBe(false)
  })
})

describe('codesignArgs', () => {
  test('signs for notarization: hardened runtime, secure timestamp, entitlements', () => {
    expect(codesignArgs({ identity: 'ABC123', target: '/x/App.app', entitlements: '/x/e.plist' }))
      .toEqual(['codesign', '--force', '--timestamp', '--options', 'runtime', '--entitlements', '/x/e.plist', '--sign', 'ABC123', '/x/App.app'])
  })

  test('cannot timestamp an ad-hoc signature, so asks for none', () => {
    expect(codesignArgs({ identity: '-', target: 't' })).toEqual(['codesign', '--force', '--timestamp=none', '--options', 'runtime', '--sign', '-', 't'])
  })
})

/** A minimal .app with the launcher and manifest placed by `placeManifest`. */
function bundle(name: string, manifestDir: 'MacOS' | 'Resources'): string {
  const app = join(scratch, `${name}.app`)
  mkdirSync(join(app, 'Contents', 'MacOS'), { recursive: true })
  mkdirSync(join(app, 'Contents', 'Resources'), { recursive: true })
  writeFileSync(join(app, 'Contents', 'Info.plist'), `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleExecutable</key><string>${name}</string>
  <key>CFBundleIdentifier</key><string>test.${name.toLowerCase()}</string>
  <key>CFBundlePackageType</key><string>APPL</string>
</dict></plist>
`)
  copyFileSync(compiledBinary, join(app, 'Contents', 'MacOS', name))
  copyFileSync(manifest, join(app, 'Contents', manifestDir, 'desktop.json'))
  return app
}

function sign(target: string) {
  return Bun.spawnSync(codesignArgs({ identity: '-', target }), { stderr: 'pipe' })
}

describe.if(process.platform === 'darwin')('signing a bundle', () => {
  beforeAll(() => {
    writeFileSync(launcherSource, 'console.log("launched")\n')
    const compiled = Bun.spawnSync([process.execPath, 'build', '--compile', launcherSource, '--outfile', compiledBinary])

    if (compiled.exitCode !== 0)
      throw new Error(compiled.stderr.toString())
    if (!isMachO(compiledBinary))
      throw new Error('Bun did not produce a Mach-O launcher on macOS')
  })

  test('succeeds with the manifest in Resources, and verifies', () => {
    const app = bundle('Placed', bundleDirectoryFor(manifest))
    expect(sign(join(app, 'Contents', 'MacOS', 'Placed')).exitCode).toBe(0)
    expect(sign(app).exitCode).toBe(0)
    const verify = Bun.spawnSync(['codesign', '--verify', '--strict', '--deep', app], { stderr: 'pipe' })
    expect(verify.stderr.toString()).toBe('')
    expect(verify.exitCode).toBe(0)
  }, 60_000)

  test('fails with the manifest beside the executable, as build:dmg used to put it', () => {
    const app = bundle('Legacy', 'MacOS')
    const result = sign(join(app, 'Contents', 'MacOS', 'Legacy'))
    expect(result.exitCode).not.toBe(0)
    expect(result.stderr.toString()).toContain('desktop.json')
  }, 60_000)
})
