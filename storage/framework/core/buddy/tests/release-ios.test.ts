import { describe, expect, it } from 'bun:test'
import { bumpedVersion, iosVersionIn, nextBuildTag, withIosVersion } from '../src/release-ios'

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
})
