import type { CounterStore, SqlClient } from '../src/meter'
import { Database } from 'bun:sqlite'
import { describe, expect, test } from 'bun:test'
import { createCounter, createMemoryCounterStore, droppedMeter, ensureUsageCountersTable, periodOf, sqlCounterStore, usageCountersMigrationSql } from '../src/meter'

function sqlite(): SqlClient & { db: Database } {
  const db = new Database(':memory:')
  return {
    db,
    unsafe: async (sql, params = []) => {
      const statement = db.query(sql)
      return /^\s*(?:SELECT|INSERT[\s\S]*RETURNING)/i.test(sql) ? statement.all(...params as never[]) : (statement.run(...params as never[]), [])
    },
  }
}

const at = (iso: string) => () => new Date(iso)

describe('counter', () => {
  test('record buffers without touching the store; flush folds it in', async () => {
    const store = createMemoryCounterStore()
    const counter = createCounter({ store, flushMs: 0 })
    counter.record(7, 'errors')
    counter.record(7, 'errors', 4)
    counter.record('acct_9', 'errors')
    expect(store.totals()).toEqual([])
    expect(counter.usageOf(7, 'errors')).toBe(5)

    await counter.flush()
    expect(store.totals().map(row => [row.owner, row.meter, row.delta]).sort()).toEqual([['7', 'errors', 5], ['acct_9', 'errors', 1]])
    expect(counter.usageOf(7, 'errors')).toBe(5)
  })

  test('nothing recorded reads as unknown, not zero, and an ownerless event is not metered', async () => {
    const store = createMemoryCounterStore()
    const counter = createCounter({ store, flushMs: 0 })
    expect(counter.usageOf(1, 'errors')).toBeNull()
    counter.record(null, 'errors')
    counter.record(undefined, 'errors')
    counter.record(Number.NaN, 'errors')
    counter.record(1, 'errors', 0)
    await counter.flush()
    expect(store.totals()).toEqual([])
  })

  test('two instances converge on one total instead of overwriting each other', async () => {
    const store = createMemoryCounterStore()
    const a = createCounter({ store, flushMs: 0 })
    const b = createCounter({ store, flushMs: 0 })
    for (let i = 0; i < 30; i++) a.record(1, 'errors')
    for (let i = 0; i < 12; i++) b.record(1, 'errors')
    await Promise.all([a.flush(), b.flush()])
    expect(await a.read(1, 'errors')).toBe(42)

    // Each instance learns the shared total from its own next flush.
    b.record(1, 'errors')
    await b.flush()
    expect(b.usageOf(1, 'errors')).toBe(43)
  })

  test('events arriving during a flush are neither lost nor double counted', async () => {
    const inner = createMemoryCounterStore()
    let release: () => void = () => {}
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const store: CounterStore = { read: inner.read, add: async delta => (await gate, inner.add(delta)) }
    const counter = createCounter({ store, flushMs: 0 })
    counter.record(1, 'errors', 3)
    const flushing = counter.flush()
    counter.record(1, 'errors', 2)
    // Mid-flush, the view still includes what is on its way to the store.
    expect(counter.usageOf(1, 'errors')).toBe(5)
    release()
    await flushing
    expect(counter.usageOf(1, 'errors')).toBe(5)
    await counter.flush()
    expect(await inner.read({ owner: '1', meter: 'errors', period: periodOf() })).toBe(5)
  })

  test('a failed flush drops that window and reports it, without growing the buffer', async () => {
    const errors: unknown[] = []
    const store: CounterStore = { read: async () => 0, add: async () => { throw new Error('db down') } }
    const counter = createCounter({ store, flushMs: 0, onError: error => errors.push(error) })
    counter.record(1, 'errors', 9)
    await counter.flush()
    expect(errors).toHaveLength(1)
    expect(counter.usageOf(1, 'errors')).toBeNull()
  })

  test('a new month starts a new row and forgets the old total', async () => {
    const store = createMemoryCounterStore()
    let now = '2026-01-31T23:59:59.000Z'
    const counter = createCounter({ store, flushMs: 0, now: () => new Date(now) })
    counter.record(1, 'errors', 400)
    await counter.flush()
    now = '2026-02-01T00:00:01.000Z'
    expect(counter.usageOf(1, 'errors')).toBeNull()
    counter.record(1, 'errors')
    await counter.flush()
    expect(counter.usageOf(1, 'errors')).toBe(1)
    expect(await counter.read(1, 'errors', '2026-01')).toBe(400)
  })

  test('the timer flushes on its own and stop() ends it', async () => {
    const store = createMemoryCounterStore()
    const counter = createCounter({ store, flushMs: 5, flushOnExit: false })
    counter.record(1, 'errors')
    await Bun.sleep(40)
    expect(store.totals()).toHaveLength(1)
    counter.stop()
    counter.record(1, 'errors')
    await Bun.sleep(30)
    expect(await store.read({ owner: '1', meter: 'errors', period: periodOf() })).toBe(1)
  })
})

describe('counter.admit', () => {
  test('takes everything to 120%, then one in ten, and answers without awaiting', async () => {
    const store = createMemoryCounterStore()
    const counter = createCounter({ store, flushMs: 0, now: at('2026-03-10T00:00:00.000Z') })
    const states: Record<string, number> = {}
    let kept = 0
    for (let i = 1; i <= 800; i++) {
      const admission = counter.admit(1, 'errors', 500)
      states[admission.state] = (states[admission.state] ?? 0) + 1
      if (admission.accept)
        kept++
    }
    // 600 in full, then 200 more seen of which every tenth is kept.
    expect(kept).toBe(620)
    expect(states).toEqual({ ok: 399, warn: 100, over: 101, sampled: 200 })
    expect(counter.usageOf(1, 'errors')).toBe(620)
    expect(counter.usageOf(1, droppedMeter('errors'))).toBe(180)

    await counter.flush()
    expect(await counter.read(1, 'errors')).toBe(620)
    expect(await counter.read(1, 'errors.dropped')).toBe(180)
  })

  test('reports the count stored, not the count received', () => {
    const counter = createCounter({ store: createMemoryCounterStore(), flushMs: 0 })
    for (let i = 0; i < 12; i++) counter.admit(1, 'errors', 10)
    const dropped = counter.admit(1, 'errors', 10)
    expect(dropped).toMatchObject({ accept: false, state: 'sampled', used: 12, limit: 10, meter: 'errors' })
  })

  test('after a restart the durable total is learned behind the first event', async () => {
    const store = createMemoryCounterStore()
    await store.add({ owner: '1', meter: 'errors', period: periodOf(), delta: 600 })
    const counter = createCounter({ store, flushMs: 0 })
    // Decided from zero: nothing is known yet and the request must not wait.
    expect(counter.admit(1, 'errors', 500)).toMatchObject({ accept: true, state: 'ok' })
    await counter.prime(1, 'errors')
    expect(counter.admit(1, 'errors', 500).state).toBe('sampled')
  })

  test('an unlimited meter and an ownerless event are always accepted', () => {
    const counter = createCounter({ store: createMemoryCounterStore(), flushMs: 0 })
    expect(counter.admit(1, 'errors', null)).toMatchObject({ accept: true, state: 'ok', limit: null })
    expect(counter.admit(null, 'errors', 0)).toMatchObject({ accept: true })
    expect(counter.usageOf(1, 'errors')).toBe(1)
  })
})

describe('usage_counters schema and SQL store', () => {
  test('ships a schema per dialect keyed by owner, meter and period', () => {
    for (const dialect of ['sqlite', 'mysql', 'postgres'] as const) {
      const [sql] = usageCountersMigrationSql({ dialect })
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS usage_counters')
      expect(sql).toContain('PRIMARY KEY (owner, meter, period)')
    }
    expect(() => usageCountersMigrationSql({ table: 'x; DROP TABLE users' })).toThrow('Invalid table name')
  })

  test('the upsert adds on the database side and answers the new total', async () => {
    const client = sqlite()
    await ensureUsageCountersTable(client)
    await ensureUsageCountersTable(client)
    const store = sqlCounterStore(client)
    const key = { owner: '42', meter: 'errors', period: '2026-03' }
    expect(await store.read(key)).toBe(0)
    expect(await store.add({ ...key, delta: 5 })).toBe(5)
    expect(await store.add({ ...key, delta: 7 })).toBe(12)
    expect(await store.add({ ...key, period: '2026-04', delta: 1 })).toBe(1)
    expect(await store.read(key)).toBe(12)
    expect(client.db.query('SELECT COUNT(*) AS n FROM usage_counters').get()).toEqual({ n: 2 })
  })

  test('a counter over the SQL store persists across instances', async () => {
    const client = sqlite()
    await ensureUsageCountersTable(client)
    const first = createCounter({ store: sqlCounterStore(client), flushMs: 0 })
    first.record(1, 'log_lines', 250)
    await first.flush()
    const second = createCounter({ store: sqlCounterStore(client), flushMs: 0 })
    second.record(1, 'log_lines', 50)
    await second.flush()
    expect(second.usageOf(1, 'log_lines')).toBe(300)
  })

  test('writes the placeholders each dialect expects', async () => {
    const seen: string[] = []
    const client: SqlClient = { unsafe: async (sql) => { seen.push(sql); return [{ used: 1 }] } }
    await sqlCounterStore(client, { dialect: 'postgres' }).add({ owner: '1', meter: 'm', period: '2026-01', delta: 1 })
    await sqlCounterStore(client, { dialect: 'mysql' }).add({ owner: '1', meter: 'm', period: '2026-01', delta: 1 })
    expect(seen[0]).toContain('VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP) ON CONFLICT (owner, meter, period) DO UPDATE SET used = usage_counters.used + EXCLUDED.used')
    expect(seen[1]).toContain('ON DUPLICATE KEY UPDATE used = used + VALUES(used)')
    expect(seen[2]).toContain('SELECT used FROM usage_counters WHERE owner = ? AND meter = ? AND period = ?')
  })
})
