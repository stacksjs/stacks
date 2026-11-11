import type { HqClientOptions } from '../src/client'
import { describe, expect, test } from 'bun:test'
import { createHqClient } from '../src/client'
import { createHqService } from '../src/service'
import { createMemoryHqAdapter } from '../src/testing'

const services: HqClientOptions['services'] = {
  bughq: { url: 'https://bughq.test/', readKey: 'bughq_read_abc', project: 'p 1' },
  loghq: { url: 'https://loghq.test', readKey: 'loghq_read_abc', project: 'p2' },
}

function respond(body: unknown, status = 200) {
  const calls: { url: string, init?: RequestInit }[] = []
  const fetch = async (url: string, init?: RequestInit): Promise<Response> => {
    calls.push({ url, init })
    return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status })
  }
  return { fetch, calls }
}

describe('getUsage', () => {
  test('reads a real service end to end with its read key', async () => {
    const adapter = createMemoryHqAdapter({ service: 'bughq', meters: [{ meter: 'errors', used: 450, limit: 500 }] })
    const service = createHqService(adapter)
    const { code } = await (await service.startConnect(new Request('http://x/api/cli/connect', { method: 'POST' }))).json() as { code: string }
    await service.approveConnect(code, { id: 'u' })
    const grant = await (await service.pollConnect(new Request(`http://x/api/cli/connect/${code}`))).json() as { readKey: string }

    const client = createHqClient({
      services: { bughq: { url: 'https://bughq.test', readKey: grant.readKey } },
      fetch: async (url, init) => (await service.handle(new Request(url, init)))!,
    })
    const result = await client.getUsage('bughq')
    expect(result).toMatchObject({ ok: true, data: [{ meter: 'errors', used: 450, limit: 500, state: 'warn', upgradeUrl: 'https://bughq.test/pricing' }] })

    const wrong = createHqClient({
      services: { bughq: { url: 'https://bughq.test', readKey: 'nope' } },
      fetch: async (url, init) => (await service.handle(new Request(url, init)))!,
    })
    expect(await wrong.getUsage('bughq')).toMatchObject({ ok: false, unavailable: true, reason: 'unauthorized', status: 401 })
  })

  test('never throws: every failure is a typed unavailable result', async () => {
    const boom = createHqClient({ services, fetch: async () => { throw new TypeError('fetch failed') } })
    expect(await boom.getUsage('bughq')).toEqual({ ok: false, unavailable: true, service: 'bughq', reason: 'network', message: 'fetch failed' })

    expect(await createHqClient({ services }).getUsage('statushq')).toMatchObject({ ok: false, reason: 'not_configured', service: 'statushq' })
    expect(await createHqClient({ services: { bughq: { url: '', readKey: '' } } }).getUsage('bughq')).toMatchObject({ reason: 'not_configured' })
    expect(await createHqClient({ services, ...respond('upstream down', 502) }).getUsage('bughq')).toMatchObject({ reason: 'http', status: 502 })
    expect(await createHqClient({ services, ...respond('<html>', 200) }).getUsage('bughq')).toMatchObject({ reason: 'bad_response' })
    expect(await createHqClient({ services, ...respond([{ meter: 'errors', used: 'many' }]) }).getUsage('bughq')).toMatchObject({ reason: 'bad_response' })
    // Even options that are not what the types promise.
    expect(await createHqClient({ services: null as never }).getUsage('bughq')).toMatchObject({ ok: false, unavailable: true })
  })

  test('gives up on a service that does not answer in time', async () => {
    const hang = (_url: string, init?: RequestInit): Promise<Response> => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
    })
    const result = await createHqClient({ services, fetch: hang, timeoutMs: 10 }).getUsage('loghq')
    expect(result).toMatchObject({ ok: false, reason: 'timeout', service: 'loghq' })
  })
})

describe('readers', () => {
  test('logs.list calls LogHQ\'s project log stream and normalises rows', async () => {
    const { fetch, calls } = respond({
      logs: [{ id: 9, level: 'error', message: 'boom', channel: 'app', environment: 'production', release: null, framework: 'stacks', host: 'web-1', timestamp: '2026-03-01T00:00:00.000Z', created_at: '2026-03-01T00:00:01.000Z', trace_id: 't1', request_id: null }],
      nextCursor: '2026-03-01T00:00:00.000Z',
    })
    const result = await createHqClient({ services, fetch }).logs.list({ level: ['error', 'critical'], search: 'boom', limit: 50 })
    expect(calls[0]!.url).toBe('https://loghq.test/api/projects/p2/logs?level=error%2Ccritical&q=boom&limit=50')
    expect(new Headers(calls[0]!.init?.headers).get('authorization')).toBe('Bearer loghq_read_abc')
    expect(result).toEqual({
      ok: true,
      data: {
        logs: [{ id: '9', level: 'error', message: 'boom', channel: 'app', environment: 'production', release: null, framework: 'stacks', host: 'web-1', timestamp: '2026-03-01T00:00:00.000Z', createdAt: '2026-03-01T00:00:01.000Z', traceId: 't1', requestId: null }],
        nextCursor: '2026-03-01T00:00:00.000Z',
      },
    })
  })

  test('issues.list calls BugHQ\'s project issues and normalises rows', async () => {
    const { fetch, calls } = respond({ issues: [{ id: 'i1', title: 'TypeError', culprit: 'app.ts', error_type: 'TypeError', level: 'error', status: 'unresolved', count: '12', first_seen: '2026-03-01', last_seen: '2026-03-02' }] })
    const result = await createHqClient({ services, fetch }).issues.list({ status: 'unresolved' })
    expect(calls[0]!.url).toBe('https://bughq.test/api/projects/p%201/issues?status=unresolved')
    expect(result).toEqual({ ok: true, data: [{ id: 'i1', title: 'TypeError', culprit: 'app.ts', errorType: 'TypeError', level: 'error', status: 'unresolved', count: 12, firstSeen: '2026-03-01', lastSeen: '2026-03-02' }] })
  })

  test('a project reader without a project, or a refused key, is unavailable', async () => {
    const noProject = createHqClient({ services: { loghq: { url: 'https://loghq.test', readKey: 'k' } }, ...respond({ logs: [] }) })
    expect(await noProject.logs.list()).toMatchObject({ ok: false, reason: 'not_configured' })
    // Both services answer 404 for a key that does not open the project.
    expect(await createHqClient({ services, ...respond({ error: 'not found' }, 404) }).issues.list()).toMatchObject({ ok: false, reason: 'http', status: 404 })
    expect(await createHqClient({ services, ...respond({ logs: 'nope' }) }).logs.list()).toMatchObject({ reason: 'bad_response' })
  })
})
