/**
 * forceDelete purges the row whether or not it is already trashed, and says
 * whether anything went away.
 *
 * The soft-delete trait's `forceDelete(id)` queried `where(pk, id)` without
 * `withTrashed()`, so the default scope (`deleted_at IS NULL`) applied and a
 * row that had already been soft-deleted - the usual reason to force-delete -
 * matched nothing and survived. It then answered `true` regardless. `restore`
 * had the same shape and was fixed to include trashed rows; this one was not.
 *
 * It mattered more with bun-query-builder 0.2.70, whose native `remove(id)`
 * and `destroy(id)` now route into these overrides: `remove(id)` used to issue
 * a bare DELETE that purged trashed rows, and under 0.2.70 it reached this
 * method and did not. stacksjs/stacks#2637's upgrade audit found it.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'bun:test'
import { configureOrm, getDatabase, releaseOrm } from 'bun-query-builder'
import { acquireDbConfigLock } from '@stacksjs/database'
import { defineModel } from '../src/define-model'

const Model = defineModel({
  name: 'ForceDeleteProbe',
  table: 'force_delete_probes',
  primaryKey: 'id',
  autoIncrement: true,
  traits: { useSoftDeletes: true },
  attributes: { label: { type: 'string', fillable: true } },
} as const) as any

function row(id: number): unknown {
  return getDatabase().query('SELECT * FROM force_delete_probes WHERE id = ?').get(id)
}

describe('forceDelete on a soft-deleting model', () => {
  let unlock: () => void
  beforeAll(async () => {
    unlock = await acquireDbConfigLock()
    configureOrm({ database: ':memory:' })
    getDatabase().run('CREATE TABLE force_delete_probes (id INTEGER PRIMARY KEY AUTOINCREMENT, label TEXT, deleted_at TEXT)')
  })
  afterEach(() => {
    getDatabase().run('DELETE FROM force_delete_probes')
  })
  afterAll(() => {
    releaseOrm()
    unlock()
  })

  it('purges a row that is already soft-deleted', async () => {
    const created = await Model.create({ label: 'trashed' })
    const id = Number(created.id)
    await Model.softDelete(id)
    expect(row(id)).not.toBeNull()

    expect(await Model.forceDelete(id)).toBe(true)
    expect(row(id)).toBeNull()
  })

  it('purges a live row', async () => {
    const created = await Model.create({ label: 'live' })
    const id = Number(created.id)

    expect(await Model.forceDelete(id)).toBe(true)
    expect(row(id)).toBeNull()
  })

  it('reports false when there was no row to delete', async () => {
    expect(await Model.forceDelete(987654)).toBe(false)
  })

  it('remove(id), where the builder routes it here, purges a trashed row too', async () => {
    if (typeof Model.remove !== 'function')
      return
    const created = await Model.create({ label: 'removed' })
    const id = Number(created.id)
    await Model.softDelete(id)

    await Model.remove(id)
    expect(row(id)).toBeNull()
  })
})
