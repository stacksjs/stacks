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
  it('observes redirected response metadata without consuming its body', async () => {
    const requests: string[] = []
    const observations: { kind: 'attempt' | 'response', value: unknown }[] = []
    // This real HTTP seam catches missing safe response notifications and a
    // consumed body. It does not prove remote throughput or body progress.
    await withServer((request) => {
      requests.push(new URL(request.url).pathname)
      return new globalThis.Response('verified-body', {
        headers: { 'Content-Length': '13', 'X-Private-Receipt': 'hidden-header-marker' },
      })
    }, async target => {
      const destination = new URL('/private-target?token=target-query-marker', target)
      await withServer((request) => {
        requests.push(new URL(request.url).pathname)
        return globalThis.Response.redirect(destination.href, 302)
      }, async origin => {
        // An options variable reaches the existing export on old source.
        // No new factory or type import can substitute for runtime RED.
        const options = {
          timeoutMs: 500,
          retry: 0,
          headers: { Authorization: 'Bearer hidden-request-marker' },
          observer: {
            onAttempt(value: unknown) { observations.push({ kind: 'attempt', value }) },
            onResponse(value: unknown) { observations.push({ kind: 'response', value }) },
          },
        }
        const response = await fetchWithBudget(new URL('/private-origin?token=origin-query-marker', origin), options)

        // Confirm real redirected HTTP and an intact caller-owned body before
        // the old implementation reaches the intended observer-absence RED.
        expect(requests).toEqual(['/private-origin', '/private-target'])
        expect(response.status).toBe(200)
        expect(response.redirected).toBe(true)
        expect(new URL(response.url).origin).toBe(target.origin)
        expect(new URL(response.url).pathname).toBe('/private-target')
        expect(await response.text()).toBe('verified-body')

        expect(observations).toEqual([
          { kind: 'attempt', value: { attempt: 1, requestedOrigin: origin.origin, originOmitted: null } },
          { kind: 'response', value: { attempt: 1, responseOrigin: target.origin, originOmitted: null, status: 200, contentLength: 13 } },
        ])
        for (const observation of observations)
          expect(Object.isFrozen(observation.value)).toBe(true)
        const serialized = JSON.stringify(observations)
        for (const secret of ['private-origin', 'private-target', 'origin-query-marker', 'target-query-marker', 'hidden-header-marker', 'hidden-request-marker', 'verified-body'])
          expect(serialized).not.toContain(secret)
      })
    })
  })

  it('preserves the observer receiver for attempt and response methods', async () => {
    const seen: unknown[] = []
    const observer = {
      seen,
      onAttempt(value: unknown) { this.seen.push(value) },
      onResponse(value: unknown) { this.seen.push(value) },
    }
    await withServer(() => new globalThis.Response('receiver intact'), async url => {
      const response = await fetchWithBudget(url, { observer, timeoutMs: 500 })
      expect(await response.text()).toBe('receiver intact')
      expect(observer.seen).toEqual([
        { attempt: 1, requestedOrigin: url.origin, originOmitted: null },
        { attempt: 1, responseOrigin: url.origin, originOmitted: null, status: 200, contentLength: 15 },
      ])
    })
  })

  it('isolates observer method getter and promise failures from the real response', async () => {
    const calls: string[] = []
    const fail = (name: string): never => {
      calls.push(name)
      throw new Error('Observer failure must stay isolated')
    }
    const rejected = (name: string): Promise<void> => {
      calls.push(name)
      return Promise.reject(new Error('Observer rejection must stay isolated'))
    }
    const unreadablePromise = (name: string): Promise<void> => {
      calls.push(name)
      return Object.defineProperty(Promise.resolve(), 'then', { get() { throw new Error('Observer promise access must stay isolated') } })
    }
    const observers = [
      { onAttempt() { fail('method attempt') }, onResponse() { fail('method response') } },
      { get onAttempt() { return fail('getter attempt') }, get onResponse() { return fail('getter response') } },
      { onAttempt() { return rejected('async attempt') }, onResponse() { return rejected('async response') } },
      { onAttempt() { return unreadablePromise('promise attempt') }, onResponse() { return unreadablePromise('promise response') } },
    ]
    let requests = 0
    await withServer(() => {
      requests++
      return new globalThis.Response('response survives')
    }, async url => {
      for (const observer of observers) {
        const response = await fetchWithBudget(url, { observer, timeoutMs: 500 })
        expect(response.status).toBe(200)
        expect(await response.text()).toBe('response survives')
      }
      expect(requests).toBe(4)
      expect(calls).toEqual(['method attempt', 'method response', 'getter attempt', 'getter response', 'async attempt', 'async response', 'promise attempt', 'promise response'])
    })
  })

  it('isolates a rejected native observer promise with a throwing then getter', async () => {
    let requests = 0
    let callbacks = 0
    let returned: Promise<void> | undefined
    const observer = {
      onResponse(): Promise<void> {
        callbacks++
        returned = Object.defineProperty(
          Promise.reject<void>(new Error('HTTP observer rejected native promise remained unhandled')),
          'then',
          { get() { throw new Error('HTTP observer native promise then getter failed') } },
        )
        return returned
      },
    }
    await withServer(() => {
      requests++
      return new globalThis.Response('verified-body')
    }, async url => {
      const response = await fetchWithBudget(url, { observer, timeoutMs: 500 })
      expect(response.status).toBe(200)
      expect(await response.text()).toBe('verified-body')
      expect(requests).toBe(1)
      expect(callbacks).toBe(1)
      expect(returned).toBeInstanceOf(Promise)
      // Leave this native rejection to the HTTP helper. Bun's unhandled
      // rejection check must fail if the helper swallows only the getter error.
      expect(Object.getOwnPropertyDescriptor(returned!, 'then')?.get).toBeFunction()
    })
  })

  it('reports only safe Content-Length integers from real HEAD responses', async () => {
    const responses: unknown[] = []
    const observer = { onResponse(value: unknown) { responses.push(value) } }
    const cases = [
      ['0', 0],
      ['13', 13],
      ['00013', 13],
      ['9007199254740991', Number.MAX_SAFE_INTEGER],
      ['9007199254740992', null],
      ['10000000000000000', null],
    ] as const
    await withServer(request => new globalThis.Response(null, {
      headers: { 'Content-Length': new URL(request.url).pathname.slice(1) },
    }), async url => {
      for (const [header, expected] of cases) {
        const response = await fetchWithBudget(new URL(`/${header}`, url), { method: 'HEAD', observer, timeoutMs: 500 })
        expect(response.status).toBe(200)
        expect(await response.text()).toBe('')
        expect(responses.at(-1)).toEqual({ attempt: 1, responseOrigin: url.origin, originOmitted: null, status: 200, contentLength: expected })
      }
      expect(responses).toHaveLength(cases.length)
    })
  })

  it('bounds observed URL processing without rejecting real requests', async () => {
    const observations: unknown[] = []
    const observer = {
      onAttempt(value: unknown) { observations.push(value) },
      onResponse(value: unknown) { observations.push(value) },
    }
    let requests = 0
    await withServer(() => {
      requests++
      return new globalThis.Response('bounded')
    }, async url => {
      for (const length of [4096, 4097]) {
        observations.length = 0
        const requested = new URL(`/${'x'.repeat(length - url.origin.length - 1)}`, url)
        expect(requested.href.length).toBe(length)
        const response = await fetchWithBudget(requested, { observer, timeoutMs: 500 })
        expect(await response.text()).toBe('bounded')
        const omitted = length > 4096 ? 'oversized' : null
        const origin = omitted ? null : url.origin
        expect(observations).toEqual([
          { attempt: 1, requestedOrigin: origin, originOmitted: omitted },
          { attempt: 1, responseOrigin: origin, originOmitted: omitted, status: 200, contentLength: 7 },
        ])
        expect(JSON.stringify(observations).length).toBeLessThan(512)
      }
      expect(requests).toBe(2)
    })
  })

  it('observes each actual retry without consuming the final body', async () => {
    const observations: { kind: 'attempt' | 'response', value: unknown }[] = []
    const observer = {
      onAttempt(value: unknown) { observations.push({ kind: 'attempt', value }) },
      onResponse(value: unknown) { observations.push({ kind: 'response', value }) },
    }
    let requests = 0
    await withServer(() => ++requests === 1
      ? new globalThis.Response('try', { status: 503, headers: { 'Retry-After': '0' } })
      : new globalThis.Response('done'), async url => {
      const response = await fetchWithBudget(url, { observer, retry: 1, timeoutMs: 500 })
      expect(await response.text()).toBe('done')
      expect(requests).toBe(2)
      expect(observations).toEqual([
        { kind: 'attempt', value: { attempt: 1, requestedOrigin: url.origin, originOmitted: null } },
        { kind: 'response', value: { attempt: 1, responseOrigin: url.origin, originOmitted: null, status: 503, contentLength: 3 } },
        { kind: 'attempt', value: { attempt: 2, requestedOrigin: url.origin, originOmitted: null } },
        { kind: 'response', value: { attempt: 2, responseOrigin: url.origin, originOmitted: null, status: 200, contentLength: 4 } },
      ])
    })
  })

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
