/**
 * The DMG's volume name must not equal the app name (stacksjs/stacks#2884).
 *
 * `hdiutil create -volname <appName> -srcfolder <staging>` stages the bundle at
 * `/Volumes/<appName>/<appName>.app`. On a Mac where that app is installed in
 * `/Applications` and TCC-managed - it carries `com.apple.macl` and
 * `com.apple.provenance` - macOS refuses to let a process without App
 * Management rights create a bundle that would shadow it, and the build dies at
 * the imaging step with "Operation not permitted". The `.app` is complete and
 * correct by then; only the image fails.
 *
 * It is the path, not the content: the same bundle images fine under any other
 * volume name, and a plain `cp -R` into that path is refused identically, so it
 * is not an hdiutil quirk. It hits exactly the people most likely to be
 * building - anyone who has installed the app they are working on.
 *
 * Verified against the real tool while fixing this: hdiutil does not truncate
 * long volume names (36 characters round-tripped intact), so appending the
 * version cannot fold the name back onto the app's.
 */

import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { desktopAppVersion, dmgVolumeName } from '../src'

describe('dmgVolumeName', () => {
  it('appends the version, which is the macOS convention anyway', () => {
    // Most shipped DMGs mount as "AppName 1.2.3".
    expect(dmgVolumeName({ appName: 'SystemCleaner', version: '0.3.5' })).toBe('SystemCleaner 0.3.5')
  })

  it('never returns the app name, which is the whole point', () => {
    for (const version of ['0.3.5', '0.0.0', '1.0.0-beta.1'])
      expect(dmgVolumeName({ appName: 'SystemCleaner', version })).not.toBe('SystemCleaner')
  })

  it('still differs from the app name when there is no version to append', () => {
    // `desktopAppVersion` never returns an empty string, so this is defensive
    // rather than reachable - but falling back to the bare app name would put
    // the collision back, and a fallback that reintroduces the bug is worse
    // than no fallback.
    for (const version of ['', '   ', undefined as unknown as string]) {
      const name = dmgVolumeName({ appName: 'SystemCleaner', version })
      expect(name, JSON.stringify(version)).not.toBe('SystemCleaner')
      expect(name).toBe('SystemCleaner Installer')
    }
  })

  it('trims the inputs rather than producing a trailing space', () => {
    expect(dmgVolumeName({ appName: '  SystemCleaner  ', version: ' 0.3.5 ' })).toBe('SystemCleaner 0.3.5')
  })

  it('honours an explicit override, for an existing consumer that needs a fixed name', () => {
    expect(dmgVolumeName({ appName: 'SystemCleaner', version: '0.3.5', override: 'SystemCleaner Setup' }))
      .toBe('SystemCleaner Setup')
  })

  it('ignores a blank override rather than imaging an unnamed volume', () => {
    // An unset env var arrives as '' through `process.env.X || undefined` only
    // if the caller writes it that way; a whitespace one arrives as given.
    for (const override of ['', '   '])
      expect(dmgVolumeName({ appName: 'SystemCleaner', version: '0.3.5', override })).toBe('SystemCleaner 0.3.5')
  })

  it('does not second-guess an override that asks for the colliding name', () => {
    // Explicit beats derived, as everywhere else. The caller is told at build
    // time rather than quietly overruled - rewriting what somebody typed is how
    // a build becomes unpredictable.
    expect(dmgVolumeName({ appName: 'SystemCleaner', version: '0.3.5', override: 'SystemCleaner' }))
      .toBe('SystemCleaner')
  })

  it('leaves a name hdiutil accepts, spaces and dots included', () => {
    // Probed against the real tool: 'A Fairly Long Application Name 1.0.0'
    // mounts under exactly that name.
    expect(dmgVolumeName({ appName: 'A Fairly Long Application Name', version: '1.0.0' }))
      .toBe('A Fairly Long Application Name 1.0.0')
  })
})

/**
 * That the builder uses it, and cleans up after itself.
 *
 * `build:dmg` cannot be imported in a test: it is top-level module code that
 * throws on a non-darwin host and needs a `build:desktop` manifest, and
 * importing it would run a build. So the wiring is asserted against its source,
 * the way `routes-entrypoint.test.ts` does for the same reason.
 *
 * Both fixes were verified by running the real command first: the volume name
 * end to end through hdiutil (mounted at `/Volumes/SystemCleaner 0.3.5`, bundle
 * intact inside), and the leak by failing `buddy build:dmg` at the same throw
 * before and after - two directories left behind, then none.
 */
describe('build:dmg', () => {
  const dmg = readFileSync(
    join(import.meta.dir, '..', '..', 'actions', 'src', 'build', 'dmg.ts'),
    'utf8',
  )

  /**
   * The index of `needle`, asserting it is there.
   *
   * `from` matters more than it looks: `if (signingIdentity) {` appears twice,
   * 80 lines apart, and anchoring on the first one made an ordering assertion
   * fail against correct code. The mirror of the same trap that makes a missing
   * needle (-1) pass one.
   */
  function indexOfExisting(needle: string, from = 0): number {
    const index = dmg.indexOf(needle, from)
    expect(index, `missing from dmg.ts after ${from}: ${needle}`).toBeGreaterThan(-1)
    return index
  }

  /**
   * One command, not two in an order you have to know.
   *
   * `build:dmg` used to throw "Run `buddy build:desktop` before packaging a
   * DMG", which bought nothing: the only thing a caller could do with that
   * error was run the command it named. Every app shipping a desktop build
   * therefore wrote its own orchestration script, and one of those turned up in
   * review working around the volume-name collision and the staging leak as
   * well. The abstraction belonged here.
   */
  it('builds the desktop output itself when there is none', () => {
    expect(dmg).toContain(`await import('./desktop')`)
    // The refusal it replaces.
    expect(dmg).not.toContain('Run `buddy build:desktop` before packaging a DMG')
  })

  it('only builds when the manifest is absent, never over an existing build', () => {
    // Deciding on an app's behalf that its current build is stale would be the
    // surprising half. This only fires where the command used to fail outright.
    const guard = indexOfExisting('if (!existsSync(manifestPath)) {')
    const builds = indexOfExisting(`await import('./desktop')`, guard)
    const closes = indexOfExisting('\n}', builds)

    expect(builds).toBeLessThan(closes)
  })

  it('still fails if the build it ran produced nothing', () => {
    // Composing the two does not mean trusting the first one silently.
    expect(dmg).toContain('build:desktop ran but left no manifest at')
  })

  it('names the volume through the helper, never after the app', () => {
    // `-volname appName` is the bug: it stages the bundle at
    // /Volumes/<App>/<App>.app, which macOS refuses when the app is installed.
    expect(dmg).toContain(`'-volname', volumeName`)
    expect(dmg).not.toContain(`'-volname', appName`)
    expect(dmg).toContain('dmgVolumeName({ appName, version, override: process.env.DESKTOP_VOLUME_NAME })')
  })

  it('computes the name before invoking hdiutil', () => {
    expect(indexOfExisting('const volumeName = dmgVolumeName('))
      .toBeLessThan(indexOfExisting(`'hdiutil', 'create',`))
  })

  it('removes both temp directories however the process ends', () => {
    // The imaging step was never the only leaking path: five throws and
    // several build steps sit between the mkdtemp calls and the end of the
    // file, and each one leaked both directories.
    expect(dmg).toContain(`process.on('exit', () => {`)

    // Bounded to the handler's own body. Sliced to end of file it also saw
    // the success-path cleanup further down, so dropping a line from the
    // handler left the assertion satisfied by the other copy.
    // `\n})` at line start, not `})`: every `rmSync(x, { ... })` line ends in
    // `})` too, so the loose needle cut the handler after its first statement
    // and the second assertion failed against correct code.
    const opens = indexOfExisting(`process.on('exit', () => {`)
    const handler = dmg.slice(opens, indexOfExisting('\n})', opens) + 3)

    expect(handler).toContain('rmSync(staging, { recursive: true, force: true })')
    expect(handler).toContain('rmSync(scratch, { recursive: true, force: true })')
  })

  it('registers that cleanup before anything can throw', () => {
    // Registered after the directories exist and before the first failure
    // path, or it covers nothing.
    const scratchCreated = indexOfExisting(`const scratch = mkdtempSync(`)
    const registered = indexOfExisting(`process.on('exit', () => {`)
    const firstThrow = dmg.indexOf('throw new Error(', registered)

    expect(scratchCreated).toBeLessThan(registered)
    expect(firstThrow, 'a throw must follow the registration').toBeGreaterThan(registered)
  })

  it('still frees the space early on the success path', () => {
    // Ahead of signing and notarization, which can take minutes. `rmSync` with
    // `force` is idempotent, so the exit handler running again is harmless.
    const created = indexOfExisting('if (created.isErr)')
    const earlyCleanup = indexOfExisting('rmSync(staging, { recursive: true, force: true })', created)

    expect(earlyCleanup, 'the success path should not wait for exit').toBeGreaterThan(created)
    // Searched FROM the cleanup: the signing block appears earlier too, for
    // the app bundle rather than the image.
    expect(earlyCleanup).toBeLessThan(indexOfExisting('if (signingIdentity) {', earlyCleanup))
  })
})

/**
 * Which version the bundle declares (stacksjs/stacks#2884 follow-up).
 *
 * `build:dmg` resolved this as `process.env.DESKTOP_APP_VERSION || '0.0.0'`,
 * and nothing in the framework ever set that variable, so an app that did not
 * export it itself shipped `CFBundleShortVersionString` of `0.0.0`. That is the
 * version Finder displays and the one an updater compares, so every release
 * looked like the same release, and `MyApp-0.0.0.dmg` overwrote the last one.
 *
 * Reproduced by building a real DMG in this repository, whose `package.json`
 * says 0.70.52, mounting it and reading the plist back: `0.0.0`. The app had no
 * way to fix it except to compute its own version and inject it, which is
 * exactly the kind of thing an app should not have to do.
 */
describe('desktopAppVersion', () => {
  it("carries the version the project declares, which is the whole point", () => {
    expect(desktopAppVersion({ declared: '0.70.52' })).toBe('0.70.52')
  })

  it('lets a release pipeline stamp a build over the declared version', () => {
    // A build number or a release candidate is something package.json does not know.
    expect(desktopAppVersion({ override: '2.1.0-rc.3', declared: '0.70.52' })).toBe('2.1.0-rc.3')
  })

  it('ignores an override that is only whitespace', () => {
    // An unset variable in CI commonly arrives as the empty string.
    for (const override of ['', '   ', undefined])
      expect(desktopAppVersion({ override, declared: '0.70.52' }), JSON.stringify(override)).toBe('0.70.52')
  })

  it('falls back to 0.0.0 only when the project declares no usable version', () => {
    for (const declared of [undefined, '', '  ', 42, null, {}, []])
      expect(desktopAppVersion({ declared }), JSON.stringify(declared)).toBe('0.0.0')
    expect(desktopAppVersion()).toBe('0.0.0')
  })

  it('trims, because a version with a newline would reach the plist and the filename', () => {
    expect(desktopAppVersion({ declared: ' 1.2.3\n' })).toBe('1.2.3')
    expect(desktopAppVersion({ override: '  2.0.0  ' })).toBe('2.0.0')
  })

  it('carries a prerelease verbatim rather than rounding it to a release', () => {
    // Apple documents CFBundleShortVersionString as three integers, but
    // publishing 1.4.0-rc.2 as "1.4.0" would make a candidate indistinguishable
    // from the release an updater is deciding between.
    expect(desktopAppVersion({ declared: '1.4.0-rc.2' })).toBe('1.4.0-rc.2')
  })

  it('reaches the volume name, so the mounted image says which version it is', () => {
    const version = desktopAppVersion({ declared: '0.70.52' })
    expect(dmgVolumeName({ appName: 'SystemCleaner', version })).toBe('SystemCleaner 0.70.52')
  })
})
