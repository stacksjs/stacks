import { describe, expect, it } from 'bun:test'
import { configDnsDomains } from '../src/commands/deploy'

describe('configDnsDomains', () => {
  it('keeps application zones and normalizes www aliases', () => {
    expect(configDnsDomains({
      main: { domain: 'example.com', root: 'dist' },
      api: { domain: 'example.com', path: '/api', port: 3000 },
      www: { domain: 'www.example.com', root: 'dist' },
    })).toEqual(['example.com'])
  })

  it('does not copy primary-zone records to redirect-only domains', () => {
    expect(configDnsDomains({
      main: { domain: 'example.com', root: 'dist' },
      legacy: { domain: 'example-old.com', redirect: 'https://example.com' },
      legacyWww: { domain: 'www.example-old.com', redirect: 'https://example.com' },
    })).toEqual(['example.com'])
  })
})
