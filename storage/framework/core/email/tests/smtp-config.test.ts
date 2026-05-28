/**
 * SMTP driver config resolution (stacksjs/stacks#1925).
 *
 * The driver used to cache `config.services.smtp` on first read. If
 * that first read happened before async config overrides finished
 * loading, it snapped the `127.0.0.1:587` fallback into the cache and
 * never re-read — so a correct `.env` (e.g. Mailpit on 2525) still
 * produced ECONNREFUSED forever. These tests pin: (1) the config is
 * read fresh on every call, and (2) `process.env.MAIL_*` is used as a
 * fallback when the config layer hasn't surfaced the override yet.
 */

import { afterEach, describe, expect, it } from 'bun:test'
import { config } from '@stacksjs/config'
import { SMTPDriver } from '../src/drivers/smtp'

type ResolvedSmtpConfig = {
  host: string
  port: number
  username: string
  password: string
  encryption: 'tls' | 'ssl' | 'starttls' | null
}

// `getConfig` is private; this behavioral test reaches it directly.
function resolve(driver: SMTPDriver): ResolvedSmtpConfig {
  return (driver as unknown as { getConfig: () => ResolvedSmtpConfig }).getConfig()
}

const originalSmtp = config.services?.smtp
const originalEnv = {
  MAIL_HOST: process.env.MAIL_HOST,
  MAIL_PORT: process.env.MAIL_PORT,
  MAIL_USERNAME: process.env.MAIL_USERNAME,
  MAIL_PASSWORD: process.env.MAIL_PASSWORD,
  MAIL_ENCRYPTION: process.env.MAIL_ENCRYPTION,
}

afterEach(() => {
  if (config.services) config.services.smtp = originalSmtp
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
})

describe('SMTPDriver.getConfig — no stale cache (stacksjs/stacks#1925)', () => {
  it('re-reads config.services.smtp on every call', () => {
    const driver = new SMTPDriver()

    // First read with no config + no env → fallback shape.
    if (config.services) config.services.smtp = undefined as any
    delete process.env.MAIL_PORT
    const first = resolve(driver)
    expect(first.port).toBe(587)

    // Now the override "arrives" — a fresh read must reflect it, not
    // the previously-snapped fallback.
    if (config.services) {
      config.services.smtp = { host: '127.0.0.1', port: 2525, username: '', password: '', encryption: null } as any
    }
    const second = resolve(driver)
    expect(second.port).toBe(2525)
    expect(second.host).toBe('127.0.0.1')
  })

  it('maps encryption "tls" → "starttls"', () => {
    const driver = new SMTPDriver()
    if (config.services) {
      config.services.smtp = { host: 'smtp.example.com', port: 587, username: 'u', password: 'p', encryption: 'tls' } as any
    }
    expect(resolve(driver).encryption).toBe('starttls')
  })
})

describe('SMTPDriver.getConfig — env fallback (stacksjs/stacks#1925)', () => {
  it('falls back to process.env.MAIL_* when config is empty', () => {
    const driver = new SMTPDriver()
    if (config.services) config.services.smtp = undefined as any

    process.env.MAIL_HOST = 'mailpit.local'
    process.env.MAIL_PORT = '2525'
    process.env.MAIL_USERNAME = 'envuser'
    process.env.MAIL_PASSWORD = 'envpass'

    const resolved = resolve(driver)
    expect(resolved.host).toBe('mailpit.local')
    expect(resolved.port).toBe(2525)
    expect(resolved.username).toBe('envuser')
    expect(resolved.password).toBe('envpass')
  })

  it('config takes precedence over env when both are present', () => {
    const driver = new SMTPDriver()
    if (config.services) {
      config.services.smtp = { host: 'config.host', port: 1025, username: '', password: '', encryption: null } as any
    }
    process.env.MAIL_HOST = 'env.host'
    process.env.MAIL_PORT = '2525'

    const resolved = resolve(driver)
    expect(resolved.host).toBe('config.host')
    expect(resolved.port).toBe(1025)
  })

  it('coerces a string MAIL_PORT to a number', () => {
    const driver = new SMTPDriver()
    if (config.services) config.services.smtp = undefined as any
    process.env.MAIL_PORT = '2525'
    const resolved = resolve(driver)
    expect(resolved.port).toBe(2525)
    expect(typeof resolved.port).toBe('number')
  })
})
