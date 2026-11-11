import type { SqlClient } from '../src/meter'
import { Database } from 'bun:sqlite'
import { describe, expect, test } from 'bun:test'
import { connectCodesMigrationSql, createHqService, ensureConnectCodesTable, sqlConnectCodeStore } from '../src/service'
import { createMemoryHqAdapter, hqServiceContract } from '../src/testing'

function sqlite(): SqlClient {
  const db = new Database(':memory:')
  return {
    unsafe: async (sql, params = []) => {
      const statement = db.query(sql)
      return /^\s*SELECT/i.test(sql) ? statement.all(...params as never[]) : (statement.run(...params as never[]), [])
    },
  }
}

// The reference adapter, over both code stores the package ships.
hqServiceContract('memory adapter', () => ({ adapter: createMemoryHqAdapter(), user: { id: 'user_1' } }))

hqServiceContract('memory adapter over the SQL code store', async () => {
  const client = sqlite()
  await ensureConnectCodesTable(client)
  return { adapter: { ...createMemoryHqAdapter(), codes: sqlConnectCodeStore(client) }, user: { id: 'user_1' } }
})

describe('usage endpoint', () => {
  test('derives each meter\'s state from its own policy', async () => {
    const adapter = createMemoryHqAdapter({
      service: 'commshq',
      meters: [
        { meter: 'emails', used: 130, limit: 100, policy: 'hard-send' },
        { meter: 'events', used: 130, limit: 100 },
        { meter: 'contacts', used: 80, limit: 100, policy: 'hard-send', period: '2026-01' },
        { meter: 'sms', used: 5, limit: null },
      ],
    })
    const service = createHqService(adapter, { now: () => new Date('2026-06-02T00:00:00.000Z') })
    const { code } = await (await service.startConnect(new Request('http://x/api/cli/connect', { method: 'POST' }))).json() as { code: string }
    await service.approveConnect(code, { id: 'u' })
    const grant = await (await service.pollConnect(new Request(`http://x/api/cli/connect/${code}`))).json() as { readKey: string }

    const response = await service.usage(new Request('http://x/api/v1/usage', { headers: { authorization: `Bearer ${grant.readKey}` } }))
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(await response.json()).toEqual([
      { meter: 'emails', used: 130, limit: 100, period: '2026-06', state: 'over', upgradeUrl: 'https://commshq.test/pricing' },
      { meter: 'events', used: 130, limit: 100, period: '2026-06', state: 'sampled', upgradeUrl: 'https://commshq.test/pricing' },
      { meter: 'contacts', used: 80, limit: 100, period: '2026-01', state: 'warn', upgradeUrl: 'https://commshq.test/pricing' },
      { meter: 'sms', used: 5, limit: null, period: '2026-06', state: 'ok', upgradeUrl: 'https://commshq.test/pricing' },
    ])
  })
})

describe('connect', () => {
  test('reads the code from router params and names the three routes', async () => {
    const service = createHqService(createMemoryHqAdapter())
    expect(service.routes.map(route => `${route.method} ${route.path}`)).toEqual([
      'POST /api/cli/connect',
      'GET /api/cli/connect/{code}',
      'GET /api/v1/usage',
    ])
    const started = await service.routes[0]!.handler({ url: '/api/cli/connect', headers: new Headers(), json: async () => ({ app: 'Cursio <script>' }) })
    const { code } = await started.json() as { code: string }
    expect(await service.describeConnect(code)).toMatchObject({ app: 'Cursio script' })
    const polled = await service.routes[1]!.handler({ url: '/ignored', headers: new Headers(), params: { code } })
    expect(await polled.json()).toEqual({ status: 'pending' })
  })

  test('ships the code table schema', () => {
    expect(connectCodesMigrationSql()[0]).toContain('CREATE TABLE IF NOT EXISTS hq_connect_codes')
  })
})
