import { describe, expect, it } from 'bun:test'

/**
 * Two of these leave the machine: one fetches httpbin.org, and the other
 * asks DNS for a name that does not resolve. Like the lookups in
 * whois.test.ts they run only under `WHOIS_LIVE=1`, so a public service being
 * slow cannot fail CI for a diff that touches neither.
 */
const live = process.env.WHOIS_LIVE === '1'

describe('Native fetch', () => {
  it('should have native fetch available', () => {
    expect(typeof fetch).toBe('function')
  })
})

describe.skipIf(!live)('Native fetch (live network)', () => {
  it('should be able to fetch data', async () => {
    // Test with a reliable endpoint
    const response = await fetch('https://httpbin.org/user-agent')
    expect(response.ok).toBe(true)

    const data = await response.json()
    expect(data).toHaveProperty('user-agent')
  })

  it('should handle fetch errors', async () => {
    // A try/catch here passed with no assertion at all whenever the name
    // resolved, so the rejection is what is asserted.
    await expect(fetch('https://this-domain-definitely-does-not-exist-12345.com')).rejects.toThrow()
  })
})
