import { afterAll, afterEach, beforeAll, describe, expect, it } from 'bun:test'
import { configureOrm, getDatabase, releaseOrm } from 'bun-query-builder'
import { acquireDbConfigLock } from '@stacksjs/database'
import { listen, off } from '@stacksjs/events'
import { defineModel, withoutEvents } from '../src/define-model'

const Model = defineModel({
  name: 'RestoreScopeProbe',
  table: 'restore_scope_probes',
  primaryKey: 'id',
  autoIncrement: true,
  traits: { observe: true, useSoftDeletes: true },
  attributes: { label: { type: 'string', fillable: true } },
} as const)
const subscriptions: Array<() => void> = []
function on(event: string, handler: (payload: unknown) => unknown): void {
  const key = `restorescopeprobe:${event}` as Parameters<typeof listen>[0]
  listen(key, handler)
  subscriptions.push(() => off(key, handler))
}

describe('restore includes the deleted row in its update', () => {
  let unlock: () => void
  beforeAll(async () => {
    unlock = await acquireDbConfigLock()
    configureOrm({ database: ':memory:' })
    getDatabase().run('CREATE TABLE restore_scope_probes (id INTEGER PRIMARY KEY AUTOINCREMENT, label TEXT, deleted_at TEXT)')
  })
  afterEach(() => {
    for (const unsubscribe of subscriptions.splice(0)) unsubscribe()
    getDatabase().run('DELETE FROM restore_scope_probes')
  })
  afterAll(() => {
    releaseOrm()
    unlock()
  })

  it('clears only the selected row and makes it visible to ordinary queries', async () => {
    const first = await Model.create({ label: 'first' })
    const second = await Model.create({ label: 'second' })
    await Model.softDelete(Number(first.id))
    await Model.softDelete(Number(second.id))
    expect(await Model.find(Number(first.id))).toBeUndefined()
    expect(await Model.restore(Number(first.id))).toBe(true)
    expect(getDatabase().query('SELECT deleted_at FROM restore_scope_probes WHERE id = ?').get(Number(first.id))).toEqual({ deleted_at: null })
    expect((await Model.find(Number(first.id)))?.label).toBe('first')
    expect(await Model.find(Number(second.id))).toBeUndefined()
    expect(getDatabase().query('SELECT deleted_at FROM restore_scope_probes WHERE id = ?').get(Number(second.id))).not.toEqual({ deleted_at: null })
  })

  it('honors current cancellation listeners and emits after the row is restored', async () => {
    const row = await Model.create({ label: 'restore' })
    const id = Number(row.id)
    await Model.softDelete(id)
    on('restoring', () => false)
    expect(await Model.restore(id)).toBe(false)
    expect(await Model.find(id)).toBeUndefined()
    for (const unsubscribe of subscriptions.splice(0)) unsubscribe()
    const seen: string[] = []
    let restoredState: unknown
    on('restoring', async () => { await Promise.resolve(); seen.push('restoring') })
    on('restored', () => {
      seen.push('restored')
      restoredState = getDatabase().query('SELECT deleted_at FROM restore_scope_probes WHERE id = ?').get(id)
    })
    expect(await Model.restore(id)).toBe(true)
    expect(seen).toEqual(['restoring', 'restored'])
    expect(restoredState).toEqual({ deleted_at: null })
    expect((await Model.find(id))?.label).toBe('restore')
    await Model.softDelete(id)
    expect(await withoutEvents(() => Model.restore(id))).toBe(true)
    expect(seen).toEqual(['restoring', 'restored'])
    expect((await Model.find(id))?.label).toBe('restore')
  })
})
