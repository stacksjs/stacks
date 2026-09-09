import type { AnalyticsConfig } from '@stacksjs/types'
import { describe, expect, test } from 'bun:test'
import { FATHOM_DEFAULT_SCRIPT_URL, generateFathomScript, getFathomAnalyticsHead } from '../src/drivers/fathom'
import { generateGoogleAnalyticsScript, getGoogleAnalyticsHead } from '../src/drivers/google-analytics'
import { generatePlausibleScript, getPlausibleAnalyticsHead, plausibleScriptUrl } from '../src/drivers/plausible'
import { ANALYTICS_DRIVERS, generateAnalyticsScript, getAnalyticsHead, isAnalyticsDriver } from '../src/registry'

describe('Fathom driver', () => {
  test('returns no tags when siteId is missing', () => {
    expect(getFathomAnalyticsHead({ siteId: '' })).toEqual([])
    expect(generateFathomScript({ siteId: '' })).toBe('')
  })

  test('emits a deferred script tag with the site ID', () => {
    const script = generateFathomScript({ siteId: 'WOLZMJDL' })
    expect(script).toContain(`src="${FATHOM_DEFAULT_SCRIPT_URL}"`)
    expect(script).toContain('data-site="WOLZMJDL"')
    expect(script).toContain(' defer>')
    expect(script).toContain('</script>')
  })

  test('honorDnt maps to data-honor-dnt', () => {
    expect(generateFathomScript({ siteId: 'ABC' })).not.toContain('data-honor-dnt')
    expect(generateFathomScript({ siteId: 'ABC', honorDnt: true })).toContain('data-honor-dnt="true"')
  })

  test('spa maps to data-spa="auto"', () => {
    expect(generateFathomScript({ siteId: 'ABC' })).not.toContain('data-spa')
    expect(generateFathomScript({ siteId: 'ABC', spa: true })).toContain('data-spa="auto"')
  })

  test('scriptUrl overrides the CDN so the script can be served first-party', () => {
    const script = generateFathomScript({ siteId: 'ABC', scriptUrl: 'https://example.com/s.js' })
    expect(script).toContain('src="https://example.com/s.js"')
    expect(script).not.toContain(FATHOM_DEFAULT_SCRIPT_URL)
  })

  test('escapes attribute values', () => {
    const script = generateFathomScript({ siteId: 'a"><script>alert(1)</script>' })
    expect(script).not.toContain('<script>alert(1)')
    expect(script).toContain('&quot;')
  })
})

describe('Plausible driver', () => {
  test('returns no tags when domain is missing', () => {
    expect(getPlausibleAnalyticsHead({ domain: '' })).toEqual([])
    expect(generatePlausibleScript({ domain: '' })).toBe('')
  })

  test('emits a deferred script tag with the domain', () => {
    const script = generatePlausibleScript({ domain: 'example.com' })
    expect(script).toContain('data-domain="example.com"')
    expect(script).toContain('src="https://plausible.io/js/script.js"')
    expect(script).toContain(' defer>')
  })

  test('hashMode and trackLocalhost select script variants', () => {
    expect(plausibleScriptUrl({ domain: 'a.com', hashMode: true })).toBe('https://plausible.io/js/script.hash.js')
    expect(plausibleScriptUrl({ domain: 'a.com', trackLocalhost: true })).toBe('https://plausible.io/js/script.local.js')
    expect(plausibleScriptUrl({ domain: 'a.com', hashMode: true, trackLocalhost: true }))
      .toBe('https://plausible.io/js/script.hash.local.js')
  })

  test('scriptUrl overrides the computed variant', () => {
    expect(plausibleScriptUrl({ domain: 'a.com', hashMode: true, scriptUrl: 'https://a.com/p.js' }))
      .toBe('https://a.com/p.js')
  })
})

describe('Google Analytics driver', () => {
  test('returns no tags when trackingId is missing', () => {
    expect(getGoogleAnalyticsHead({ trackingId: '' })).toEqual([])
    expect(generateGoogleAnalyticsScript({ trackingId: '' })).toBe('')
  })

  test('emits the gtag loader and the inline bootstrap', () => {
    const script = generateGoogleAnalyticsScript({ trackingId: 'G-ABC123' })
    expect(script).toContain('src="https://www.googletagmanager.com/gtag/js?id=G-ABC123"')
    expect(script).toContain(' async>')
    expect(script).toContain(`gtag('config',"G-ABC123")`)
  })

  test('debug enables debug_mode', () => {
    expect(generateGoogleAnalyticsScript({ trackingId: 'G-ABC' })).not.toContain('debug_mode')
    expect(generateGoogleAnalyticsScript({ trackingId: 'G-ABC', debug: true })).toContain('debug_mode:true')
  })

  test('a tracking ID cannot break out of the inline script', () => {
    const script = generateGoogleAnalyticsScript({ trackingId: '</script><script>alert(1)' })
    expect(script).not.toContain('</script><script>alert(1)')
    expect(script).toContain('\\u003C')
  })
})

describe('Analytics driver registry', () => {
  test('every documented driver value is implemented', () => {
    expect([...ANALYTICS_DRIVERS].sort()).toEqual(['fathom', 'google-analytics', 'plausible', 'self-hosted'])
    for (const driver of ANALYTICS_DRIVERS)
      expect(isAnalyticsDriver(driver)).toBe(true)
  })

  test('dispatches on the configured driver', () => {
    const config: AnalyticsConfig = {
      driver: 'fathom',
      drivers: { fathom: { siteId: 'WOLZMJDL' } },
    }
    expect(generateAnalyticsScript(config)).toContain('data-site="WOLZMJDL"')
  })

  test('each driver is reachable through the registry', () => {
    expect(generateAnalyticsScript({
      driver: 'plausible',
      drivers: { plausible: { domain: 'example.com' } },
    })).toContain('data-domain="example.com"')

    expect(generateAnalyticsScript({
      driver: 'google-analytics',
      drivers: { googleAnalytics: { trackingId: 'G-1' } },
    })).toContain('gtag')

    expect(generateAnalyticsScript({
      driver: 'self-hosted',
      drivers: { selfHosted: { siteId: 's', apiEndpoint: 'https://api.example.com' } },
    })).toContain('data-api="https://api.example.com"')
  })

  test('an unknown driver throws instead of emitting nothing', () => {
    expect(() => getAnalyticsHead({ driver: 'matomo' as never }))
      .toThrow(/Unknown analytics driver "matomo"/)
  })

  test('a selected but unconfigured driver throws and names the config key', () => {
    expect(() => getAnalyticsHead({ driver: 'fathom' })).toThrow(/drivers\.fathom\.siteId/)
    expect(() => getAnalyticsHead({ driver: 'plausible', drivers: {} })).toThrow(/drivers\.plausible\.domain/)
    expect(() => getAnalyticsHead({ driver: 'google-analytics', drivers: {} }))
      .toThrow(/drivers\.googleAnalytics\.trackingId/)
    expect(() => getAnalyticsHead({ driver: 'self-hosted', drivers: { selfHosted: { siteId: 's', apiEndpoint: '' } } }))
      .toThrow(/drivers\.selfHosted\.apiEndpoint/)
  })

  test('no configured driver is not an error', () => {
    expect(getAnalyticsHead({})).toEqual([])
    expect(generateAnalyticsScript({})).toBe('')
  })
})

describe('the shipped config resolves', () => {
  test('config/analytics.ts selects a driver that works', async () => {
    const analytics = (await import('../../../../../config/analytics')).default
    expect(() => getAnalyticsHead(analytics)).not.toThrow()
    expect(generateAnalyticsScript(analytics)).toContain('<script')
  })
})
