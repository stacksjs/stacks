import { describe, expect, test } from 'bun:test'
import {
  isCursorPaginator,
  isPaginator,
  isSimplePaginator,
  toCursorPaginator,
  toPaginator,
  toSimplePaginator,
} from '../src/paginator'

// stacksjs/stacks#1905 (P1) — canonical paginator shape + adapters.

describe('toPaginator', () => {
  test('converts bqb { data, meta } to canonical Paginator', () => {
    const result = toPaginator({
      data: [{ id: 1 }, { id: 2 }, { id: 3 }],
      meta: { perPage: 3, page: 2, total: 9, lastPage: 3 },
    })
    expect(result).toEqual({
      data: [{ id: 1 }, { id: 2 }, { id: 3 }],
      current_page: 2,
      per_page: 3,
      total: 9,
      last_page: 3,
      from: 4, // (2-1)*3 + 1
      to: 6, // 4 + 3 - 1
      has_more_pages: true,
    })
  })

  test('from / to are null on an empty page', () => {
    const result = toPaginator({
      data: [],
      meta: { perPage: 10, page: 5, total: 0, lastPage: 1 },
    })
    expect(result.from).toBeNull()
    expect(result.to).toBeNull()
    expect(result.has_more_pages).toBe(false)
  })

  test('has_more_pages is false on the last page', () => {
    const result = toPaginator({
      data: [{ id: 9 }],
      meta: { perPage: 3, page: 3, total: 9, lastPage: 3 },
    })
    expect(result.has_more_pages).toBe(false)
  })

  test('to clamps to actual row count on the last (partial) page', () => {
    const result = toPaginator({
      data: [{ id: 10 }], // last page only has 1 row
      meta: { perPage: 3, page: 4, total: 10, lastPage: 4 },
    })
    expect(result.from).toBe(10)
    expect(result.to).toBe(10)
  })
})

describe('toSimplePaginator', () => {
  test('converts bqb output to canonical SimplePaginator', () => {
    const result = toSimplePaginator({
      data: [{ id: 1 }, { id: 2 }],
      meta: { perPage: 2, page: 1, hasMore: true },
    })
    expect(result).toEqual({
      data: [{ id: 1 }, { id: 2 }],
      current_page: 1,
      per_page: 2,
      has_more_pages: true,
    })
  })

  test('has_more_pages mirrors hasMore', () => {
    const result = toSimplePaginator({
      data: [{ id: 5 }],
      meta: { perPage: 5, page: 3, hasMore: false },
    })
    expect(result.has_more_pages).toBe(false)
  })
})

describe('toCursorPaginator', () => {
  test('converts bqb output to canonical CursorPaginator', () => {
    const result = toCursorPaginator({
      data: [{ id: 1 }, { id: 2 }],
      meta: { perPage: 2, nextCursor: 'abc123', prevCursor: null },
    })
    expect(result.data).toEqual([{ id: 1 }, { id: 2 }])
    expect(result.per_page).toBe(2)
    expect(result.next_cursor).toBe('abc123')
    expect(result.prev_cursor).toBeNull()
    expect(result.has_more_pages).toBe(true)
  })

  test('serializes composite (array) cursors as JSON for stable wire format', () => {
    const result = toCursorPaginator({
      data: [{ id: 1 }],
      meta: { perPage: 1, nextCursor: ['2024-01-01', 42], prevCursor: ['2023-01-01', 1] },
    })
    expect(result.next_cursor).toBe(JSON.stringify(['2024-01-01', 42]))
    expect(result.prev_cursor).toBe(JSON.stringify(['2023-01-01', 1]))
  })

  test('numeric cursors stringify cleanly', () => {
    const result = toCursorPaginator({
      data: [{ id: 1 }],
      meta: { perPage: 1, nextCursor: 42, prevCursor: 1 },
    })
    expect(result.next_cursor).toBe('42')
    expect(result.prev_cursor).toBe('1')
  })

  test('null cursors stay null (no over-serialization)', () => {
    const result = toCursorPaginator({
      data: [],
      meta: { perPage: 10, nextCursor: null, prevCursor: null },
    })
    expect(result.next_cursor).toBeNull()
    expect(result.prev_cursor).toBeNull()
    expect(result.has_more_pages).toBe(false)
  })
})

describe('duck-typed guards', () => {
  test('isPaginator narrows on shape', () => {
    expect(isPaginator({ data: [], current_page: 1, per_page: 10, total: 0, last_page: 1 })).toBe(true)
    expect(isPaginator({ data: [], current_page: 1, per_page: 10 })).toBe(false) // missing total/last_page
    expect(isPaginator(null)).toBe(false)
    expect(isPaginator([])).toBe(false)
  })

  test('isSimplePaginator narrows on shape', () => {
    expect(isSimplePaginator({ data: [], current_page: 1, per_page: 10, has_more_pages: false })).toBe(true)
    // Full paginator should NOT match the simple guard (it has total/last_page)
    expect(isSimplePaginator({ data: [], current_page: 1, per_page: 10, total: 0, last_page: 1, has_more_pages: false })).toBe(false)
  })

  test('isCursorPaginator narrows on shape', () => {
    expect(isCursorPaginator({ data: [], next_cursor: 'abc', prev_cursor: null, per_page: 10, has_more_pages: true })).toBe(true)
    expect(isCursorPaginator({ data: [], next_cursor: null, prev_cursor: null, per_page: 10, has_more_pages: false })).toBe(true)
    expect(isCursorPaginator({ data: [], current_page: 1 })).toBe(false)
  })
})
