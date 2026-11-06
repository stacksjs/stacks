import { describe, expect, test } from 'bun:test'
import { capturedRequestPath, createRequestCapture } from '../src/request-capture'
import type { CapturedRequest } from '../src/request-capture'

describe('native HTTP capture', () => {
  test('records the completed response without consuming bodies or retaining secrets', async () => {
    const rows: CapturedRequest[] = []
    const capture = createRequestCapture({ enabled: () => true, store: async row => { rows.push(row) } })
    const request = new Request('https://example.test/api/workouts?token=query-secret', {
      method: 'POST', headers: { authorization: 'Bearer header-secret' }, body: 'body-secret',
    })
    let answer!: (response: Response) => void
    const pending = capture.observe(request, () => new Promise<Response>(resolve => { answer = resolve }))
    expect(rows).toHaveLength(0)
    const response = new Response('private response', { status: 422 })
    answer(response)
    expect(await pending).toBe(response)
    await capture.flush()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ method: 'POST', path: '/api/workouts', status_code: 422, ip_address: '', user_agent: '' })
    expect(rows[0]!.duration_ms).toBeGreaterThanOrEqual(0)
    expect(rows[0]!.memory_usage).toBeGreaterThan(0)
    expect(JSON.stringify(rows)).not.toContain('secret')
    expect(request.bodyUsed).toBe(false)
    expect(response.bodyUsed).toBe(false)
  })

  test('disabled capture preserves the synchronous response path', async () => {
    let writes = 0
    const capture = createRequestCapture({ enabled: () => false, store: async () => { writes++ } })
    const response = new Response(null, { status: 204 })
    expect(capture.observe(new Request('https://example.test'), () => response)).toBe(response)
    await capture.flush()
    expect(writes).toBe(0)
  })

  test('nested dispatch records once and preserves errors and refusals', async () => {
    const rows: CapturedRequest[] = []
    const capture = createRequestCapture({ enabled: () => true, store: async row => { rows.push(row) } })
    for (const status of [200, 401, 403, 404, 429, 503]) {
      const request = new Request(`https://example.test/${status}`)
      const response = new Response(null, { status })
      expect(capture.observe(request, () => capture.observe(request, () => response))).toBe(response)
    }
    const error = new Error('sensitive-error-detail')
    expect(() => capture.observe(new Request('https://example.test/throw'), () => { throw error })).toThrow(error)
    await expect(capture.observe(new Request('https://example.test/reject'), () => Promise.reject(error))).rejects.toBe(error)
    await capture.flush()
    expect(rows.map(row => row.status_code)).toEqual([200, 401, 403, 404, 429, 503, 500, 500])
    expect(JSON.stringify(rows)).not.toContain('sensitive-error-detail')
  })

  test('proxy hops are omitted while gateway failures remain observable', async () => {
    const rows: CapturedRequest[] = []
    const capture = createRequestCapture({ enabled: () => true, store: async row => { rows.push(row) } })
    const request = new Request('https://example.test/api/workouts')
    capture.begin(request)
    capture.skip(request)
    capture.finish(request, new Response())
    capture.observe(new Request(request), () => new Response())
    capture.observe(new Request('https://example.test/api/unreachable'), () => new Response(null, { status: 502 }))
    await capture.flush()
    expect(rows.map(row => row.status_code)).toEqual([200, 502])
  })

  test('a slow or failed store stays bounded and cannot replace a response', async () => {
    let release!: () => void
    const blocked = new Promise<void>(resolve => { release = resolve })
    let writes = 0
    const capture = createRequestCapture({ enabled: () => true, maxPending: 2,
      store: async () => { writes++; await blocked; throw new Error('offline') },
      warn: () => { throw new Error('diagnostic unavailable') },
    })
    for (let i = 0; i < 5; i++) {
      const response = new Response()
      expect(capture.observe(new Request(`https://example.test/${i}`), () => response)).toBe(response)
    }
    expect(capture.stats()).toEqual({ pending: 2, dropped: 3 })
    release()
    await capture.flush()
    expect(writes).toBe(2)
    expect(capture.stats()).toEqual({ pending: 0, dropped: 5 })
  })

  test('redacts credential-bearing path tails and bounds stored paths', () => {
    expect(capturedRequestPath('https://example.test/api/password/reset/private-token?secret=yes')).toBe('/api/password/[redacted]/[redacted]')
    expect(capturedRequestPath('https://example.test/api/%74oken/private-token')).toBe('/api/%74oken/[redacted]')
    expect(capturedRequestPath(`https://example.test/${'s'.repeat(100)}`)).toBe('/[redacted]')
    expect(capturedRequestPath(`https://example.test/${'path/'.repeat(100)}`).length).toBeLessThanOrEqual(255)
  })
})
