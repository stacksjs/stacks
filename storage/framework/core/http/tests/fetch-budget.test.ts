import { describe, expect, it } from 'bun:test'
import { fetchWithBudget } from '../src/index'

async function withServer(handler: (request: Request) => globalThis.Response | Promise<globalThis.Response>, run: (url: URL) => Promise<void>) {
  const server = Bun.serve({
    port: 0,
    hostname: '127.0.0.1',
    fetch: request => new URL(request.url).pathname === '/warm' ? new globalThis.Response('ready') : handler(request),
  })
  try {
    await (await fetch(new URL('/warm', server.url))).text()
    await run(server.url)
  }
  finally {
    server.stop(true)
  }
}

// Real loopback HTTP catches retry timing, cancellation and wire-body behavior;
// it does not establish any remote provider's availability or latency.
describe('fetchWithBudget', () => {
  it('keeps retries inside one request budget', async () => {
    let attempts = 0
    await withServer(() => {
      return new globalThis.Response('result', { status: ++attempts < 2 ? 503 : 200, headers: { 'Retry-After': '1' } })
    }, async url => {
      await expect(fetchWithBudget(url, { timeoutMs: 300, retry: 1 })).rejects.toThrow('timed out')
      expect(attempts).toBe(1)
    })
  })

  it('replays the same buffered upload after a zero-second Retry-After', async () => {
    const bodies: number[][] = []
    await withServer(async request => {
      bodies.push([...new Uint8Array(await request.arrayBuffer())])
      return new globalThis.Response('stored', { status: bodies.length === 1 ? 429 : 201, headers: { 'Retry-After': '0' } })
    }, async url => {
      const response = await fetchWithBudget(url, { method: 'POST', body: new Uint8Array([0, 1, 255]), retry: 1, timeoutMs: 500 })
      expect(response.status).toBe(201)
      expect(await response.text()).toBe('stored')
      expect(bodies).toEqual([[0, 1, 255], [0, 1, 255]])
    })
  })

  it('honors a past HTTP-date without inventing a backoff', async () => {
    let attempts = 0
    await withServer(() => new globalThis.Response('ready', { status: ++attempts === 1 ? 503 : 200, headers: { 'Retry-After': 'Wed, 21 Oct 2015 07:28:00 GMT' } }), async url => {
      expect((await fetchWithBudget(url, { retry: 1, timeoutMs: 500 })).status).toBe(200)
      expect(attempts).toBe(2)
    })
  })

  it('does not retry before a future HTTP-date inside a shorter budget', async () => {
    let attempts = 0
    await withServer(() => {
      attempts++
      return new globalThis.Response('later', { status: 429, headers: { 'Retry-After': new Date(Date.now() + 60_000).toUTCString() } })
    }, async url => {
      await expect(fetchWithBudget(url, { retry: 1, timeoutMs: 100 })).rejects.toThrow('timed out')
      expect(attempts).toBe(1)
    })
  })

  it('preserves caller cancellation while waiting to retry', async () => {
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    let attempts = 0
    try {
      await withServer(() => {
        attempts++
        timer = setTimeout(() => controller.abort(new Error('lease lost')), 20)
        return new globalThis.Response('later', { status: 429, headers: { 'Retry-After': '60' } })
      }, async url => {
        await expect(fetchWithBudget(url, { retry: 2, timeoutMs: 500, signal: controller.signal })).rejects.toThrow('lease lost')
        expect(attempts).toBe(1)
      })
    }
    finally {
      clearTimeout(timer)
    }
  })

  it('honors a Request signal before sending any bytes', async () => {
    const controller = new AbortController()
    controller.abort(new Error('already cancelled'))
    let attempts = 0
    await withServer(() => {
      attempts++
      return new globalThis.Response('unexpected')
    }, async url => {
      await expect(fetchWithBudget(new Request(url, { signal: controller.signal }))).rejects.toThrow('already cancelled')
      expect(attempts).toBe(0)
    })
  })

  it('returns the final retryable response with its body intact', async () => {
    let attempts = 0
    await withServer(() => {
      attempts++
      return new globalThis.Response('still unavailable', { status: 503, headers: { 'Retry-After': '0' } })
    }, async url => {
      const response = await fetchWithBudget(url, { retry: 1, timeoutMs: 500 })
      expect(response.status).toBe(503)
      expect(await response.text()).toBe('still unavailable')
      expect(attempts).toBe(2)
    })
  })

  it('does not retry a permanent refusal', async () => {
    let attempts = 0
    await withServer(() => {
      attempts++
      return new globalThis.Response('invalid upload', { status: 422 })
    }, async url => {
      const response = await fetchWithBudget(url, { retry: 3 })
      expect(response.status).toBe(422)
      expect(await response.text()).toBe('invalid upload')
      expect(attempts).toBe(1)
    })
  })

  it('bounds a request whose response headers never arrive', async () => {
    await withServer(() => new Promise<globalThis.Response>(() => {}), async url => {
      await expect(fetchWithBudget(url, { timeoutMs: 100 })).rejects.toThrow('timed out')
    })
  })

  it('cancels an active fetch when its caller is aborted', async () => {
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      await withServer(() => {
        timer = setTimeout(() => controller.abort(new Error('job cancelled')), 20)
        return new Promise<globalThis.Response>(() => {})
      }, async url => {
        await expect(fetchWithBudget(url, { signal: controller.signal, timeoutMs: 500 })).rejects.toThrow('job cancelled')
      })
    }
    finally {
      clearTimeout(timer)
    }
  })

  it('can complete a retry after a positive server delay within its budget', async () => {
    let attempts = 0
    let refusedAt = 0
    await withServer(() => {
      if (++attempts === 1) {
        refusedAt = performance.now()
        return new globalThis.Response('later', { status: 429, headers: { 'Retry-After': '1' } })
      }
      expect(performance.now() - refusedAt).toBeGreaterThanOrEqual(990)
      return new globalThis.Response('stored', { status: 201 })
    }, async url => {
      expect((await fetchWithBudget(url, { retry: 1, timeoutMs: 2000 })).status).toBe(201)
      expect(attempts).toBe(2)
    })
  })

  it('does not attempt to replay a consumed Request body', async () => {
    let attempts = 0
    await withServer(async request => {
      attempts++
      expect(await request.text()).toBe('one-shot')
      return new globalThis.Response('later', { status: 429, headers: { 'Retry-After': '0' } })
    }, async url => {
      const response = await fetchWithBudget(new Request(url, { method: 'POST', body: 'one-shot' }), { retry: 2 })
      expect(response.status).toBe(429)
      expect(await response.text()).toBe('later')
      expect(attempts).toBe(1)
    })
  })

  it('does not attempt to replay a streaming body', async () => {
    let attempts = 0
    await withServer(async request => {
      attempts++
      expect(await request.text()).toBe('stream')
      return new globalThis.Response('later', { status: 503, headers: { 'Retry-After': '0' } })
    }, async url => {
      const body = new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('stream')); controller.close() } })
      const response = await fetchWithBudget(url, { method: 'POST', body, retry: 1 })
      expect(response.status).toBe(503)
      expect(attempts).toBe(1)
    })
  })

  it('keeps missing and malformed retry delays inside the deadline', async () => {
    for (const header of [undefined, 'invalid', '-1']) {
      let attempts = 0
      await withServer(() => {
        attempts++
        return new globalThis.Response('later', { status: 429, headers: header ? { 'Retry-After': header } : {} })
      }, async url => {
        await expect(fetchWithBudget(url, { retry: 1, timeoutMs: 100 })).rejects.toThrow('timed out')
        expect(attempts).toBe(1)
      })
    }
  })

  it('rejects invalid budgets and retry counts before doing network work', async () => {
    for (const timeoutMs of [NaN, Infinity, -1, 0, 2_147_483_648])
      await expect(fetchWithBudget('http://127.0.0.1:9', { timeoutMs })).rejects.toBeInstanceOf(RangeError)
    for (const retry of [-1, 0.5, Infinity, NaN])
      await expect(fetchWithBudget('http://127.0.0.1:9', { retry })).rejects.toBeInstanceOf(RangeError)
  })
})
