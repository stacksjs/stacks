import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { configureOrm, getDatabase, releaseOrm } from 'bun-query-builder'
import { acquireDbConfigLock } from '@stacksjs/database'
import { defineModel } from '../src/define-model'

const Model = defineModel({
  name: 'PaginateShapeProbe',
  table: 'paginate_shape_probes',
  primaryKey: 'id',
  autoIncrement: true,
  attributes: { label: { type: 'string', fillable: true } },
} as const)

// bun-query-builder answers a model static with a flat envelope
// (`page`, `perPage`, `lastPage`, `hasMorePages`, `isEmpty`) and a query
// builder with the same envelope plus `meta`. Stacks publishes one canonical
// Laravel-style paginator, so none of those keys may reach a caller: a
// template reading `current_page` has to keep working when the last `where`
// clause is removed, which is the way this broke (stacksjs/stacks#2950).
const CANONICAL_KEYS = [
  'current_page',
  'data',
  'has_more_pages',
  'from',
  'last_page',
  'per_page',
  'to',
  'total',
] as const

const BQB_KEYS = ['page', 'perPage', 'lastPage', 'hasMorePages', 'isEmpty', 'meta'] as const

function describeShape(result: object): { canonical: string[], bqb: string[] } {
  const keys = Object.keys(result)
  return {
    canonical: CANONICAL_KEYS.filter(key => keys.includes(key)).sort(),
    bqb: BQB_KEYS.filter(key => keys.includes(key)).sort(),
  }
}

describe('paginate() returns one shape from every entrypoint', () => {
  let unlock: () => void

  beforeAll(async () => {
    unlock = await acquireDbConfigLock()
    configureOrm({ database: ':memory:' })
    getDatabase().run('CREATE TABLE paginate_shape_probes (id INTEGER PRIMARY KEY AUTOINCREMENT, label TEXT)')
    for (let i = 1; i <= 7; i++)
      getDatabase().run('INSERT INTO paginate_shape_probes (label) VALUES (?)', [`row ${i}`])
  })

  afterAll(() => {
    releaseOrm()
    unlock()
  })

  const entrypoints: Array<[string, () => Promise<any>]> = [
    ['Model.paginate', () => Model.paginate(5, 1)],
    ['Model.query().paginate', () => Model.query().paginate(5, 1)],
    ['Model.where().paginate', () => Model.where('id', '>', 0).paginate(5, 1)],
    ['Model.orderBy().paginate', () => Model.orderBy('id', 'asc').paginate(5, 1)],
  ]

  for (const [name, run] of entrypoints) {
    it(`${name}() answers the canonical paginator and nothing else`, async () => {
      const shape = describeShape(await run())
      expect({ [name]: shape }).toEqual({
        [name]: { canonical: [...CANONICAL_KEYS].sort(), bqb: [] },
      })
    })
  }

  // Adding or removing a filter is the change that used to swap the keys, so
  // the two have to be indistinguishable by shape.
  it('adding a where clause does not change the keys', async () => {
    const unfiltered = Object.keys(await Model.paginate(5, 1)).sort()
    const filtered = Object.keys(await Model.where('id', '>', 0).paginate(5, 1)).sort()
    expect(filtered).toEqual(unfiltered)
  })

  it('reports the same page of rows either way', async () => {
    const unfiltered = await Model.paginate(5, 1)
    const filtered = await Model.where('id', '>', 0).paginate(5, 1)
    expect(unfiltered.data.map((r: any) => Number(r.id))).toEqual([1, 2, 3, 4, 5])
    expect(filtered.data.map((r: any) => Number(r.id))).toEqual([1, 2, 3, 4, 5])
    expect(filtered.current_page).toBe(unfiltered.current_page)
    expect(filtered.last_page).toBe(unfiltered.last_page)
    expect(filtered.total).toBe(unfiltered.total)
  })
})
