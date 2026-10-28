import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { bumpedVersion, iosReleaseSummary, iosVersionIn, nextBuildTag, unreleasableSite, withIosVersion } from '../src/release-ios'

const CONFIG = `export default {
  ios: {
    appName: 'HQ',
    version: envVars.IOS_APP_VERSION ?? '1.0.0',
    buildNumber: envVars.IOS_BUILD_NUMBER ?? '1',
  },
  android: {
    version: envVars.ANDROID_APP_VERSION ?? envVars.IOS_APP_VERSION ?? '1.0.0',
  },
}
`

describe('buddy release:ios', () => {
  it('reads the iOS version, the default behind an env override included', () => {
    expect(iosVersionIn(CONFIG)).toBe('1.0.0')
    expect(iosVersionIn(`export default { ios: { version: "2.3.4" } }`)).toBe('2.3.4')
    expect(iosVersionIn(`export default { android: { version: '1.0.0' } }`)).toBeNull()
  })

  it('moves only the iOS version', () => {
    const next = withIosVersion(CONFIG, '1.1.0')
    expect(next).toContain(`version: envVars.IOS_APP_VERSION ?? '1.1.0'`)
    expect(next).toContain(`envVars.ANDROID_APP_VERSION ?? envVars.IOS_APP_VERSION ?? '1.0.0'`)
    expect(next.replace('1.1.0', '1.0.0')).toBe(CONFIG)
  })

  it('bumps patch, minor and major, or takes a version outright', () => {
    expect(bumpedVersion('1.0.0', 'patch')).toBe('1.0.1')
    expect(bumpedVersion('1.0.9', 'minor')).toBe('1.1.0')
    expect(bumpedVersion('1.4.2', 'major')).toBe('2.0.0')
    expect(bumpedVersion('1.4.2', '3.0.0')).toBe('3.0.0')
    expect(() => bumpedVersion('1.0.0', 'huge')).toThrow()
  })

  it('numbers builds of a version after the tags already there', () => {
    expect(nextBuildTag('1.0.0', [])).toBe('v1.0.0-build.1')
    expect(nextBuildTag('1.0.0', ['v1.0.0-build.1', 'v1.0.0-build.3', 'v1.0.0-build.x', 'v0.9.0-build.7'])).toBe('v1.0.0-build.4')
    expect(nextBuildTag('1.1.0', ['v1.0.0-build.4'])).toBe('v1.1.0-build.1')
  })

  it('preserves the marketing version for build-only releases and validates versions', () => {
    expect(bumpedVersion('1.0.0', 'build')).toBe('1.0.0')
    for (const version of ['01.0.0', '1.0.0-beta.1', '1.0.0+build.1', '9007199254740992.0.0']) {
      expect(() => bumpedVersion(version, 'build')).toThrow()
      expect(() => withIosVersion(CONFIG, version)).toThrow()
    }
    expect(() => bumpedVersion('1.0.0', '01.0.0')).toThrow()
    expect(() => bumpedVersion('1.0.0', '9007199254740992.0.0')).toThrow()
  })

  it('allocates after both tags and failed or in-flight Xcode Cloud runs', () => {
    expect(nextBuildTag('1.0.0', ['v1.0.0-build.13'], 12)).toBe('v1.0.0-build.14')
    expect(nextBuildTag('1.0.0', ['v1.0.0-build.12'], 16)).toBe('v1.0.0-build.17')
    expect(nextBuildTag('1.0.0', ['v1.0.0-build.9007199254740992', 'v1.0.0-build.1.5'], 12)).toBe('v1.0.0-build.13')
    expect(() => nextBuildTag('1.0.0', [], Number.MAX_SAFE_INTEGER)).toThrow()
  })

  it('titles the GitHub release with the TestFlight build, and only claims the number when Xcode Cloud allocated it', () => {
    const numbered = iosReleaseSummary('v1.0.0-build.39', { numberedByXcodeCloud: true })
    expect(numbered.name).toBe('1.0.0 (build 39)')
    expect(numbered.body).toContain('TestFlight build **39**')
    const counted = iosReleaseSummary('v1.0.0-build.39', { numberedByXcodeCloud: false })
    expect(counted.body).not.toContain('TestFlight build **39**')
    expect(counted.body).toContain('may differ')
    expect(() => iosReleaseSummary('v1.0.0', { numberedByXcodeCloud: true })).toThrow()
  })
})

describe('a release that would ship a dev server (#3028)', () => {
  it('refuses a local devServerURL in the generated config, whatever set it', () => {
    for (const site of ['http://localhost:3010/m', 'http://127.0.0.1:3000', 'http://10.0.2.2:3010/m', 'http://192.168.1.20:3010/m', 'https://hq.localhost/m', 'http://[::1]:3000'])
      expect(unreleasableSite({ devServerURL: site })).toContain('local address')
    expect(unreleasableSite({ devServerURL: 'not a url' })).toContain('is not a URL')
  })

  it('lets a production site, or no site at all, through', () => {
    expect(unreleasableSite({ devServerURL: 'https://hq.training/m' })).toBeNull()
    expect(unreleasableSite({})).toBeNull()
  })

  // The build is a child process, so these are wiring, not logic: without
  // them the parent's delete is undone by the child's .env load. Comments are
  // stripped first, so prose about the calls cannot satisfy the checks.
  const code = (relative: string): string => new Bun.Transpiler({ loader: 'ts' }).transformSync(readFileSync(join(import.meta.dir, relative), 'utf8'))

  it('withholds the dev overrides from the build and checks the artifact before anything is committed', () => {
    const release = code('../src/commands/release.ts')
    const build = release.indexOf('runAction(Action.BuildIos')
    expect(build).toBeGreaterThan(-1)
    expect(release.slice(build, release.indexOf(')', build))).toContain('withholdEnv(')
    const guard = release.indexOf('unreleasableSite(')
    expect(guard).toBeGreaterThan(build)
    // The transpiler prints string literals double-quoted.
    const commit = release.indexOf('git("add"')
    expect(commit).toBeGreaterThan(guard)
  })

  it('removes withheld keys in the build before the app config is read', () => {
    const ios = code('../../actions/src/build/ios.ts')
    const applied = ios.indexOf('applyWithheldEnv()')
    const config = ios.indexOf('pathToFileURL(configPath)')
    expect(applied).toBeGreaterThan(-1)
    expect(config).toBeGreaterThan(applied)
  })
})
