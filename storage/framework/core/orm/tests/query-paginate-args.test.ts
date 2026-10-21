import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { configureOrm, getDatabase, releaseOrm } from 'bun-query-builder'
import { acquireDbConfigLock } from '@stacksjs/database'
import { runWithRequest } from '@stacksjs/router'
import { defineModel } from '../src/define-model'

const Model = defineModel({
  name: 'PaginateArgsProbe',
  table: 'paginate_args_probes',
  primaryKey: 'id',
  autoIncrement: true,
  attributes: { label: { type: 'string', fillable: true } },
} as const)

const ids = (page: { data: Array<{ id: unknown }> }) => page.data.map(row => Number(row.id))

describe('query builder paginate() without arguments', () => {
  let unlock: () => void
  beforeAll(async () => {
    unlock = await acquireDbConfigLock()
    configureOrm({ database: ':memory:' })
    getDatabase().run('CREATE TABLE paginate_args_probes (id INTEGER PRIMARY KEY AUTOINCREMENT, label TEXT)')
    for (let i = 1; i <= 7; i++)
      getDatabase().run('INSERT INTO paginate_args_probes (label) VALUES (?)', [`row ${i}`])
  })
  afterAll(() => {
    releaseOrm()
    unlock()
  })

  it('returns page 1 at 15 per page outside a request', async () => {
    const page = await Model.query().paginate()
    expect(ids(page)).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(page).toMatchObject({ current_page: 1, per_page: 15, total: 7, last_page: 1 })
  })

  it('takes ?per_page= and ?page= from the active request', async () => {
    const request = { url: 'http://localhost/probes?per_page=5&page=2', query: { per_page: '5', page: '2' } }
    const page = await runWithRequest(request as any, () => Model.where('id', '>', 0).paginate())
    expect(ids(page)).toEqual([6, 7])
    expect(page).toMatchObject({ current_page: 2, per_page: 5, total: 7, last_page: 2 })
  })
})
