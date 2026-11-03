import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { configureOrm, getDatabase, releaseOrm } from 'bun-query-builder'
import { acquireDbConfigLock } from '@stacksjs/database'
import { runWithRequest } from '@stacksjs/router'
import { defineModel } from '../src/define-model'

// stacksjs/stacks#3119: `Model.simplePaginate()` and `Model.where(...).cursorPaginate()`
// threw "is not a function" because the model builder under defineModel() only
// had paginate(). These run the real model against a real database, through the
// wrapper that turns the builder's result into the canonical paginators, so the
// adapters are exercised on the builder's actual output and not on a hand-written
// stand-in (the hand-written one is how a prev cursor that went nowhere got past
// the unit tests).
const Model = defineModel({
  name: 'CursorProbe',
  table: 'cursor_probes',
  primaryKey: 'id',
  autoIncrement: true,
  attributes: {
    label: { type: 'string', fillable: true },
    day: { type: 'string', fillable: true },
  },
} as const)

const ids = (rows: { id: number }[]): number[] => rows.map(row => Number(row.id))

describe('simplePaginate and cursorPaginate on a defineModel() model', () => {
  let unlock: () => void

  beforeAll(async () => {
    unlock = await acquireDbConfigLock()
    configureOrm({ database: ':memory:' })
    getDatabase().run('CREATE TABLE cursor_probes (id INTEGER PRIMARY KEY AUTOINCREMENT, label TEXT, day TEXT)')
    for (let i = 1; i <= 12; i++)
      getDatabase().run('INSERT INTO cursor_probes (label, day) VALUES (?, ?)', [`row ${i}`, `2026-02-0${Math.ceil(i / 4)}`])
  })

  afterAll(() => {
    releaseOrm()
    unlock()
  })

  it('simplePaginate is on the model, on where() and on query(), and returns the canonical shape', async () => {
    for (const result of [
      await Model.simplePaginate(5),
      await (Model as any).where('id', '>', 0).simplePaginate(5),
      await (Model as any).query().simplePaginate(5),
    ]) {
      expect(ids(result.data)).toEqual([1, 2, 3, 4, 5])
      expect(result.current_page).toBe(1)
      expect(result.per_page).toBe(5)
      expect(result.has_more_pages).toBe(true)
      // None of the builder's own keys reach the caller.
      expect(Object.keys(result).sort()).toEqual(expect.arrayContaining(['current_page', 'data', 'has_more_pages', 'per_page']))
      expect(Object.keys(result)).not.toContain('meta')
    }
    const last = await Model.simplePaginate(5, 3)
    expect(ids(last.data)).toEqual([11, 12])
    expect(last.has_more_pages).toBe(false)
  })

  it('cursorPaginate pages forwards and back through the serialised cursors', async () => {
    const first = await Model.cursorPaginate(5)
    expect(ids(first.data)).toEqual([1, 2, 3, 4, 5])
    expect(first.prev_cursor).toBeNull()
    expect(first.has_more_pages).toBe(true)
    expect(typeof first.next_cursor).toBe('string')

    const second = await Model.cursorPaginate(5, first.next_cursor)
    expect(ids(second.data)).toEqual([6, 7, 8, 9, 10])
    const third = await Model.cursorPaginate(5, second.next_cursor)
    expect(ids(third.data)).toEqual([11, 12])
    expect(third.next_cursor).toBeNull()
    expect(third.has_more_pages).toBe(false)

    // The previous cursor is the page before, not this page less a row.
    const back = await Model.cursorPaginate(5, third.prev_cursor)
    expect(ids(back.data)).toEqual([6, 7, 8, 9, 10])
    const start = await Model.cursorPaginate(5, back.prev_cursor)
    expect(ids(start.data)).toEqual([1, 2, 3, 4, 5])
    expect(start.prev_cursor).toBeNull()
  })

  it('cursorPaginate chains after where() and takes a composite order', async () => {
    const query = () => (Model as any).where('id', '>', 2)
    const first = await query().cursorPaginate(4, null, ['day', 'id'], 'desc')
    expect(ids(first.data)).toEqual([12, 11, 10, 9])
    const second = await query().cursorPaginate(4, first.next_cursor, ['day', 'id'], 'desc')
    expect(ids(second.data)).toEqual([8, 7, 6, 5])
    expect(ids((await query().cursorPaginate(4, second.prev_cursor, ['day', 'id'], 'desc')).data)).toEqual([12, 11, 10, 9])
  })

  it('reads ?cursor= from the request, and the next link continues from it', async () => {
    const seen: number[] = []
    let cursor: string | null = null
    do {
      const url: string = `http://localhost/rows${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`
      const query: Record<string, string> = cursor ? { cursor } : {}
      const page: any = await runWithRequest({ url, query } as any, () => Model.cursorPaginate(5))
      seen.push(...ids(page.data))
      if (page.next_cursor) expect(page.next_page_url).toContain('cursor=')
      cursor = page.next_cursor
    } while (cursor)
    expect(seen).toEqual(Array.from({ length: 12 }, (_, i) => i + 1))
  })
})
