import { describe, expect, it } from 'bun:test'

describe('Native fetch', () => {
  it('should have native fetch available', () => {
    expect(typeof fetch).toBe('function')
  })

  it('should be able to fetch data', async () => {
    // Test with a reliable endpoint
    const response = await fetch('https://httpbin.org/user-agent')
    expect(response.ok).toBe(true)

    const data = await response.json()
    expect(data).toHaveProperty('user-agent')
  })

  it('should handle fetch errors', async () => {
    try {
      await fetch('https://this-domain-definitely-does-not-exist-12345.com')
    }
    catch (error) {
      expect(error).toBeDefined()
    }
  })
})
