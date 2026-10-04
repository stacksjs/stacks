import type { CommandRunner } from '../src/commands/desktop-apple'
import { describe, expect, it, test } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import process from 'node:process'
import {
  buildUniversalPayload,
  captureCommand,
  launcherSliceCompileArgs,
  mergeUniversalBinary,
  parseLipoArchs,
  renderAppEntitlements,
  renderFailure,
  renderAppleWorkflowCaller,
  renderHelperEntitlements,
  isAppleCategory,
  renderInfoPlist,
  resolveAppleDesktopConfig,
  signingPlan,
  storeRejectionFindings,
  validateAppleDesktopConfig,
} from '../src/commands/desktop-apple'

const config = {
  appName: 'Postline & Co',
  bundleId: 'com.stacksjs.postline',
  teamId: 'ABCDEFGHIJ',
  version: '1.2.3',
  buildNumber: '42',
  minimumMacos: '13.0',
  category: 'public.app-category.productivity',
  appSigningIdentity: 'Mac App Distribution: Stacks (ABCDEFGHIJ)',
  installerSigningIdentity: 'Mac Installer Distribution: Stacks (ABCDEFGHIJ)',
  provisioningProfile: '/tmp/postline.provisionprofile',
  apiKeyId: 'KEY123',
  apiIssuerId: 'issuer-id',
  apiKeyPath: '/tmp/AuthKey_KEY123.p8',
}

describe('Mac App Store desktop automation', () => {
  test('renders escaped bundle metadata', () => {
    const plist = renderInfoPlist(config)
    expect(plist).toContain('<string>Postline &amp; Co</string>')
    expect(plist).toContain('<string>com.stacksjs.postline</string>')
    expect(plist).toContain('<string>42</string>')
    expect(plist).toContain('<string>public.app-category.productivity</string>')
  })

  test('uses a parent sandbox and inherited helper sandbox', () => {
    const app = renderAppEntitlements(config)
    const helper = renderHelperEntitlements()
    expect(app).toContain('<key>com.apple.security.app-sandbox</key>')
    expect(app).toContain('<key>com.apple.security.network.client</key>')
    expect(app).toContain('<string>ABCDEFGHIJ.com.stacksjs.postline</string>')
    expect(helper).toContain('<key>com.apple.security.inherit</key>')
    expect(helper).not.toContain('<key>com.apple.security.network.client</key>')
  })

  /**
   * The boundaries docs/packages/desktop.md states for the Store path
   * (stacksjs/stacks#2059). If one of these starts failing, the page is wrong
   * too.
   */
  test('grants the Store bundle only what the desktop docs say it gets', () => {
    const plist = renderInfoPlist(config)
    expect(plist).not.toContain('CFBundleURLTypes')
    expect(plist).not.toContain('NSAppTransportSecurity')
    expect(plist).not.toContain('UsageDescription')

    const granted = (entitlements: string): string[] =>
      [...entitlements.matchAll(/<key>(com\.apple\.security\.[^<]+)<\/key>/g)].map(match => match[1]!)
    expect(granted(renderAppEntitlements(config))).toEqual(['com.apple.security.app-sandbox', 'com.apple.security.network.client'])
    expect(granted(renderHelperEntitlements())).toEqual(['com.apple.security.app-sandbox', 'com.apple.security.inherit'])
  })

  /**
   * The ordering invariant, which only fails on a runner with real signing
   * identities - and this repository has none yet (stacksjs/stacks#2062), so
   * nothing would have caught a reordering until whoever provisioned them hit
   * it months later.
   */
  test('signs the embedded runtime before the bundle that contains it', () => {
    const plan = signingPlan({
      identity: 'Apple Distribution: Example (TEAM123456)',
      appPath: '/build/apple/Example.app',
      helperPath: '/build/apple/Example.app/Contents/MacOS/craft-runtime',
      appEntitlements: '/build/apple/app.entitlements',
      helperEntitlements: '/build/apple/helper.entitlements',
    })

    // Signing the parent seals a hash of everything inside it, so signing the
    // helper afterwards invalidates the parent - `codesign --verify` then fails
    // naming a file nobody touched.
    expect(plan.map(args => args.at(-1))).toEqual([
      '/build/apple/Example.app/Contents/MacOS/craft-runtime',
      '/build/apple/Example.app',
    ])
  })

  test('gives the helper and the bundle their own entitlements', () => {
    // They cannot share one invocation: the helper needs
    // `com.apple.security.inherit` and the parent needs the real grants.
    const plan = signingPlan({
      identity: 'Apple Distribution: Example (TEAM123456)',
      appPath: '/build/apple/Example.app',
      helperPath: '/build/apple/Example.app/Contents/MacOS/craft-runtime',
      appEntitlements: '/build/apple/app.entitlements',
      helperEntitlements: '/build/apple/helper.entitlements',
    })

    const entitlements = plan.map(args => args[args.indexOf('--entitlements') + 1])
    expect(entitlements).toEqual(['/build/apple/helper.entitlements', '/build/apple/app.entitlements'])

    for (const args of plan) {
      expect(args[0]).toBe('codesign')
      expect(args).toContain('--timestamp')
      expect(args[args.indexOf('--sign') + 1]).toBe('Apple Distribution: Example (TEAM123456)')
    }
  })

  test('signs from a given keychain file without touching the search list', () => {
    const input = {
      identity: '3rd Party Mac Developer Application: Example (TEAM123456)',
      appPath: '/build/apple/Example.app',
      helperPath: '/build/apple/Example.app/Contents/MacOS/craft-runtime',
      appEntitlements: '/build/apple/app.entitlements',
      helperEntitlements: '/build/apple/helper.entitlements',
    }

    for (const args of signingPlan({ ...input, keychain: '/tmp/signing.keychain-db' })) {
      expect(args[args.indexOf('--keychain') + 1]).toBe('/tmp/signing.keychain-db')
      // codesign reads options before the target, so the order is part of the contract.
      expect(args.indexOf('--keychain')).toBeLessThan(args.indexOf('--sign'))
    }
    for (const args of signingPlan(input))
      expect(args).not.toContain('--keychain')
  })

  test('resolves the keychain from the option or APPLE_KEYCHAIN', () => {
    const previous = process.env.APPLE_KEYCHAIN
    try {
      process.env.APPLE_KEYCHAIN = '/tmp/from-env.keychain-db'
      expect(resolveAppleDesktopConfig().keychain).toBe('/tmp/from-env.keychain-db')
      expect(resolveAppleDesktopConfig({ keychain: '/tmp/from-option.keychain-db' }).keychain).toBe('/tmp/from-option.keychain-db')
      delete process.env.APPLE_KEYCHAIN
      expect(resolveAppleDesktopConfig().keychain).toBeUndefined()
    }
    finally {
      if (previous === undefined) delete process.env.APPLE_KEYCHAIN
      else process.env.APPLE_KEYCHAIN = previous
    }
  })

  test('generates a reusable workflow caller with validation on by default', () => {
    const workflow = renderAppleWorkflowCaller()
    expect(workflow).toContain('uses: stacksjs/stacks/.github/workflows/desktop-app-store.yml@main')
    expect(workflow).toContain('desktop-url: ${{ vars.DESKTOP_URL }}')
    expect(workflow).toContain('app-version: ${{ vars.APPLE_APP_VERSION }}')
    expect(workflow).toContain('release-tag: ${{ inputs.release-tag }}')
    expect(workflow).toContain('mirror-s3: ${{ inputs.mirror-s3 }}')
    expect(workflow).toContain('s3-bucket: ${{ vars.RELEASE_S3_BUCKET }}')
    expect(workflow).toContain('validate-only:')
    expect(workflow).toContain('secrets: inherit')
    expect(workflow).toContain("universal: ${{ vars.APPLE_UNIVERSAL == 'true' }}")
  })

  test('reports malformed and missing release inputs before packaging', () => {
    const errors = validateAppleDesktopConfig({
      ...config,
      bundleId: 'not a bundle id',
      teamId: 'short',
      version: 'version-one',
      buildNumber: 'build 1',
      provisioningProfile: '',
      apiKeyPath: '',
    })
    expect(errors).toContain('APPLE_BUNDLE_ID must be a reverse-DNS bundle identifier')
    expect(errors).toContain('APPLE_TEAM_ID must be the 10-character Apple Developer team ID')
    expect(errors).toContain('The marketing version must contain one to three numeric components')
    expect(errors).toContain('The build number must contain only letters, numbers, periods, and hyphens')
    expect(errors).toContain('APPLE_PROVISIONING_PROFILE must point to an existing .provisionprofile file')
    expect(errors).toContain('APP_STORE_CONNECT_API_KEY_PATH must point to an existing .p8 file')
  })
})

/**
 * A failure prints its message once.
 *
 * `desktop:apple:doctor` exists to name what is missing, so what it prints is
 * its whole output contract, and that contract has been wrong in both
 * directions. First silent: `await log.error()` resolves on its own schedule
 * and `process.exit()` tore the process down first, so the command reported a
 * bare exit code 1 and no diagnosis. Then doubled: the fix arrived as
 * `process.stderr.write` *and* `console.error`, and both go to stderr, so
 * eleven missing credentials were listed and then listed again.
 *
 * Asserted on the rendered value and on the source, rather than by running the
 * command. An earlier version of this test spawned the CLI, which is not free:
 * it refuses to start outside a Stacks project, and inside one it writes - a
 * bare `bun cli.ts` in an empty directory creates `storage/`. A test that
 * mutates the tree every other package is then tested against is a bad trade
 * for observing one string.
 */
describe('desktop:apple:doctor output', () => {
  it('renders the message once, with a trailing newline', () => {
    expect(renderFailure(new Error('APPLE_TEAM_ID is required'))).toBe('APPLE_TEAM_ID is required\n')
    expect(renderFailure('plain string')).toBe('plain string\n')
  })

  it('keeps every line of a multi-line diagnosis', () => {
    // The doctor's real shape: one line per missing prerequisite, joined.
    const message = ['APPLE_BUNDLE_ID must be a reverse-DNS bundle identifier', 'APPLE_TEAM_ID is required'].join('\n')

    expect(renderFailure(new Error(message))).toBe(`${message}\n`)
  })

  /**
   * The invariant that actually broke, and it is a property of the source
   * rather than of any value: two writes to stderr print twice however
   * correctly each one renders. Source-scanned because `fail` ends in
   * `process.exit` and cannot be called in-process.
   */
  it('writes to stderr exactly once', () => {
    const source = readFileSync(resolve(import.meta.dir, '../src/commands/desktop-apple.ts'), 'utf-8')
    const body = source.slice(source.indexOf('function fail('), source.indexOf('export function desktopApple('))

    expect(body).toContain('process.exit(1)')
    expect(body.match(/process\.stderr\.write\(|console\.(?:error|warn|log)\(/g) ?? []).toHaveLength(1)
  })
})

/**
 * App Review answers hours or days later and names a rule rather than a file,
 * so every one of these is far cheaper to catch before the installer is built
 * (stacksjs/stacks#2199). A pure function of the paths, because this repository
 * cannot build a signed bundle at all until the platform identities exist
 * (#2062).
 */
describe('store rejection preflight', () => {
  /** The layout `packageApp` produces, which must pass cleanly. */
  const valid = [
    'Contents/Info.plist',
    'Contents/MacOS/stacks-desktop',
    'Contents/MacOS/craft-runtime',
    'Contents/MacOS/desktop.json',
    'Contents/embedded.provisionprofile',
    'Contents/Resources/AppIcon.icns',
    'Contents/_CodeSignature/CodeResources',
  ]

  it('passes the bundle the packager actually builds', () => {
    // Guards against the rules being so strict that the real output fails -
    // which is how a preflight gets disabled rather than fixed.
    expect(storeRejectionFindings(valid)).toEqual([])
  })

  it('requires the files that make it a bundle', () => {
    expect(storeRejectionFindings(['Contents/MacOS/stacks-desktop'])).toEqual([
      'missing required bundle file: Contents/Info.plist',
      'missing required bundle file: Contents/embedded.provisionprofile',
    ])
  })

  it('catches Finder debris, which rides along in any copied directory', () => {
    // `.DS_Store` is an automatic rejection and is invisible in a directory
    // listing, which is what makes it worth a rule rather than a habit.
    expect(storeRejectionFindings([...valid, 'Contents/Resources/.DS_Store']))
      .toContain('forbidden file in the bundle: Contents/Resources/.DS_Store')
    expect(storeRejectionFindings([...valid, 'Contents/Resources/._AppIcon.icns']))
      .toContain('forbidden file in the bundle: Contents/Resources/._AppIcon.icns')
  })

  it('catches nested code outside a location codesign seals', () => {
    expect(storeRejectionFindings([...valid, 'Contents/Resources/helper.dylib']))
      .toContain('nested code outside a signed location: Contents/Resources/helper.dylib')
    expect(storeRejectionFindings([...valid, 'Contents/Extra/Widget.app']))
      .toContain('nested code outside a signed location: Contents/Extra/Widget.app')
  })

  it('accepts nested code where Apple expects it', () => {
    for (const path of [
      'Contents/Frameworks/Sparkle.framework',
      'Contents/XPCServices/Updater.xpc',
      'Contents/PlugIns/Thing.app',
    ])
      expect(storeRejectionFindings([...valid, path])).toEqual([])
  })

  it('catches executable content filed as a resource', () => {
    expect(storeRejectionFindings([...valid, 'Contents/Resources/postinstall.sh']))
      .toContain('executable content under Resources: Contents/Resources/postinstall.sh')
  })
})

describe('isAppleCategory', () => {
  it('accepts the categories Apple issues, including game subcategories', () => {
    for (const category of [
      'public.app-category.productivity',
      'public.app-category.developer-tools',
      'public.app-category.action-games',
    ])
      expect(isAppleCategory(category)).toBeTrue()
  })

  it('rejects free text, which is the mistake that actually happens', () => {
    // A wrong category is not a build error - it reaches Info.plist and comes
    // back from App Store Connect after everything is built and signed.
    for (const category of ['Productivity', 'productivity', 'public.app-category.', 'public.app-category.Games', ''])
      expect(isAppleCategory(category)).toBeFalse()
  })

  /**
   * The shape, not a list. Apple's set changes and games carry their own
   * subcategories, so a hard-coded list would reject a legitimate value the day
   * Apple adds one - a worse failure than the one it prevents.
   */
  it('accepts a category it has never heard of, as long as it is shaped right', () => {
    expect(isAppleCategory('public.app-category.something-new')).toBeTrue()
  })
})

/**
 * A fake `lipo` and `bun build`: records every command and answers `-archs`
 * from a table, so the merge sequence can be asserted without a Mac.
 */
function fakeRunner(archs: Record<string, string>): { run: CommandRunner, calls: string[][] } {
  const calls: string[][] = []
  const run: CommandRunner = (args) => {
    calls.push(args)
    if (args[0] === 'lipo' && args[1] === '-archs') {
      const answer = archs[args[2]!]
      if (answer === undefined) throw new Error(`lipo -archs ${args[2]} exited with code 1`)
      return `${answer}\n`
    }
    return ''
  }
  return { run, calls }
}

/**
 * The universal arm64 + x86_64 merge (stacksjs/stacks#2199). A Store build
 * that carries only the build machine's architecture launches fine on that
 * machine and is missing on every other kind of Mac, so nothing short of
 * reading the binary back would notice.
 */
describe('universal binary merge', () => {
  const input = { name: 'craft-runtime', arm64: '/in/arm64/craft', x64: '/in/x64/craft', output: '/out/craft-runtime' }

  it('reads lipo -archs as a set', () => {
    expect(parseLipoArchs('x86_64 arm64\n')).toEqual(['arm64', 'x86_64'])
    expect(parseLipoArchs('arm64')).toEqual(['arm64'])
    expect(parseLipoArchs('')).toEqual([])
  })

  it('checks both inputs, merges, then reads the result back', () => {
    const { run, calls } = fakeRunner({ '/in/arm64/craft': 'arm64', '/in/x64/craft': 'x86_64', '/out/craft-runtime': 'x86_64 arm64' })

    expect(mergeUniversalBinary(input, run)).toEqual(['arm64', 'x86_64'])
    expect(calls).toEqual([
      ['lipo', '-archs', '/in/arm64/craft'],
      ['lipo', '-archs', '/in/x64/craft'],
      ['lipo', '-create', '-output', '/out/craft-runtime', '/in/arm64/craft', '/in/x64/craft'],
      ['lipo', '-archs', '/out/craft-runtime'],
    ])
  })

  it('names the file when an input is the wrong architecture, before running lipo -create', () => {
    // Two arm64 slices is the likely mistake on an Apple Silicon runner, and
    // lipo's own message ("have the same architectures") does not say which.
    const { run, calls } = fakeRunner({ '/in/arm64/craft': 'arm64', '/in/x64/craft': 'arm64' })

    expect(() => mergeUniversalBinary(input, run)).toThrow('craft-runtime: the x64 input /in/x64/craft contains arm64, expected only x86_64')
    expect(calls.some(args => args[1] === '-create')).toBeFalse()
  })

  it('refuses an input that is already universal', () => {
    const { run } = fakeRunner({ '/in/arm64/craft': 'x86_64 arm64', '/in/x64/craft': 'x86_64' })
    expect(() => mergeUniversalBinary(input, run)).toThrow('contains arm64 + x86_64, expected only arm64')
  })

  it('fails when the merged binary does not carry both architectures', () => {
    const { run } = fakeRunner({ '/in/arm64/craft': 'arm64', '/in/x64/craft': 'x86_64', '/out/craft-runtime': 'arm64' })
    expect(() => mergeUniversalBinary(input, run)).toThrow('the universal binary /out/craft-runtime contains arm64, expected arm64 + x86_64')
  })

  it('cross-compiles the launcher for each darwin target', () => {
    expect(launcherSliceCompileArgs(['build', '--compile', 'launcher.ts', '--outfile', '/o'], 'x64'))
      .toEqual(['bun', 'build', '--compile', 'launcher.ts', '--outfile', '/o', '--target=bun-darwin-x64'])
  })

  it('builds both launcher slices from one source, then merges launcher and runtime', () => {
    const directory = mkdtempSync(join(tmpdir(), 'stacks-universal-'))
    try {
      const { run, calls } = fakeRunner({
        [join(directory, 'arm64/stacks-desktop')]: 'arm64',
        [join(directory, 'x64/stacks-desktop')]: 'x86_64',
        [join(directory, 'stacks-desktop')]: 'arm64 x86_64',
        '/craft/arm64': 'arm64',
        '/craft/x64': 'x86_64',
        [join(directory, 'craft-runtime')]: 'arm64 x86_64',
      })

      const payload = buildUniversalPayload({
        directory,
        launcherCompileArgs: (architecture, outfile) => launcherSliceCompileArgs(['build', 'launcher.ts', '--outfile', outfile], architecture),
        craft: { arm64: '/craft/arm64', x64: '/craft/x64' },
      }, run)

      expect(payload).toEqual({
        launcher: join(directory, 'stacks-desktop'),
        runtime: join(directory, 'craft-runtime'),
        architectures: ['arm64', 'x86_64'],
      })
      expect(calls.filter(args => args[0] === 'bun').map(args => args.at(-1))).toEqual(['--target=bun-darwin-arm64', '--target=bun-darwin-x64'])
      expect(calls.filter(args => args[1] === '-create').map(args => args[3])).toEqual([
        join(directory, 'stacks-desktop'),
        join(directory, 'craft-runtime'),
      ])
    }
    finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })

  it('names both Craft slices as missing when --universal has neither', () => {
    const errors = validateAppleDesktopConfig({ ...config, universal: true }, false)
    expect(errors).toContain('CRAFT_BIN_ARM64 must point to a native Craft runtime for a universal build')
    expect(errors).toContain('CRAFT_BIN_X64 must point to a native Craft runtime for a universal build')
  })

  it('refuses a wrapper script as a Craft slice', () => {
    const directory = mkdtempSync(join(tmpdir(), 'stacks-universal-'))
    try {
      const script = join(directory, 'craft')
      writeFileSync(script, '#!/bin/sh\nexec craft "$@"\n')
      const errors = validateAppleDesktopConfig({ ...config, universal: true, craftArm64: script, craftX64: script }, false)
      expect(errors).toContain(`CRAFT_BIN_ARM64 points at a script, not a native Craft runtime: ${script}`)
    }
    finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })

  it('leaves a single-architecture build alone', () => {
    const errors = validateAppleDesktopConfig(config, false)
    expect(errors.filter(error => error.includes('CRAFT_BIN'))).toEqual([])
  })

  it('wires the reusable workflow to cross-compile Craft only when asked', () => {
    const workflow = readFileSync(resolve(import.meta.dir, '../../../../../.github/workflows/desktop-app-store.yml'), 'utf8')
    expect(workflow).toContain('APPLE_UNIVERSAL: ${{ inputs.universal }}')
    expect(workflow).toContain('if: inputs.universal')
    expect(workflow).toContain('-Dtarget=x86_64-macos')
    expect(workflow).toContain('CRAFT_BIN_X64=')
  })

  /**
   * The real tools, when they are here. Everything above trusts the fake's
   * idea of what lipo prints; this is the check that the idea is right.
   */
  const realTools = process.platform === 'darwin' && Boolean(Bun.which('lipo')) && Boolean(Bun.which('clang'))
  it.skipIf(!realTools)('merges two real thin Mach-O binaries into one that lipo reports as universal', () => {
    const directory = mkdtempSync(join(tmpdir(), 'stacks-universal-real-'))
    try {
      const source = join(directory, 'main.c')
      writeFileSync(source, 'int main(void) { return 0; }\n')
      for (const [architecture, flag] of [['arm64', 'arm64'], ['x64', 'x86_64']] as const)
        captureCommand(['clang', '-arch', flag, source, '-o', join(directory, architecture)])

      const output = join(directory, 'universal')
      expect(mergeUniversalBinary({ name: 'fixture', arm64: join(directory, 'arm64'), x64: join(directory, 'x64'), output })).toEqual(['arm64', 'x86_64'])
      expect(parseLipoArchs(captureCommand(['lipo', '-archs', output]))).toEqual(['arm64', 'x86_64'])
    }
    finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })
})
