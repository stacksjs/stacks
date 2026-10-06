import { describe, expect, it } from 'bun:test'
import { resolveProvisionEnvironment } from '../src/commands/mail'

/**
 * `mail:provision` reconciles a shared mail server and restarts it, mints DKIM
 * keys, calls ACME and rewrites a zone's MX, SPF, DKIM and DMARC records. It
 * resolved its target as `options.env || APP_ENV || 'production'`, so a bare
 * invocation from a developer machine did all of that against the live server
 * (stacksjs/stacks#2865). The fallback is the bug: nothing about typing no
 * environment at all says production.
 */
describe('mail:provision environment', () => {
  it('takes the explicitly named environment', () => {
    expect(resolveProvisionEnvironment('staging', 'production')).toBe('staging')
    expect(resolveProvisionEnvironment('production', undefined)).toBe('production')
  })

  it('falls back to APP_ENV, which is also something somebody set', () => {
    expect(resolveProvisionEnvironment(undefined, 'staging')).toBe('staging')
  })

  it('refuses to guess when nobody named one', () => {
    expect(resolveProvisionEnvironment(undefined, undefined)).toBeNull()
    expect(resolveProvisionEnvironment('', '')).toBeNull()
    // An env file that sets APP_ENV to nothing is not a vote for production.
    expect(resolveProvisionEnvironment(undefined, '   ')).toBeNull()
  })

  it('never answers production on its own', () => {
    expect(resolveProvisionEnvironment(undefined, undefined)).not.toBe('production')
  })
})
