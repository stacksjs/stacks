import { afterAll, afterEach, beforeAll, describe, expect, it } from 'bun:test'
import { configureOrm, getDatabase, releaseOrm } from 'bun-query-builder'
import { acquireDbConfigLock } from '@stacksjs/database'
import { listen, off } from '@stacksjs/events'
import { defineModel, withoutEvents } from '../src/define-model'

const Model = defineModel({
  name: 'EventCacheProbe',
  table: 'event_cache_probes',
  primaryKey: 'id',
  autoIncrement: true,
  traits: { observe: true },
  attributes: { label: { type: 'string', fillable: true } },
} as const)

const subscriptions: Array<() => void> = []
function on(event: string, handler: (payload: unknown) => unknown): void {
  // This fixture's model name is composed at runtime, outside the app registry.
  const key = `eventcacheprobe:${event}` as Parameters<typeof listen>[0]
  listen(key, handler)
  subscriptions.push(() => off(key, handler))
}

describe('observed writes keep the event registry live', () => {
  let unlock: () => void
  beforeAll(async () => {
    unlock = await acquireDbConfigLock()
    configureOrm({ database: ':memory:' })
    getDatabase().run('CREATE TABLE event_cache_probes (id INTEGER PRIMARY KEY AUTOINCREMENT, label TEXT, deleted_at TEXT)')
  })
  afterEach(() => {
    for (const unsubscribe of subscriptions.splice(0)) unsubscribe()
    getDatabase().run('DELETE FROM event_cache_probes')
  })
  afterAll(() => {
    releaseOrm()
    unlock()
  })

  it('delivers ordered lifecycle events and sees listeners added after warmup', async () => {
    await Model.create({ label: 'warm' })
    const seen: string[] = []
    const rows: unknown[] = []
    for (const name of ['saving', 'creating', 'created', 'saved'])
      on(name, payload => { seen.push(name); if (name === 'created') rows.push(payload) })
    const created = await Model.create({ label: 'live' })
    expect(seen).toEqual(['saving', 'creating', 'created', 'saved'])
    expect(rows).toEqual([expect.objectContaining({ id: created.id, label: 'live' })])
    for (const unsubscribe of subscriptions.splice(0)) unsubscribe()
    await Model.create({ label: 'removed' })
    expect(seen).toHaveLength(4)
    expect(getDatabase().query('SELECT COUNT(*) AS n FROM event_cache_probes').get()).toEqual({ n: 3 })
  })

  it('awaits before listeners and preserves cancellation and thrown errors', async () => {
    await Model.create({ label: 'warm' })
    on('creating', async () => { await Promise.resolve(); return false })
    await expect(Model.create({ label: 'cancelled' })).rejects.toThrow('event cancelled the operation')
    for (const unsubscribe of subscriptions.splice(0)) unsubscribe()
    on('creating', async () => { await Promise.resolve(); throw new Error('listener failed') })
    await expect(Model.create({ label: 'failed' })).rejects.toThrow('listener failed')
    expect(getDatabase().query('SELECT label FROM event_cache_probes').all()).toEqual([{ label: 'warm' }])
  })

  it('does not mistake a listener missing dependency for absent event support', async () => {
    await Model.create({ label: 'warm' })
    on('creating', () => {
      throw Object.assign(new Error('listener dependency missing'), { code: 'MODULE_NOT_FOUND' })
    })
    await expect(Model.create({ label: 'failed' })).rejects.toThrow('listener dependency missing')
    expect(getDatabase().query('SELECT label FROM event_cache_probes').all()).toEqual([{ label: 'warm' }])
  })

  it('aborts updates and deletes before persisted data changes', async () => {
    const row = await Model.create({ label: 'original' })
    on('updating', () => { throw new Error('update failed') })
    await expect(row.updateAsync({ label: 'changed' })).rejects.toThrow('update failed')
    on('deleting', async () => { await Promise.resolve(); throw new Error('delete failed') })
    await expect(row.delete()).rejects.toThrow('delete failed')
    expect(getDatabase().query('SELECT label FROM event_cache_probes').all()).toEqual([{ label: 'original' }])
  })

  it('suppresses only the current async scope and resumes delivery afterward', async () => {
    const seen: unknown[] = []
    on('created', payload => { seen.push(payload) })
    await Promise.all([
      withoutEvents(async () => { await Promise.resolve(); await Model.create({ label: 'quiet' }) }),
      Model.create({ label: 'parallel' }),
    ])
    await Model.create({ label: 'after' })
    expect(seen).toEqual([
      expect.objectContaining({ label: 'parallel' }),
      expect.objectContaining({ label: 'after' }),
    ])
    expect(getDatabase().query('SELECT COUNT(*) AS n FROM event_cache_probes').get()).toEqual({ n: 3 })
  })

  it('keeps the swallow opt-out while explicit cancellation still wins', async () => {
    const previous = process.env.STACKS_ORM_EVENT_ERRORS
    process.env.STACKS_ORM_EVENT_ERRORS = 'swallow'
    try {
      on('creating', () => { throw new Error('optional listener failed') })
      await Model.create({ label: 'allowed' })
      on('creating', () => false)
      await expect(Model.create({ label: 'cancelled' })).rejects.toThrow('event cancelled the operation')
      expect(getDatabase().query('SELECT label FROM event_cache_probes').all()).toEqual([{ label: 'allowed' }])
    }
    finally {
      if (previous === undefined) delete process.env.STACKS_ORM_EVENT_ERRORS
      else process.env.STACKS_ORM_EVENT_ERRORS = previous
    }
  })
})
