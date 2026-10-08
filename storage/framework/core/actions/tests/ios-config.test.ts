import type { MobileConfig } from '@stacksjs/types'
import { describe, expect, it } from 'bun:test'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { normalizeMobileUrl, portablePaths, resolveMobilePath, toCraftIosConfig, validateIosMobileConfig, withActivityTypes, writeIosActivityTypes } from '../src/build/ios-config'

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
      capabilities: { backgroundLocation: true, geolocation: true, haptics: true, camera: false, liveActivities: true, watchApp: true, localNetwork: true },
    })

    expect(config.devServerURL).toBe('https://wildloop.org')
    expect(config.enableGeolocation).toBe(true)
    expect(config.enableHaptics).toBe(true)
    expect(config.enableCamera).toBe(false)
    expect(config.enableBackgroundLocation).toBe(true)
    expect(config.enableLiveActivities).toBe(true)
    expect(config.enableWatchApp).toBe(true)
    expect(config.enableLocalNetwork).toBe(true)
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

  /**
   * Declaring app-bound domains is only half of what iOS needs. Service
   * workers, and so offline support, are granted only to a web view that has
   * also opted into the restriction, and `IosMobileConfig` exposed the domains
   * without the opt-in: `WKAppBoundDomains` landed in Info.plist and changed
   * nothing, so a service worker silently never registered
   * (stacksjs/stacks#2878).
   *
   * Craft's config key drops the `s` that Apple's
   * `limitsNavigationsToAppBoundDomains` has. That is Craft's spelling, not a
   * typo, and correcting it here would send a key Craft does not read.
   */
  it('carries the app-bound navigation limit through to Craft', () => {
    const config = toCraftIosConfig({
      appName: 'HQ.training',
      bundleId: 'training.hq.app',
      url: 'https://hq.training',
      appBoundDomains: ['hq.training'],
      limitNavigationsToAppBoundDomains: true,
    })

    expect(config.appBoundDomains).toEqual(['hq.training'])
    expect(config.limitNavigationsToAppBoundDomains).toBe(true)
  })

  it('leaves the limit out when unset, and keeps an explicit false', () => {
    // Absent rather than undefined, like every other option: Craft releases
    // before 0.0.101 let an undefined erase their default. `false` is a
    // decision, though, so it has to survive the same pruning pass - an app
    // whose web view legitimately navigates off its own domains needs to be
    // able to say so.
    const unset = toCraftIosConfig({
      appName: 'HQ.training',
      bundleId: 'training.hq.app',
      url: 'https://hq.training',
    })
    expect('limitNavigationsToAppBoundDomains' in unset).toBe(false)

    const off = toCraftIosConfig({
      appName: 'HQ.training',
      bundleId: 'training.hq.app',
      url: 'https://hq.training',
      limitNavigationsToAppBoundDomains: false,
    })
    expect(off.limitNavigationsToAppBoundDomains).toBe(false)
  })

  /**
   * Declaring app-bound domains is the only reason to list them, and listing
   * them without the restriction gets the plist key and none of the APIs. So
   * the declaration turns it on (stacksjs/stacks#2878).
   */
  it('turns the limit on for an app that declares app-bound domains', () => {
    const config = toCraftIosConfig({
      appName: 'HQ.training',
      bundleId: 'training.hq.app',
      url: 'https://hq.training',
      appBoundDomains: ['hq.training'],
    })

    expect(config.limitNavigationsToAppBoundDomains).toBe(true)
  })

  it('does not turn it on from trustedOrigins, or from an empty declaration', () => {
    // `trustedOrigins` is seeded from `config.url` for every app, so keying
    // the default on it would confine every Craft web view on upgrade rather
    // than the ones that asked. `appBoundDomains: []` declares none, which is
    // a statement and not an absence.
    const origins = toCraftIosConfig({
      appName: 'HQ.training',
      bundleId: 'training.hq.app',
      url: 'https://hq.training',
      trustedOrigins: ['https://cdn.hq.training'],
    })
    expect('limitNavigationsToAppBoundDomains' in origins).toBe(false)

    const none = toCraftIosConfig({
      appName: 'HQ.training',
      bundleId: 'training.hq.app',
      url: 'https://hq.training',
      appBoundDomains: [],
    })
    expect('limitNavigationsToAppBoundDomains' in none).toBe(false)
  })

  it('lets an explicit false beat the default', () => {
    // The escape hatch for an app whose web view legitimately navigates off
    // its own domains: without this it would start being blocked by an
    // upgrade it did not ask for.
    const config = toCraftIosConfig({
      appName: 'HQ.training',
      bundleId: 'training.hq.app',
      url: 'https://hq.training',
      appBoundDomains: ['hq.training'],
      limitNavigationsToAppBoundDomains: false,
    })

    expect(config.limitNavigationsToAppBoundDomains).toBe(false)
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

describe('the generated project\'s records', () => {
  it('name the app\'s files relative to the project folder, not the machine', () => {
    const records = portablePaths({
      appIconPath: '/Users/a/app/public/icon.png',
      splashImagePath: '/Users/a/app/public/splash.svg',
      devServerURL: 'https://hq.training/m',
      source: { kind: 'bundled', path: '/Users/a/app/dist/mobile' },
      outsidePath: '/opt/elsewhere/file.png',
      name: '/Users/a/app/not-a-path-key',
    }, '/Users/a/app/storage/framework/mobile/ios', '/Users/a/app')
    expect(records.appIconPath).toBe('../../../../public/icon.png')
    expect(records.splashImagePath).toBe('../../../../public/splash.svg')
    expect(records.source.path).toBe('../../../../dist/mobile')
    expect(records.devServerURL).toBe('https://hq.training/m')
    expect(records.outsidePath).toBe('/opt/elsewhere/file.png')
    expect(records.name).toBe('/Users/a/app/not-a-path-key')
  })
})
