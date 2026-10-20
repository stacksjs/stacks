import { describe, expect, test } from 'bun:test'
import {
  emptyLogPayload,
} from '../../storage/framework/defaults/app/Actions/Dashboard/Infrastructure/log-provider'
import {
  readThroughProvider,
} from '../../storage/framework/defaults/app/Actions/Dashboard/dashboard-provider'
import {
  HQ_DEFAULT_TIMEOUT_MS,
  HQ_MAX_TIMEOUT_MS,
  hqConfigured,
  HqReadError,
  hqRead,
  hqTimeout,
  hqUrl,
} from '../../storage/framework/defaults/app/Actions/Dashboard/hq-read'

/**
 * The hosted-read client.
 *
 * `dashboard-provider.ts` promises that a remote section degrades three ways:
 * the provider rejects, it never answers, or it answers with the wrong shape.
 * Two of those were already true. "Never answers" was not — nothing in the
 * seam imposed a deadline, so a hung connection hung the section's request
 * with it. The deadline lives here, which is why it is tested here.
 *
 * The other property worth pinning is that the read key never leaves
 * `Authorization`. A key in a query string survives in proxy logs, browser
 * history and error reports long after the request is over.
 */

const OPTIONS = { baseUrl: 'https://logs.example.test/api', token: 'lhq_read_secret' }

/** A fetch that answers with `body`, as JSON, with the given status. */
function answering(body: unknown, status = 200, contentType = 'application/json') {
  const seen: { url?: string, headers?: Record<string, string> } = {}
  const impl = (async (url: string | URL, init?: RequestInit) => {
    seen.url = String(url)
    seen.headers = (init?.headers ?? {}) as Record<string, string>
    return new Response(contentType === 'application/json' ? JSON.stringify(body) : String(body), {
      status,
      headers: { 'content-type': contentType },
    })
  }) as unknown as typeof fetch
  return { impl, seen }
}

/** A fetch that never answers until its caller's signal aborts it. */
const hanging = (async (_url: string | URL, init?: RequestInit) => {
  return await new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject((init.signal as AbortSignal).reason))
  })
}) as unknown as typeof fetch

describe('hosted read — addresses', () => {
  test('joins a base and a path on exactly one slash, however each is spelled', () => {
    for (const base of ['https://h.test/api', 'https://h.test/api/'])
      for (const path of ['projects/7/logs', '/projects/7/logs'])
        expect(hqUrl(base, path)).toBe('https://h.test/api/projects/7/logs')
  })

  test('adds only the query values that were given', () => {
    const url = hqUrl('https://h.test/api', '/logs', { limit: 25, q: '', cursor: undefined, level: 'error' })
    expect(url).toBe('https://h.test/api/logs?limit=25&level=error')
  })
})

describe('hosted read — the key', () => {
  test('travels in Authorization and never in the URL', async () => {
    const { impl, seen } = answering({ logs: [] })
    await hqRead(OPTIONS, '/projects/7/logs', { limit: 1 }, impl)
    expect(seen.headers?.authorization).toBe('Bearer lhq_read_secret')
    expect(seen.url).not.toContain('lhq_read_secret')
    expect(seen.url).toBe('https://logs.example.test/api/projects/7/logs?limit=1')
  })
})

describe('hosted read — timeouts', () => {
  test('falls back, and clamps, rather than letting a typo disable the deadline', () => {
    expect(hqTimeout(undefined)).toBe(HQ_DEFAULT_TIMEOUT_MS)
    expect(hqTimeout({ timeoutMs: 0 })).toBe(HQ_DEFAULT_TIMEOUT_MS)
    expect(hqTimeout({ timeoutMs: -1 })).toBe(HQ_DEFAULT_TIMEOUT_MS)
    expect(hqTimeout({ timeoutMs: Number.NaN })).toBe(HQ_DEFAULT_TIMEOUT_MS)
    expect(hqTimeout({ timeoutMs: 250 })).toBe(250)
    expect(hqTimeout({ timeoutMs: 10 ** 9 })).toBe(HQ_MAX_TIMEOUT_MS)
  })

  // The degrade path the seam documented and did not have.
  test('a provider that never answers is given up on, not waited for', async () => {
    const started = Date.now()
    const read = hqRead({ ...OPTIONS, timeoutMs: 60 }, '/projects/7/logs', undefined, hanging)
    await expect(read).rejects.toBeInstanceOf(HqReadError)
    expect(Date.now() - started).toBeLessThan(5000)
    await read.catch((error: HqReadError) => {
      expect(error.message).toContain('did not answer within 60ms')
      expect(error.status).toBeUndefined()
    })
  })
})

describe('hosted read — failures', () => {
  test('says so distinctly when nothing is configured, and never calls out', async () => {
    let called = false
    const impl = (async () => { called = true; return new Response('{}') }) as unknown as typeof fetch
    for (const options of [undefined, {}, { baseUrl: 'https://h.test' }, { token: 'x' }]) {
      expect(hqConfigured(options)).toBe(false)
      await expect(hqRead(options, '/logs', undefined, impl)).rejects.toThrow(/no baseUrl and token/)
    }
    expect(called).toBe(false)
  })

  test('carries the status, so a bad key reads differently from a bad id', async () => {
    for (const status of [401, 403, 404, 500]) {
      const { impl } = answering({ error: 'nope' }, status)
      await hqRead(OPTIONS, '/projects/7/logs', undefined, impl).catch((error: HqReadError) => {
        expect(error).toBeInstanceOf(HqReadError)
        expect(error.status).toBe(status)
        expect(error.message).toContain(String(status))
      })
    }
  })

  test('a 2xx that is not JSON is a failure, not an empty answer', async () => {
    const { impl } = answering('<html>sign in</html>', 200, 'text/html')
    await expect(hqRead(OPTIONS, '/projects/7/logs', undefined, impl)).rejects.toThrow(/not JSON/)
  })

  test('an answer is returned as it came', async () => {
    const { impl } = answering({ logs: [{ id: 1 }], nextCursor: null })
    expect(await hqRead(OPTIONS, '/projects/7/logs', undefined, impl)).toEqual({ logs: [{ id: 1 }], nextCursor: null })
  })
})

describe('hosted read — through the seam', () => {
  // The point of raising rather than returning: a driver never handles its own
  // failure, and the section still renders.
  test('every failure becomes an empty section carrying a reason', async () => {
    const query = { page: 1, perPage: 25, search: '', type: '', source: '', project: '', range: 'all' as const }
    const isLogPayload = (payload: unknown) => Array.isArray((payload as { logs?: unknown })?.logs)

    for (const read of [
      () => hqRead(OPTIONS, '/logs', undefined, answering({ error: 'x' }, 500).impl),
      () => hqRead({ ...OPTIONS, timeoutMs: 40 }, '/logs', undefined, hanging),
      () => hqRead(undefined, '/logs', undefined, answering({}).impl),
    ]) {
      const payload = await readThroughProvider(
        'logs',
        reason => emptyLogPayload(reason, query),
        read as () => Promise<ReturnType<typeof emptyLogPayload>>,
        isLogPayload,
      )
      expect(payload.logs).toEqual([])
      expect(payload.unavailable).toBeTruthy()
    }
  })

  test('an answer of the wrong shape is caught before it reaches a component', async () => {
    const query = { page: 1, perPage: 25, search: '', type: '', source: '', project: '', range: 'all' as const }
    const payload = await readThroughProvider(
      'logs',
      reason => emptyLogPayload(reason, query),
      // A 200 with no `logs` array: the case that fails inside the component
      // rather than at the boundary, which is a blank page rather than an
      // empty state.
      () => hqRead(OPTIONS, '/logs', undefined, answering({ entries: [] }).impl) as any,
      (value: unknown) => Array.isArray((value as { logs?: unknown })?.logs),
    )
    expect(payload.logs).toEqual([])
    expect(payload.unavailable).toBeTruthy()
  })
})
