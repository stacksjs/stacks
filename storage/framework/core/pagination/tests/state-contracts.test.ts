import { expect, test } from 'bun:test'
import { isCursorPaginator, isPaginator, isSimplePaginator, toCursorPaginator, toPaginator, toSimplePaginator } from '../src'

const full = toPaginator({ data: [], meta: { page: 99, perPage: 10, total: 0, lastPage: 0 } })
const simple = toSimplePaginator({ data: [], meta: { page: 1, perPage: 10, hasMore: false } })
const cursor = toCursorPaginator({ data: [], meta: { perPage: 10, nextCursor: null, prevCursor: null } })

for (const [name, valid, guard] of [['full', full, isPaginator], ['simple', simple, isSimplePaginator], ['cursor', cursor, isCursorPaginator]] as const) {
  test(`${name} guards accept adapters and reject every missing required field`, () => {
    expect(guard(valid)).toBe(true)
    for (const key of Object.keys(valid)) {
      const missing = { ...valid } as Record<string, unknown>
      delete missing[key]
      expect(guard(missing)).toBe(false)
    }
    for (const per_page of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])
      expect(guard({ ...valid, per_page })).toBe(false)
    for (const path of [null, 12, {}]) expect(guard({ ...valid, path })).toBe(false)
    expect(guard({ ...valid, next_page_url: 42 })).toBe(false)
    expect(guard({ ...valid, prev_page_url: null, next_page_url: '/next', path: '/' })).toBe(true)
  })
}

test('full and cursor guards reject malformed metadata without validating row types', () => {
  for (const total of [NaN, Infinity, -1, 1.5]) expect(isPaginator({ ...full, total })).toBe(false)
  expect(isPaginator({ ...full, from: undefined })).toBe(false)
  expect(isPaginator({ ...full, to: 0 })).toBe(false)
  expect(isPaginator({ ...full, first_page_url: null })).toBe(false)
  expect(isCursorPaginator({ ...cursor, prev_cursor: 12 })).toBe(false)
  expect(isPaginator({ ...full, data: [null, 1, {}] })).toBe(true)
  expect(isSimplePaginator(full)).toBe(false)
})

test('BIGINT cursors preserve exact digits for scalar and composite keys', () => {
  const id = 9007199254740993n
  const result = toCursorPaginator({ data: [], meta: { perPage: 1, nextCursor: id, prevCursor: ['a', id] } })
  expect(result.next_cursor).toBe('9007199254740993')
  expect(JSON.parse(result.prev_cursor!)).toEqual(['a', '9007199254740993'])
  expect(isCursorPaginator(result)).toBe(true)
  expect(JSON.parse(JSON.stringify(result))).toEqual(result)
  for (const nextCursor of [NaN, Infinity, () => 1])
    expect(() => toCursorPaginator({ data: [], meta: { perPage: 1, nextCursor, prevCursor: null } })).toThrow(TypeError)
})
