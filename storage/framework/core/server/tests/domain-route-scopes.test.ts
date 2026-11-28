import { describe, expect, it } from 'bun:test'
import { assertScopedDomainRoutes } from '../src/domain-route-scopes'

describe('read-only domain scopes at startup', () => {
  it('leaves ordinary domain routes compatible with an older runtime', () => {
    expect(() => assertScopedDomainRoutes(undefined, undefined)).not.toThrow()
    expect(() => assertScopedDomainRoutes({ 'docs.example.test': '/docs' }, undefined)).not.toThrow()
  })

  it('refuses an older runtime that silently drops the requested scope', () => {
    const domains = { 'status.example.test': { to: '/status/example', only: [] } }
    expect(() => assertScopedDomainRoutes(domains, undefined)).toThrow('status.example.test')
    expect(() => assertScopedDomainRoutes(domains, () => [{ pattern: 'status.example.test' }])).toThrow('bun-plugin-stx')
  })

  it('accepts an empty root-only scope and additional paths from the selected runtime', () => {
    expect(() => assertScopedDomainRoutes({
      'STATUS.example.test.': { to: '/status/example', only: [] },
      'incident.example.test': { to: '/status/example', only: ['/incidents/*'] },
    }, () => [
      { pattern: 'status.example.test', only: [] },
      { pattern: 'incident.example.test', only: ['/incidents/*'] },
    ])).not.toThrow()
  })

  it('refuses a discarded route even when another scoped host compiled', () => {
    expect(() => assertScopedDomainRoutes({
      'status.example.test': { to: '/status/example', only: [] },
      'bad_label.example.test': { to: '/status/example', only: ['/incidents/*'] },
    }, () => [{ pattern: 'status.example.test', only: [] }])).toThrow('bad_label.example.test')
  })

  it('uses the first compiled mapping when normalized hostnames coincide', () => {
    expect(() => assertScopedDomainRoutes({
      'status.example.test': '/home',
      'STATUS.example.test': { to: '/status/example', only: [] },
    }, () => [
      { pattern: 'status.example.test' },
      { pattern: 'status.example.test', only: [] },
    ])).toThrow('STATUS.example.test')
  })
})
