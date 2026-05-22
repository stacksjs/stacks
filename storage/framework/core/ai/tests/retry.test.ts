import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { fetchWithRetry } from '../src/utils/retry'

// stacksjs/stacks#1878 A-5 — pins fetchWithRetry contract:
// - returns 2xx responses immediately
// - retries on 429 + 5xx, honoring Retry-After
// - does NOT retry on 4xx other than 429
// - caps at maxRetries

const ORIGINAL_FETCH = globalThis.fetch

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH
})

function mockFetch(responses: Array<{ status: number, headers?: Record<string, string>, body?: string }>): { calls: number } {
  const tracker = { calls: 0 }
  globalThis.fetch = async () => {
    const idx = Math.min(tracker.calls, responses.length - 1)
    const r = responses[idx]!
    tracker.calls++
    return new Response(r.body ?? '', {
      status: r.status,
      headers: r.headers ?? {},
    })
  }
  return tracker
}

describe('fetchWithRetry (stacksjs/stacks#1878 A-5)', () => {
  test('returns 2xx response immediately without retrying', async () => {
    const tracker = mockFetch([{ status: 200, body: 'ok' }])
    const r = await fetchWithRetry('https://example.com')
    expect(r.status).toBe(200)
    expect(await r.text()).toBe('ok')
    expect(tracker.calls).toBe(1)
  })

  test('retries on 429 then succeeds', async () => {
    const tracker = mockFetch([
      { status: 429, headers: { 'Retry-After': '0' } },
      { status: 200, body: 'recovered' },
    ])
    const r = await fetchWithRetry('https://example.com', undefined, { baseDelayMs: 1 })
    expect(r.status).toBe(200)
    expect(tracker.calls).toBe(2)
  })

  test('retries on 503 then succeeds', async () => {
    const tracker = mockFetch([
      { status: 503 },
      { status: 200, body: 'back up' },
    ])
    const r = await fetchWithRetry('https://example.com', undefined, { baseDelayMs: 1 })
    expect(r.status).toBe(200)
    expect(tracker.calls).toBe(2)
  })

  test('does NOT retry 400 (bad request)', async () => {
    const tracker = mockFetch([
      { status: 400, body: 'bad request' },
    ])
    const r = await fetchWithRetry('https://example.com', undefined, { baseDelayMs: 1 })
    expect(r.status).toBe(400)
    expect(tracker.calls).toBe(1)
  })

  test('does NOT retry 401 / 403 (auth errors are caller bugs)', async () => {
    const t1 = mockFetch([{ status: 401 }])
    expect((await fetchWithRetry('https://x', undefined, { baseDelayMs: 1 })).status).toBe(401)
    expect(t1.calls).toBe(1)

    const t2 = mockFetch([{ status: 403 }])
    expect((await fetchWithRetry('https://x', undefined, { baseDelayMs: 1 })).status).toBe(403)
    expect(t2.calls).toBe(1)
  })

  test('caps at maxRetries and returns the final response', async () => {
    const tracker = mockFetch([
      { status: 503 },
      { status: 503 },
      { status: 503 },
      { status: 503 },
      { status: 503 },
    ])
    const r = await fetchWithRetry('https://example.com', undefined, { maxRetries: 2, baseDelayMs: 1 })
    expect(r.status).toBe(503)
    // 1 initial + 2 retries = 3 calls
    expect(tracker.calls).toBe(3)
  })

  test('honors Retry-After delta-seconds', async () => {
    mockFetch([
      { status: 429, headers: { 'Retry-After': '1' } },
      { status: 200 },
    ])
    const start = Date.now()
    const r = await fetchWithRetry('https://example.com', undefined, { baseDelayMs: 100 })
    const elapsed = Date.now() - start
    expect(r.status).toBe(200)
    // Should have waited ~1s (the Retry-After header value), well over the 100ms base.
    expect(elapsed).toBeGreaterThanOrEqual(900)
  })

  test('honors Retry-After HTTP-date', async () => {
    // 2s in the future, rounded UP to the next whole second so the
    // toUTCString() representation isn't already in the past after
    // its second-precision truncation.
    const futureDate = new Date(Math.ceil((Date.now() + 2000) / 1000) * 1000).toUTCString()
    mockFetch([
      { status: 429, headers: { 'Retry-After': futureDate } },
      { status: 200 },
    ])
    const start = Date.now()
    const r = await fetchWithRetry('https://example.com', undefined, { baseDelayMs: 1 })
    const elapsed = Date.now() - start
    expect(r.status).toBe(200)
    // Allow generous slop — at least ~1s should have elapsed.
    expect(elapsed).toBeGreaterThanOrEqual(900)
  })

  test('falls back to exponential backoff when no Retry-After header', async () => {
    mockFetch([
      { status: 503 },
      { status: 200 },
    ])
    // baseDelayMs=10 → first retry waits up to 10ms × random(0..1)
    const start = Date.now()
    await fetchWithRetry('https://example.com', undefined, { baseDelayMs: 10 })
    const elapsed = Date.now() - start
    expect(elapsed).toBeLessThan(100) // generous upper bound for jitter
  })
})
