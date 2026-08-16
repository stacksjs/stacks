import { describe, expect, it } from 'bun:test'
import { formatPublishPlan, isTargetConfigured, missingCredentials, planExtensionPublish } from '../src/publish-plan'
import type { PublishEnv } from '../src/publish-plan'
import type { ExtensionConfig } from '../src/types'

/** A project set up for all three stores. */
function fullyConfigured(): ExtensionConfig {
  return {
    name: 'Very Good AdBlock',
    description: 'Blocks ads.',
    geckoId: 'extension@example.com',
    chromeWebStore: { publisherId: 'pub', itemId: 'abc123' },
    firefoxAddons: { channel: 'listed' },
    safariBundleId: 'com.example.app',
    safariTeamId: 'TEAM123',
  }
}

const allCredentials: PublishEnv = {
  CHROME_WEB_STORE_SERVICE_ACCOUNT_PATH: '/keys/chrome.json',
  AMO_JWT_ISSUER: 'issuer',
  AMO_JWT_SECRET: 'secret',
  APP_STORE_CONNECT_API_KEY_ID: 'KEY',
  APP_STORE_CONNECT_API_ISSUER_ID: 'ISSUER',
  APP_STORE_CONNECT_API_KEY_PATH: '/keys/apple.p8',
}

describe('isTargetConfigured', () => {
  it('reads each store from the field that actually addresses it', () => {
    const config = fullyConfigured()
    expect(isTargetConfigured(config, 'chrome')).toBe(true)
    expect(isTargetConfigured(config, 'firefox')).toBe(true)
    expect(isTargetConfigured(config, 'safari')).toBe(true)
  })

  it('treats a Firefox listing without a gecko id as unconfigured', () => {
    // AMO addresses the add-on by gecko id; a listing block alone updates nothing.
    const config = { ...fullyConfigured(), geckoId: undefined }
    expect(isTargetConfigured(config, 'firefox')).toBe(false)
  })

  it('treats Safari without a team id as unconfigured', () => {
    expect(isTargetConfigured({ ...fullyConfigured(), safariTeamId: undefined }, 'safari')).toBe(false)
  })

  it('treats a Chrome block with no item id as unconfigured', () => {
    const config = { ...fullyConfigured(), chromeWebStore: { publisherId: 'pub', itemId: '' } }
    expect(isTargetConfigured(config, 'chrome')).toBe(false)
  })
})

describe('missingCredentials', () => {
  it('accepts either alternative in a group', () => {
    expect(missingCredentials('chrome', { CHROME_WEB_STORE_ACCESS_TOKEN: 'tok' })).toEqual([])
    expect(missingCredentials('chrome', { CHROME_WEB_STORE_SERVICE_ACCOUNT_PATH: '/k.json' })).toEqual([])
    // Legacy web-ext names satisfy the same requirement as the AMO ones.
    expect(missingCredentials('firefox', { WEB_EXT_API_KEY: 'k', WEB_EXT_API_SECRET: 's' })).toEqual([])
  })

  it('names one variable per unsatisfied group, not every alias', () => {
    expect(missingCredentials('chrome', {})).toEqual(['CHROME_WEB_STORE_SERVICE_ACCOUNT_PATH'])
    expect(missingCredentials('firefox', { AMO_JWT_ISSUER: 'issuer' })).toEqual(['AMO_JWT_SECRET'])
  })

  it('ignores variables that are present but blank', () => {
    // CI exports an unset secret as the empty string, which is not a credential.
    expect(missingCredentials('chrome', { CHROME_WEB_STORE_ACCESS_TOKEN: '   ' }))
      .toEqual(['CHROME_WEB_STORE_SERVICE_ACCOUNT_PATH'])
  })

  it('requires every Apple variable', () => {
    expect(missingCredentials('safari', { APP_STORE_CONNECT_API_KEY_ID: 'KEY' }))
      .toEqual(['APP_STORE_CONNECT_API_ISSUER_ID', 'APP_STORE_CONNECT_API_KEY_PATH'])
  })
})

describe('planExtensionPublish', () => {
  it('publishes every store that is configured and credentialed', () => {
    const plan = planExtensionPublish(fullyConfigured(), allCredentials)
    expect(plan.map(d => d.target)).toEqual(['chrome', 'firefox', 'safari'])
    expect(plan.every(d => d.publish)).toBe(true)
  })

  /**
   * The case this policy exists for: a project adopting one store at a time
   * must still be able to release.
   */
  it('skips the stores that are not set up yet and publishes the rest', () => {
    const plan = planExtensionPublish(fullyConfigured(), {
      CHROME_WEB_STORE_ACCESS_TOKEN: 'tok',
    })

    const byTarget = Object.fromEntries(plan.map(d => [d.target, d]))
    expect(byTarget.chrome.publish).toBe(true)
    expect(byTarget.firefox.publish).toBe(false)
    expect(byTarget.firefox.reason).toBe('missing-credentials')
    expect(byTarget.safari.publish).toBe(false)
    expect(byTarget.safari.reason).toBe('missing-credentials')
  })

  it('distinguishes a store the project does not ship from one awaiting secrets', () => {
    const config = { ...fullyConfigured(), safariBundleId: undefined, safariTeamId: undefined }
    const plan = planExtensionPublish(config, { CHROME_WEB_STORE_ACCESS_TOKEN: 'tok' })
    const byTarget = Object.fromEntries(plan.map(d => [d.target, d]))

    expect(byTarget.safari.reason).toBe('not-configured')
    expect(byTarget.firefox.reason).toBe('missing-credentials')
  })

  it('always reports every target, including skipped ones', () => {
    // The release log should show the whole picture, not only what ran.
    const plan = planExtensionPublish({ name: 'x', description: 'y' }, {})
    expect(plan).toHaveLength(3)
    expect(plan.every(d => !d.publish && d.reason === 'not-configured')).toBe(true)
  })

  it('can be narrowed to specific targets', () => {
    const plan = planExtensionPublish(fullyConfigured(), allCredentials, ['firefox'])
    expect(plan.map(d => d.target)).toEqual(['firefox'])
  })

  it('tells you which variables would switch a skipped store on', () => {
    const plan = planExtensionPublish(fullyConfigured(), {}, ['firefox'])
    expect(plan[0].detail).toBe('set AMO_JWT_ISSUER, AMO_JWT_SECRET')
  })
})

describe('formatPublishPlan', () => {
  it('renders one line per target', () => {
    const plan = planExtensionPublish(fullyConfigured(), { CHROME_WEB_STORE_ACCESS_TOKEN: 'tok' }, ['chrome', 'firefox'])
    expect(formatPublishPlan(plan)).toBe(
      '  chrome: publishing\n'
      + '  firefox: skipped (set AMO_JWT_ISSUER, AMO_JWT_SECRET)',
    )
  })
})
