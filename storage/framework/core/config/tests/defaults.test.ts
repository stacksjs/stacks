import { describe, expect, test } from 'bun:test'
import { defaults } from '../src/defaults'

describe('config defaults', () => {
  describe('AI defaults', () => {
    test('ai models array has entries', () => {
      expect(defaults.ai).toBeDefined()
      expect(Array.isArray(defaults.ai.models)).toBe(true)
      expect(defaults.ai.models.length).toBeGreaterThan(0)
    })

    test('ai models include anthropic models', () => {
      const models = defaults.ai.models
      const hasAnthropic = models.some((m: string) => m.includes('anthropic'))
      expect(hasAnthropic).toBe(true)
    })
  })

  describe('auth defaults', () => {
    test('has username field', () => {
      expect(defaults.auth).toBeDefined()
      expect(defaults.auth.username).toBe('email')
    })

    test('has password field', () => {
      expect(defaults.auth.password).toBe('password')
    })

    test('has token name and expiry', () => {
      expect(defaults.auth.defaultTokenName).toBe('auth-token')
      expect(typeof defaults.auth.tokenExpiry).toBe('number')
      expect(defaults.auth.tokenExpiry).toBeGreaterThan(0)
    })
  })

  describe('database defaults', () => {
    test('has default connection set to sqlite', () => {
      expect(defaults.database).toBeDefined()
      expect(defaults.database.default).toBe('sqlite')
    })

    test('has connections object with sqlite entry', () => {
      expect(defaults.database.connections).toBeDefined()
      expect(defaults.database.connections.sqlite).toBeDefined()
    })

    test('has migrations config', () => {
      expect(defaults.database.migrations).toBe('migrations')
    })
  })

  describe('cache defaults', () => {
    test('has driver set to memory', () => {
      expect(defaults.cache).toBeDefined()
      expect(defaults.cache.driver).toBe('memory')
    })

    test('has prefix', () => {
      expect(defaults.cache.prefix).toBe('stx')
    })

    test('has ttl as a number', () => {
      expect(typeof defaults.cache.ttl).toBe('number')
      expect(defaults.cache.ttl).toBeGreaterThan(0)
    })

    test('has driver configurations', () => {
      expect(defaults.cache.drivers).toBeDefined()
      expect(defaults.cache.drivers.redis).toBeDefined()
      expect(defaults.cache.drivers.memory).toBeDefined()
    })
  })

  describe('security defaults', () => {
    test('has firewall config', () => {
      expect(defaults.security).toBeDefined()
      expect(defaults.security.firewall).toBeDefined()
    })

    test('firewall is enabled by default', () => {
      expect(defaults.security.firewall.enabled).toBe(true)
    })

    test('firewall has rate limit', () => {
      expect(typeof defaults.security.firewall.rateLimitPerMinute).toBe('number')
      expect(defaults.security.firewall.rateLimitPerMinute).toBeGreaterThan(0)
    })
  })

  describe('all required config sections are present', () => {
    test('app section exists with required fields', () => {
      expect(defaults.app).toBeDefined()
      expect(defaults.app.name).toBeDefined()
      expect(defaults.app.env).toBeDefined()
      expect(defaults.app.url).toBeDefined()
    })

    test('email section exists', () => {
      expect(defaults.email).toBeDefined()
      expect(defaults.email.from).toBeDefined()
      expect(defaults.email.from.name).toBe('Stacks')
    })

    test('hashing section exists with driver', () => {
      expect(defaults.hashing).toBeDefined()
      expect(defaults.hashing.driver).toBe('bcrypt')
    })

    test('ports section exists with expected port numbers', () => {
      expect(defaults.ports).toBeDefined()
      expect(defaults.ports.frontend).toBe(3000)
      expect(defaults.ports.backend).toBe(3001)
      expect(defaults.ports.admin).toBe(3002)
      expect(defaults.ports.docs).toBe(3006)
    })

    test('queue section has default driver', () => {
      expect(defaults.queue).toBeDefined()
      expect(defaults.queue.default).toBe('sync')
    })

    test('cloud section has infrastructure config', () => {
      expect(defaults.cloud).toBeDefined()
      expect(defaults.cloud.infrastructure).toBeDefined()
      expect(defaults.cloud.infrastructure.driver).toBe('aws')
    })

    test('dns section has driver', () => {
      expect(defaults.dns).toBeDefined()
      expect(defaults.dns.driver).toBe('aws')
    })

    test('logging section has paths', () => {
      expect(defaults.logging).toBeDefined()
      expect(typeof defaults.logging.logsPath).toBe('string')
    })

    test('services section has providers', () => {
      expect(defaults.services).toBeDefined()
      expect(defaults.services.aws).toBeDefined()
      expect(defaults.services.stripe).toBeDefined()
    })
  })
})
