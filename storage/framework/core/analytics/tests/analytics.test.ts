import { describe, expect, test } from 'bun:test'
import { generateSelfHostedScript, getSelfHostedAnalyticsHead } from '../src/drivers/self-hosted'
import type { SelfHostedConfig } from '../src/drivers/self-hosted'

describe('Analytics Module Exports', () => {
  test('analytics index re-exports drivers', async () => {
    const mod = await import('../src/index')
    expect(mod).toBeDefined()
  })

  test('fathom driver is exported', async () => {
    const mod = await import('../src/drivers/fathom')
    expect(mod).toBeDefined()
    expect(mod.fathomWip).toBe(1)
  })

  test('self-hosted driver exports generateSelfHostedScript', () => {
    expect(typeof generateSelfHostedScript).toBe('function')
  })

  test('self-hosted driver exports getSelfHostedAnalyticsHead', () => {
    expect(typeof getSelfHostedAnalyticsHead).toBe('function')
  })
})

describe('Self-Hosted Analytics Script Generation', () => {
  test('returns empty string when siteId is missing', () => {
    const config: SelfHostedConfig = { siteId: '', apiEndpoint: 'https://api.example.com' }
    expect(generateSelfHostedScript(config)).toBe('')
  })

  test('returns empty string when apiEndpoint is missing', () => {
    const config: SelfHostedConfig = { siteId: 'my-site', apiEndpoint: '' }
    expect(generateSelfHostedScript(config)).toBe('')
  })

  test('generates script tag with correct data attributes', () => {
    const config: SelfHostedConfig = {
      siteId: 'my-site',
      apiEndpoint: 'https://api.example.com',
    }
    const script = generateSelfHostedScript(config)
    expect(script).toContain('data-site="my-site"')
    expect(script).toContain('data-api="https://api.example.com"')
    expect(script).toContain('<script')
    expect(script).toContain('</script>')
  })

  test('generates script with Do Not Track support when enabled', () => {
    const config: SelfHostedConfig = {
      siteId: 'my-site',
      apiEndpoint: 'https://api.example.com',
      honorDnt: true,
    }
    const script = generateSelfHostedScript(config)
    expect(script).toContain('doNotTrack')
  })

  test('generates script with hash tracking when enabled', () => {
    const config: SelfHostedConfig = {
      siteId: 'my-site',
      apiEndpoint: 'https://api.example.com',
      trackHashChanges: true,
    }
    const script = generateSelfHostedScript(config)
    expect(script).toContain('hashchange')
  })

  test('generates script with outbound link tracking when enabled', () => {
    const config: SelfHostedConfig = {
      siteId: 'my-site',
      apiEndpoint: 'https://api.example.com',
      trackOutboundLinks: true,
    }
    const script = generateSelfHostedScript(config)
    expect(script).toContain('outbound')
  })

  test('escapes HTML entities in config values', () => {
    const config: SelfHostedConfig = {
      siteId: 'site<"test">',
      apiEndpoint: 'https://api.example.com',
    }
    const script = generateSelfHostedScript(config)
    expect(script).not.toContain('site<"test">')
    expect(script).toContain('&lt;')
  })
})

describe('Self-Hosted Analytics Head Tags', () => {
  test('returns empty array when config is incomplete', () => {
    const result = getSelfHostedAnalyticsHead({ siteId: '', apiEndpoint: '' })
    expect(result).toEqual([])
  })

  test('returns array with script tag config when valid', () => {
    const result = getSelfHostedAnalyticsHead({
      siteId: 'my-site',
      apiEndpoint: 'https://api.example.com',
    })
    expect(result.length).toBeGreaterThan(0)
    expect(result[0][0]).toBe('script')
    expect(result[0][1]['data-site']).toBe('my-site')
    expect(result[0][1]['data-api']).toBe('https://api.example.com')
  })
})
