import { describe, expect, test } from 'bun:test'
import { runWithRequest } from '@stacksjs/router'
import { parseCursor, resolveCursorArgs } from '../src/paginator-request'
import { toCursorPaginator } from '../src/paginator'

// stacksjs/stacks#1907 (P3) — cursor pagination wire-format round-trip.
//
// The interesting case: a composite cursor (e.g. ORDER BY created_at, id)
// needs to survive serialize → URL query param → parse back into an
// array on the next request, otherwise bqb's `sql(cursor)` interpolation
// breaks because it expects an array when `column` is an array.

function fakeRequest(url: string, query: Record<string, string | string[] | undefined> = {}) {
  return { url, query } as any
}

describe('parseCursor', () => {
  test('null / undefined → null (first page)', () => {
    expect(parseCursor(null)).toBeNull()
    expect(parseCursor(undefined)).toBeNull()
  })

  test('array → array (already native form)', () => {
    expect(parseCursor(['2024-01-01', 42])).toEqual(['2024-01-01', 42])
  })

  test('JSON-array string → parsed array (wire format round-trip)', () => {
    expect(parseCursor('["2024-01-01",42]')).toEqual(['2024-01-01', 42])
  })

  test('plain string → string (single-column cursor)', () => {
    expect(parseCursor('abc123')).toBe('abc123')
  })

  test('numeric → numeric', () => {
    expect(parseCursor(42)).toBe(42)
  })

  test('malformed JSON-shaped string falls back to plain string', () => {
    expect(parseCursor('[not valid json')).toBe('[not valid json')
  })

  test('JSON object string is NOT auto-parsed (must start with [ for composite)', () => {
    // Cursors are never objects — only arrays or primitives — so we
    // only auto-parse the `[`-prefixed form.
    expect(parseCursor('{"x":1}')).toBe('{"x":1}')
  })
})

describe('cursor round-trip — single column', () => {
  test('serialize then parse a numeric cursor stays equivalent', () => {
    // What the adapter would emit:
    const result = toCursorPaginator({
      data: [{ id: 1 }],
      meta: { perPage: 10, nextCursor: 42, prevCursor: null },
    })
    expect(result.next_cursor).toBe('42')

    // What the next request reads from ?cursor=42:
    const parsed = parseCursor(result.next_cursor)
    expect(parsed).toBe('42')
  })
})

describe('cursor round-trip — composite cursor', () => {
  test('serialize composite, parse back to array (bqb-ready)', () => {
    // First-page result emits a composite next_cursor:
    const firstPage = toCursorPaginator({
      data: [{ id: 1 }],
      meta: { perPage: 1, nextCursor: ['2024-01-01T00:00:00Z', 99], prevCursor: null },
    })
    expect(firstPage.next_cursor).toBe('["2024-01-01T00:00:00Z",99]')

    // Frontend uses that string in ?cursor=... and the next request
    // arrives. resolveCursorArgs must produce an array for bqb.
    runWithRequest(fakeRequest('http://example.com/feed?cursor=' + encodeURIComponent(firstPage.next_cursor!), {
      cursor: firstPage.next_cursor!,
    }), () => {
      const { cursor } = resolveCursorArgs()
      expect(cursor).toEqual(['2024-01-01T00:00:00Z', 99])
    })
  })

  test('explicit array passed by the app code reaches bqb unchanged', () => {
    const { cursor } = resolveCursorArgs(15, ['2024-01-01', 1])
    expect(cursor).toEqual(['2024-01-01', 1])
  })

  test('null cursor (first page) stays null', () => {
    runWithRequest(fakeRequest('http://example.com/feed', {}), () => {
      const { cursor } = resolveCursorArgs()
      expect(cursor).toBeNull()
    })
  })
})

describe('cursor round-trip — null cursor on the prev side', () => {
  test('prev_cursor null on first page; serializer keeps null', () => {
    const result = toCursorPaginator({
      data: [{ id: 1 }],
      meta: { perPage: 1, nextCursor: 2, prevCursor: null },
    })
    expect(result.prev_cursor).toBeNull()
  })

  test('prev_cursor present on a later page (parse-safe round trip)', () => {
    const result = toCursorPaginator({
      data: [{ id: 5 }],
      meta: { perPage: 1, nextCursor: 6, prevCursor: 5 },
    })
    expect(result.prev_cursor).toBe('5')
    expect(parseCursor(result.prev_cursor)).toBe('5')
  })
})
