import { afterAll, afterEach, beforeAll, describe, expect, it } from 'bun:test'
import { configureOrm, getDatabase, releaseOrm } from 'bun-query-builder'
import { acquireDbConfigLock } from '@stacksjs/database'
import { defineModel } from '../src/define-model'

const Model = defineModel({
  name: 'TrashedQueryProbe',
  table: 'trashed_query_probes',
  primaryKey: 'id',
  autoIncrement: true,
  traits: { useSoftDeletes: true },
  attributes: { label: { type: 'string', fillable: true } },
} as const)

const labels = (rows: Array<{ label?: unknown }>) => rows.map(row => row.label).sort()

describe('withTrashed and onlyTrashed', () => {
  let unlock: () => void
  beforeAll(async () => {
    unlock = await acquireDbConfigLock()
    configureOrm({ database: ':memory:' })
    getDatabase().run('CREATE TABLE trashed_query_probes (id INTEGER PRIMARY KEY AUTOINCREMENT, label TEXT, deleted_at TEXT)')
  })
  afterEach(() => {
    getDatabase().run('DELETE FROM trashed_query_probes')
  })
  afterAll(() => {
    releaseOrm()
    unlock()
  })

  it('withTrashed includes soft-deleted rows', async () => {
    await Model.create({ label: 'kept' })
    const gone = await Model.create({ label: 'gone' })
    await Model.softDelete(Number(gone.id))

    expect(labels(await Model.all())).toEqual(['kept'])
    expect(labels(await Model.withTrashed().get())).toEqual(['gone', 'kept'])
    expect((await Model.withTrashed().find(Number(gone.id)))?.label).toBe('gone')
  })

  it('onlyTrashed returns just the soft-deleted rows', async () => {
    await Model.create({ label: 'kept' })
    const gone = await Model.create({ label: 'gone' })
    await Model.softDelete(Number(gone.id))

    expect(labels(await Model.onlyTrashed().get())).toEqual(['gone'])
  })
})
