import type { RouteManifest } from '@stacksjs/hq/route-manifest'
import { describe, expect, it } from 'bun:test'
import { describeRouteSync, ROUTE_SYNC_PATH, syncRoutes, validationOf } from '../src/hq-routes'

const MANIFEST: RouteManifest = {
  version: 1,
  checks: [
    { id: 'GET /', method: 'GET', path: '/', kind: 'page', expect: ['2xx', '3xx'] },
    { id: 'GET /api/me', method: 'GET', path: '/api/me', kind: 'guard', expect: ['401', '403', '3xx'] },
  ],
  skipped: [{ method: 'POST', path: '/api/things', reason: 'writes without validating, so asking would run it' }],
}

const REPORT = {
  monitor: { id: 7, name: 'my-app routes', dashboardUrl: 'https://statushq.test/dashboard/monitors/7', intervalSeconds: 300 },
  checks: { total: 2, added: 2, changed: 0, removed: 0, unchanged: 0 },
  notMonitored: [],
}

function server(answer: (request: { url: string, init?: RequestInit }) => Response) {
  const calls: Array<{ url: string, init?: RequestInit }> = []
  return { calls, fetch: async (url: string, init?: RequestInit) => {
    calls.push({ url, init })
    return answer({ url, init })
  } }
}

const json = (body: unknown, status = 200): Response => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

describe('syncing routes to StatusHQ', () => {
  it('posts the manifest with the key and the app\'s address', async () => {
    const s = server(() => json(REPORT))
    const outcome = await syncRoutes({ url: 'https://statushq.test/', key: 'shq_key' }, { name: 'my-app', baseUrl: 'my-app.example/' }, MANIFEST, s)
    expect(outcome).toEqual({ ok: true, report: REPORT })
    expect(s.calls[0]!.url).toBe(`https://statushq.test${ROUTE_SYNC_PATH}`)
    expect((s.calls[0]!.init!.headers as Record<string, string>).Authorization).toBe('Bearer shq_key')
    expect(JSON.parse(String(s.calls[0]!.init!.body))).toEqual({ app: 'my-app', baseUrl: 'https://my-app.example', manifest: MANIFEST })
  })

  it('sends nothing for an address StatusHQ could not reach, and says so', async () => {
    for (const baseUrl of ['http://localhost:3000', 'https://my-app.localhost', 'http://127.0.0.1', '']) {
      const s = server(() => json(REPORT))
      const outcome = await syncRoutes({ url: 'https://statushq.test', key: 'k' }, { name: 'a', baseUrl }, MANIFEST, s)
      expect(outcome.ok).toBe(false)
      expect(s.calls).toHaveLength(0)
    }
  })

  it('names what went wrong without throwing', async () => {
    const at = (response: () => Response) => syncRoutes({ url: 'https://statushq.test', key: 'k' }, { name: 'a', baseUrl: 'https://a.example' }, MANIFEST, server(response))
    expect(await at(() => json({ error: 'not found' }, 404))).toEqual({ ok: false, reason: 'this StatusHQ does not take route syncs yet' })
    expect(await at(() => json({ error: 'unauthorized' }, 401))).toMatchObject({ ok: false, reason: expect.stringContaining('refused the key') })
    expect(await at(() => json({ error: 'The free plan has 3 monitors, all in use.' }, 402))).toEqual({ ok: false, reason: 'The free plan has 3 monitors, all in use.' })
    expect(await at(() => json({ hello: 'world' }))).toMatchObject({ ok: false, reason: expect.stringContaining('not a sync report') })
    expect(await at(() => { throw new Error('offline') })).toEqual({ ok: false, reason: 'could not reach https://statushq.test' })
    expect(await syncRoutes({ url: 'https://statushq.test', key: '' }, { name: 'a', baseUrl: 'https://a.example' }, MANIFEST, server(() => json(REPORT)))).toMatchObject({ ok: false, reason: expect.stringContaining('STATUSHQ_KEY') })
  })

  it('says what is checked, what changed and what was not monitored', () => {
    const lines = describeRouteSync(MANIFEST, { ok: true, report: { ...REPORT, notMonitored: [{ id: 'GET /api/me', reason: 'over the plan\'s 1 check' }] } })
    expect(lines[0]).toBe('StatusHQ: checking 2 route(s) as "my-app routes", every 5 min.')
    expect(lines.join('\n')).toContain('2 added, 0 changed, 0 removed, 0 unchanged')
    expect(lines.join('\n')).toContain('GET /api/me: over the plan\'s 1 check')
    expect(describeRouteSync(MANIFEST, { ok: false, reason: 'offline' })[0]).toBe('StatusHQ: routes not synced (offline)')
    // Shown to a person: no dash an editor would flag.
    expect(lines.join('\n')).not.toMatch(/[–—]/)
  })
})

describe('whether an empty body is refused', () => {
  const rule = (valid: boolean) => ({ rule: { validate: () => ({ valid }) } })

  it('is required when any rule refuses nothing', () => {
    expect(validationOf({ name: rule(true), email: rule(false) })).toBe('required')
    expect(validationOf({ email: { rule: { validate: () => { throw new Error('required') } } } })).toBe('required')
  })

  it('is optional when every rule accepts nothing, and unknown without rules', () => {
    expect(validationOf({ q: rule(true) })).toBe('optional')
    expect(validationOf({})).toBeUndefined()
    expect(validationOf(undefined)).toBeUndefined()
  })

  it('does not vouch for a rule that answers later', () => {
    expect(validationOf({ slow: { rule: { validate: () => Promise.resolve({ valid: false }) } } })).toBe('optional')
  })
})

describe('an app with no route files', () => {
  it('keeps the registry entries whose file exists and drops the rest', async () => {
    const { mkdtempSync, writeFileSync } = await import('node:fs')
    const { tmpdir } = await import('node:os')
    const { join } = await import('node:path')
    const { existingRouteFiles } = await import('../src/hq-routes')
    const root = mkdtempSync(join(tmpdir(), 'routes-'))
    writeFileSync(join(root, 'web.ts'), '')
    // The default registry names routes/api.ts, which a pages-only app has not got.
    expect(await existingRouteFiles({ api: 'api', web: { path: 'web' } }, root)).toEqual({ web: { path: 'web' } })
    expect(await existingRouteFiles({ api: 'api' }, root)).toEqual({})
  })
})
