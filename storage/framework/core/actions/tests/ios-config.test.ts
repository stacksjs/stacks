import type { MobileConfig } from '@stacksjs/types'
import { describe, expect, it } from 'bun:test'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { normalizeMobileUrl, resolveMobilePath, toCraftIosConfig, validateIosMobileConfig, withActivityTypes, writeIosActivityTypes } from '../src/build/ios-config'

/** The shape Craft's template emits: nested dicts, the root dict last. */
const CRAFT_PLIST = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleIdentifier</key>
    <string>org.example.app</string>
    <key>NSAppTransportSecurity</key>
    <dict>
        <key>NSExceptionDomains</key>
        <dict>
            <key>localhost</key>
            <dict>
                <key>NSExceptionAllowsInsecureHTTPLoads</key>
                <true/>
            </dict>
        </dict>
    </dict>
</dict>
</plist>
`

const MOBILE: MobileConfig = {
  ios: { appName: 'Example', bundleId: 'org.example.app', url: 'example.com' },
  spotlight: {
    kinds: { trail: { slots: 2, route: '/trail/:id' } },
    activityTypes: ['favorites'],
  },
}

describe('iOS mobile build configuration', () => {
  it('maps Stacks capabilities onto Craft feature flags', () => {
    const config = toCraftIosConfig({
      appName: 'WildLoop',
      bundleId: 'org.wildloop.app',
      url: 'wildloop.org',
      associatedDomains: ['applinks:wildloop.org'],
      deviceFamilies: ['iphone'],
      watchDeploymentTarget: '9.0',
      capabilities: { backgroundLocation: true, geolocation: true, haptics: true, camera: false, liveActivities: true, watchApp: true },
    })

    expect(config.devServerURL).toBe('https://wildloop.org')
    expect(config.enableGeolocation).toBe(true)
    expect(config.enableHaptics).toBe(true)
    expect(config.enableCamera).toBe(false)
    expect(config.enableBackgroundLocation).toBe(true)
    expect(config.enableLiveActivities).toBe(true)
    expect(config.enableWatchApp).toBe(true)
    expect(config.watchosVersion).toBe('9.0')
    expect(config.trustedOrigins).toEqual(['https://wildloop.org'])
    expect(config.associatedDomains).toEqual(['applinks:wildloop.org'])
    expect(config.deviceFamilies).toEqual(['iphone'])
  })

  it('passes the appearance and the dark background through to Craft', () => {
    const config = toCraftIosConfig({
      appName: 'HQ.training',
      bundleId: 'training.hq.app',
      url: 'https://hq.training/m',
      appearance: 'system',
      backgroundColor: '#f8fafc',
      backgroundColorDark: '#020617',
      swipeNavigation: true,
    })

    expect(config.appearance).toBe('system')
    expect(config.backgroundColorDark).toBe('#020617')
    expect(config.swipeNavigation).toBe(true)
    expect(config.devServerURL).toBe('https://hq.training/m')
    expect(config.trustedOrigins).toEqual(['https://hq.training'])
    // Unset options are absent, never undefined: Craft would let an
    // undefined erase its default.
    expect('darkMode' in config).toBe(false)
    expect(Object.values(config).includes(undefined)).toBe(false)
  })

  it('rejects insecure production URLs and malformed associated domains', () => {
    expect(() => validateIosMobileConfig({
      appName: 'WildLoop',
      bundleId: 'org.wildloop.app',
      url: 'http://wildloop.org',
    })).toThrow('must use HTTPS')
    expect(() => validateIosMobileConfig({
      appName: 'WildLoop',
      bundleId: 'org.wildloop.app',
      url: 'https://wildloop.org',
      associatedDomains: ['https://wildloop.org'],
    })).toThrow('Invalid iOS associated domain')
  })

  it('normalizes URLs and project-relative asset paths', () => {
    expect(normalizeMobileUrl('https://wildloop.org/')).toBe('https://wildloop.org')
    expect(resolveMobilePath('/project', 'dist/mobile')).toBe('/project/dist/mobile')
  })

  it('requires exactly one web source', () => {
    expect(() => validateIosMobileConfig({
      appName: 'WildLoop',
      bundleId: 'org.wildloop.app',
      url: 'wildloop.org',
      webAssets: 'dist',
    })).toThrow('either ios.url or ios.webAssets')
  })

  it('allows a bundled offline fallback only for remote applications', () => {
    expect(() => validateIosMobileConfig({
      appName: 'WildLoop',
      bundleId: 'org.wildloop.app',
      url: 'wildloop.org',
      fallbackWebAssets: 'dist',
    })).not.toThrow()
    expect(() => validateIosMobileConfig({
      appName: 'WildLoop',
      bundleId: 'org.wildloop.app',
      webAssets: 'dist',
      fallbackWebAssets: 'fallback',
    })).toThrow('fallbackWebAssets requires ios.url')
  })

  it('requires a supported watchOS target for companion apps', () => {
    expect(() => validateIosMobileConfig({
      appName: 'WildLoop',
      bundleId: 'org.wildloop.app',
      url: 'wildloop.org',
      watchDeploymentTarget: '8.0',
      capabilities: { watchApp: true },
    })).toThrow('watchOS 9.0 or newer')
  })

  it('requires at least one supported Apple device family', () => {
    expect(() => validateIosMobileConfig({
      appName: 'WildLoop',
      bundleId: 'org.wildloop.app',
      url: 'wildloop.org',
      deviceFamilies: [],
    })).toThrow('iphone and/or ipad')
  })
})

describe('the activity types a tapped entry needs declared', () => {
  it('declares them in the root dictionary, not a nested one', () => {
    const plist = withActivityTypes(CRAFT_PLIST, ['org.example.app.favorites'])

    expect(plist).toContain('    <key>NSUserActivityTypes</key>')
    expect(plist).toContain('        <string>org.example.app.favorites</string>')
    // Still well-formed, and the declaration is inside the document's own dict.
    expect(plist.split('<dict>')).toHaveLength(plist.split('</dict>').length)
    expect(plist.trimEnd().endsWith('</dict>\n</plist>')).toBe(true)
    expect(plist.indexOf('NSUserActivityTypes')).toBeGreaterThan(plist.indexOf('NSAppTransportSecurity'))
  })

  it('replaces what an earlier build declared instead of stacking a second list', () => {
    const once = withActivityTypes(CRAFT_PLIST, ['org.example.app.trail-slot-0', 'org.example.app.trail-slot-1'])
    const again = withActivityTypes(once, ['org.example.app.trail-slot-0'])

    expect(again.split('<key>NSUserActivityTypes</key>')).toHaveLength(2)
    expect(again).not.toContain('trail-slot-1')
    expect(withActivityTypes(once, ['org.example.app.trail-slot-0', 'org.example.app.trail-slot-1'])).toBe(once)
  })

  it('takes the key back out for a build that indexes nothing', () => {
    const once = withActivityTypes(CRAFT_PLIST, ['org.example.app.trail-slot-0'])
    expect(withActivityTypes(once, [])).not.toContain('NSUserActivityTypes')
    expect(withActivityTypes(CRAFT_PLIST, [])).toBe(CRAFT_PLIST)
  })

  it('escapes a bundle id that would not be XML', () => {
    expect(withActivityTypes(CRAFT_PLIST, ['org.ex&ample.app.favorites'])).toContain('org.ex&amp;ample.app.favorites')
  })

  it('refuses a file that is not a plist, rather than appending to it', () => {
    expect(() => withActivityTypes('not a plist', ['org.example.app.favorites'])).toThrow(/root dictionary/)
  })

  it('writes every slot and every donated action into the generated project', async () => {
    const output = await mkdtemp(join(tmpdir(), 'ios-plist-'))
    expect(writeIosActivityTypes(output, MOBILE)).toBeNull()

    await writeFile(join(output, 'Info.plist'), CRAFT_PLIST)
    expect(writeIosActivityTypes(output, MOBILE)).toEqual([
      'org.example.app.favorites',
      'org.example.app.trail-slot-0',
      'org.example.app.trail-slot-1',
    ])

    const written = await Bun.file(join(output, 'Info.plist')).text()
    expect(written).toContain('<string>org.example.app.trail-slot-1</string>')
  })

  it('writes nothing for an app that configured no index', async () => {
    const output = await mkdtemp(join(tmpdir(), 'ios-plist-'))
    await writeFile(join(output, 'Info.plist'), CRAFT_PLIST)

    expect(writeIosActivityTypes(output, { ios: MOBILE.ios })).toBeNull()
    expect(await Bun.file(join(output, 'Info.plist')).text()).toBe(CRAFT_PLIST)
  })
})
