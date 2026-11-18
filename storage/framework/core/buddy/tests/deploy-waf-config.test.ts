import { describe, expect, it } from 'bun:test'
import { applySecurityWaf } from '../src/waf-config'

const box = { project: { slug: 'acme' }, cloud: { provider: 'hetzner' }, infrastructure: { compute: { runtime: 'bun' } } }

describe('security.waf on deploy targets', () => {
  it('becomes ts-cloud compute.waf on a box deploy, in detection mode by default', () => {
    const { config, warnings } = applySecurityWaf(box, {
      paranoiaLevel: 2,
      exclusions: [{ ruleId: 942100, pathPattern: '^/api/search', reason: 'search syntax looks like SQL' }],
    }, 'hetzner')
    expect(config.infrastructure.compute.waf).toEqual({
      mode: 'detection',
      paranoiaLevel: 2,
      exclusions: [{ ruleId: 942100, pathPattern: '^/api/search', reason: 'search syntax looks like SQL' }],
    })
    expect(warnings).toEqual([])
    expect(box.infrastructure.compute).not.toHaveProperty('waf')
  })

  it('never switches to blocking by itself', () => {
    const { config } = applySecurityWaf(box, { paranoiaLevel: 1 }, 'hetzner')
    expect(config.infrastructure.compute.waf.mode).toBe('detection')
  })

  it('lets an explicit compute.waf in config/cloud.ts win, and says so', () => {
    const explicit = { ...box, infrastructure: { compute: { runtime: 'bun', waf: { mode: 'off' } } } }
    const { config, warnings } = applySecurityWaf(explicit, { mode: 'detection', paranoiaLevel: 2 }, 'hetzner')
    expect(config.infrastructure.compute.waf).toEqual({ mode: 'off', paranoiaLevel: 2 })
    expect(warnings[0]).toContain('overrides mode')
  })

  it('respects compute.waf: false', () => {
    const disabled = { ...box, infrastructure: { compute: { runtime: 'bun', waf: false } } }
    const { config, warnings } = applySecurityWaf(disabled, { mode: 'detection' }, 'hetzner')
    expect(config.infrastructure.compute.waf).toBe(false)
    expect(warnings[0]).toContain('ignored')
  })

  it('leaves AWS deploys exactly as they were when waf is unset', () => {
    const aws = { project: { slug: 'acme' }, infrastructure: { security: { waf: { enabled: true } } } }
    const { config, warnings } = applySecurityWaf(aws, undefined, 'aws')
    expect(config).toBe(aws)
    expect(warnings).toEqual([])
  })

  it('reports zig-waf options AWS WAF cannot express instead of dropping them silently', () => {
    const aws = { project: { slug: 'acme' } }
    const { config, warnings } = applySecurityWaf(aws, { paranoiaLevel: 2, exclusions: [] }, 'aws')
    expect(config).toBe(aws)
    expect(warnings[0]).toContain('paranoiaLevel, exclusions')
  })
})
