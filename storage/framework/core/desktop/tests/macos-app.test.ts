import { describe, expect, test } from 'bun:test'
import {
  hostArguments,
  ICONSET_SIZES,
  macosOutputDirectory,
  macosScreens,
  renderHostConfig,
  renderMacosEntitlements,
  renderMacosInfoPlist,
  renderPrivacyManifest,
  resolveMacosDesktop,
  validateMacosDesktop,
} from '../src/index'

const base = {
  appName: 'Library',
  bundleId: 'com.stacksjs.library',
  teamId: '3JJRNQW6B7',
  url: 'https://library.example.com/',
  nativeScreens: ['Main', 'Settings'],
}

describe('resolveMacosDesktop', () => {
  test('fills the defaults a Mac App Store app needs', () => {
    const resolved = resolveMacosDesktop(base, '1.2.3-beta.1')
    expect(resolved.version).toBe('1.2.3-beta.1')
    expect(resolved.buildNumber).toBe('1.2.3')
    expect(resolved.category).toBe('public.app-category.productivity')
    expect(resolved.minimumSystemVersion).toBe('13.0')
    expect(resolved.sandbox).toBe(true)
    expect(resolved.initialScreen).toBe('Main')
    expect(resolved.executable).toBe('Library')
  })

  test('the first screen opens when there is no Main', () => {
    expect(resolveMacosDesktop({ ...base, nativeScreens: { Home: 'resources/native/Home.stx' } }).initialScreen).toBe('Home')
  })
})

describe('validateMacosDesktop', () => {
  test('accepts a complete config', () => {
    expect(validateMacosDesktop(resolveMacosDesktop(base, '1.0.0'))).toEqual([])
  })

  test('names every mistake that would otherwise surface as an App Store rejection', () => {
    const errors = validateMacosDesktop(resolveMacosDesktop({ ...base, bundleId: 'library', teamId: 'abc', category: 'Productivity', url: 'ftp://x', nativeScreens: [] }, 'one'))
    expect(errors.join('\n')).toContain('bundleId')
    expect(errors.join('\n')).toContain('teamId')
    expect(errors.join('\n')).toContain('category')
    expect(errors.join('\n')).toContain('url')
    expect(errors.join('\n')).toContain('nativeScreens')
    expect(errors.join('\n')).toContain('version')
  })

  test('an initial screen has to exist', () => {
    expect(validateMacosDesktop(resolveMacosDesktop({ ...base, initialScreen: 'Nope' }, '1.0.0')).join()).toContain('initialScreen')
  })
})

describe('macosScreens', () => {
  test('names resolve inside the screens directory', () => {
    expect(macosScreens({ nativeScreens: ['Main'], nativeScreensDir: 'ui' })).toEqual({ Main: 'ui/Main.stx' })
    expect(macosScreens({ nativeScreens: { Main: 'resources/views/app.stx' } })).toEqual({ Main: 'resources/views/app.stx' })
  })
})

describe('host settings', () => {
  const config = resolveMacosDesktop({ ...base, window: { width: 1000, titlebarStyle: 'transparent' } }, '1.0.0')
  test('a Finder launch reads them from the bundle, with no session handshake', () => {
    const parsed = JSON.parse(renderHostConfig(config))
    expect(parsed).toMatchObject({ apiUrl: 'https://library.example.com', title: 'Library', route: 'Main', session: false, titlebarStyle: 'transparent', width: 1000, minHeight: 520 })
  })

  test('a development run gets the same as flags', () => {
    const args = hostArguments(config, '/tmp/native-screen.js')
    expect(args).toContain('--no-session')
    expect(args.slice(0, 4)).toEqual(['--api-url', 'https://library.example.com', '--native-bundle', '/tmp/native-screen.js'])
  })
})

describe('Info.plist', () => {
  test('carries identity, category and the minimum system', () => {
    const { xml } = renderMacosInfoPlist(resolveMacosDesktop(base, '1.0.0'), { iconFile: 'AppIcon' })
    expect(xml).toContain('<key>CFBundleIdentifier</key><string>com.stacksjs.library</string>')
    expect(xml).toContain('<key>CFBundleExecutable</key><string>Library</string>')
    expect(xml).toContain('public.app-category.productivity')
    expect(xml).toContain('<key>LSMinimumSystemVersion</key><string>13.0</string>')
    expect(xml).toContain('<key>CFBundleIconFile</key><string>AppIcon</string>')
    expect(xml).toContain('ITSAppUsesNonExemptEncryption')
  })

  test('declares URL schemes and usage descriptions, and keeps the keys it owns', () => {
    const { xml, ignored } = renderMacosInfoPlist(resolveMacosDesktop({ ...base, urlSchemes: ['library'], usageDescriptions: { NSCalendarsUsageDescription: 'Show to-dos with dates' }, infoPlist: { CFBundleIdentifier: 'evil' } }, '1.0.0'))
    expect(xml).toContain('<string>library</string>')
    expect(xml).toContain('NSCalendarsUsageDescription')
    expect(xml).not.toContain('evil')
    expect(ignored).toContain('CFBundleIdentifier')
  })

  test('escapes names that would break the document', () => {
    expect(renderMacosInfoPlist(resolveMacosDesktop({ ...base, appName: 'Tom & Jerry' }, '1.0.0')).xml).toContain('Tom &amp; Jerry')
  })
})

describe('entitlements', () => {
  test('a development build is sandboxed with outbound network and nothing that needs a profile', () => {
    const xml = renderMacosEntitlements(resolveMacosDesktop(base, '1.0.0'), 'development')
    expect(xml).toContain('com.apple.security.app-sandbox')
    expect(xml).toContain('com.apple.security.network.client')
    expect(xml).not.toContain('application-identifier')
    expect(xml).not.toContain('keychain-access-groups')
  })

  test('the Mac App Store build adds the application identifier and Keychain group', () => {
    const xml = renderMacosEntitlements(resolveMacosDesktop(base, '1.0.0'), 'app-store')
    expect(xml).toContain('<key>com.apple.application-identifier</key><string>3JJRNQW6B7.com.stacksjs.library</string>')
    expect(xml).toContain('keychain-access-groups')
    expect(xml).toContain('<string>3JJRNQW6B7.com.stacksjs.library</string>')
  })

  test('the Store build needs a team, and an app can add entitlements', () => {
    expect(() => renderMacosEntitlements(resolveMacosDesktop({ ...base, teamId: undefined }, '1.0.0'), 'app-store')).toThrow(/teamId/)
    expect(renderMacosEntitlements(resolveMacosDesktop({ ...base, entitlements: { 'com.apple.security.files.user-selected.read-only': true } }, '1.0.0'), 'development')).toContain('user-selected.read-only')
  })
})

describe('privacy manifest', () => {
  test('is valid with nothing declared: no tracking, nothing collected', () => {
    const xml = renderPrivacyManifest({})
    expect(xml).toContain('<key>NSPrivacyTracking</key><false/>')
    expect(xml).toContain('<key>NSPrivacyCollectedDataTypes</key><array/>')
  })

  test('maps collected data and required-reason APIs onto Apple keys', () => {
    const xml = renderPrivacyManifest({ privacy: { collectedDataTypes: [{ type: 'NSPrivacyCollectedDataTypeEmailAddress', linked: true, purposes: ['NSPrivacyCollectedDataTypePurposeAppFunctionality'] }], accessedApiTypes: [{ type: 'NSPrivacyAccessedAPICategoryUserDefaults', reasons: ['CA92.1'] }] } })
    expect(xml).toContain('NSPrivacyCollectedDataTypeEmailAddress')
    expect(xml).toContain('<key>NSPrivacyCollectedDataTypeLinked</key><true/>')
    expect(xml).toContain('CA92.1')
  })
})

describe('icon and output', () => {
  test('an iconset covers 16 to 512 points at 1x and 2x', () => {
    expect(ICONSET_SIZES).toHaveLength(10)
    expect(ICONSET_SIZES.at(-1)).toEqual({ file: 'icon_512x512@2x.png', pixels: 1024 })
  })

  test('the app goes under storage/framework/desktop/macos unless told otherwise', () => {
    expect(macosOutputDirectory('/p', {})).toBe('/p/storage/framework/desktop/macos')
    expect(macosOutputDirectory('/p', { output: 'dist/mac' })).toBe('/p/dist/mac')
  })
})

describe('assembleMacosApp', () => {
  const { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } = require('node:fs')
  const { tmpdir } = require('node:os')
  const { join } = require('node:path')
  const { assembleMacosApp } = require('../src/index')

  function fixture() {
    const dir = mkdtempSync(join(tmpdir(), 'macos-bundle-'))
    writeFileSync(join(dir, 'host'), '#!host')
    writeFileSync(join(dir, 'screens.js'), 'screens')
    writeFileSync(join(dir, 'icon.png'), 'png')
    writeFileSync(join(dir, 'profile'), 'profile')
    return dir
  }

  test('lays out the bundle and signs inner to outer with the entitlements', () => {
    const dir = fixture()
    const commands: string[][] = []
    try {
      const result = assembleMacosApp({ config: resolveMacosDesktop({ ...base, icon: 'icon.png' }, '1.0.0'), root: dir, host: join(dir, 'host'), nativeBundle: join(dir, 'screens.js'), output: join(dir, 'out'), distribution: 'development', run: args => commands.push(args) })
      const app = result.appPath
      expect(app.endsWith('Library.app')).toBe(true)
      expect(existsSync(join(app, 'Contents/MacOS/Library'))).toBe(true)
      expect(readFileSync(join(app, 'Contents/Resources/native-screen.js'), 'utf8')).toBe('screens')
      expect(JSON.parse(readFileSync(join(app, 'Contents/Resources/craft-app.json'), 'utf8')).session).toBe(false)
      expect(existsSync(join(app, 'Contents/Resources/PrivacyInfo.xcprivacy'))).toBe(true)
      expect(commands.filter(c => c[0] === 'sips')).toHaveLength(10)
      expect(commands.some(c => c[0] === 'iconutil')).toBe(true)
      const sign = commands.find(c => c[0] === 'codesign' && c.includes('--entitlements'))!
      expect(sign).toContain('--options')
      expect(sign.at(-1)).toBe(app)
      expect(commands.at(-1)).toEqual(['codesign', '--verify', '--deep', '--strict', app])
    }
    finally { rmSync(dir, { recursive: true, force: true }) }
  })

  test('the Store build embeds the profile and refuses to build without one', () => {
    const dir = fixture()
    try {
      const options = { config: resolveMacosDesktop(base, '1.0.0'), root: dir, host: join(dir, 'host'), nativeBundle: join(dir, 'screens.js'), output: join(dir, 'out'), distribution: 'app-store' as const, run: () => {} }
      expect(() => assembleMacosApp(options)).toThrow(/provisioning profile/)
      const result = assembleMacosApp({ ...options, provisioningProfile: join(dir, 'profile'), signingIdentity: '3rd Party Mac Developer Application: X' })
      expect(existsSync(join(result.appPath, 'Contents/embedded.provisionprofile'))).toBe(true)
      expect(result.notes.join()).toContain('icon')
    }
    finally { rmSync(dir, { recursive: true, force: true }) }
  })
})

describe('development signing identity', () => {
  const { findDevelopmentIdentity, parseDevelopmentIdentity } = require('../src/index')
  const output = `  1) 1111111111111111111111111111111111111111 "Apple Development: Someone (ABCDE12345)"
  2) 2222222222222222222222222222222222222222 "Developer ID Application: Someone (ABCDE12345)"
  3) 3333333333333333333333333333333333333333 "Apple Development: Other (ZZZZZ99999)"
     3 valid identities found`

  test('picks the first Apple Development identity by its hash', () => {
    expect(parseDevelopmentIdentity(output)).toBe('1'.repeat(40))
  })

  test('there may be none, and a failing tool is not an error', () => {
    expect(parseDevelopmentIdentity('     0 valid identities found')).toBeUndefined()
    expect(findDevelopmentIdentity(() => { throw new Error('no security tool') })).toBeUndefined()
  })
})
