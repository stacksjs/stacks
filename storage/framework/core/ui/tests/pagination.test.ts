import { describe, expect, test } from 'bun:test'
import { buildPageSequence, paginatorVariant, urlForPage } from '../src/pagination'

// stacksjs/stacks#1909 (P5) — pagination view helpers.

describe('buildPageSequence', () => {
  test('empty when there is only one page (no pagination UI needed)', () => {
    expect(buildPageSequence(1, 1, 2)).toEqual([])
  })

  test('current page far from both ends: [1, …, lo..hi, …, last]', () => {
    // current=8 in last=20, window=2 → 6..10 around current, both ellipses fire
    expect(buildPageSequence(8, 20, 2)).toEqual([1, '…', 6, 7, 8, 9, 10, '…', 20])
  })

  test('single-page gap shows the page instead of ellipsis (UX nicety)', () => {
    // current=5, last=12, window=2: pages 3..7 in window, page 2 is the only
    // page between 1 and lo=3 → show "2" instead of "…" (one-page gap rule)
    expect(buildPageSequence(5, 12, 2)).toEqual([1, 2, 3, 4, 5, 6, 7, '…', 12])
  })

  test('current near start: no leading ellipsis at all', () => {
    expect(buildPageSequence(2, 12, 2)).toEqual([1, 2, 3, 4, '…', 12])
  })

  test('current near end: no trailing ellipsis', () => {
    // current=11, last=12, window=2 → lo=9, hi=11, push 9..11, then 12.
    // page 8 is a single-page gap on the leading side → shown, not ellipsis
    expect(buildPageSequence(11, 12, 2)).toEqual([1, '…', 9, 10, 11, 12])
  })

  test('small last_page (window covers everything)', () => {
    expect(buildPageSequence(2, 3, 2)).toEqual([1, 2, 3])
  })

  test('current is last page', () => {
    expect(buildPageSequence(5, 5, 2)).toEqual([1, 2, 3, 4, 5])
  })

  test('current is first page', () => {
    expect(buildPageSequence(1, 5, 2)).toEqual([1, 2, 3, 4, 5])
  })

  test('window=0 still anchors first and last', () => {
    expect(buildPageSequence(5, 10, 0)).toEqual([1, '…', 5, '…', 10])
  })

  test('window=1 minimal middle', () => {
    expect(buildPageSequence(5, 10, 1)).toEqual([1, '…', 4, 5, 6, '…', 10])
  })
})

describe('urlForPage', () => {
  test('re-templates page param on an existing paginator URL', () => {
    const view = { next_page_url: '/users?page=3&status=active' }
    expect(urlForPage(view, 5)).toBe('/users?page=5&status=active')
  })

  test('uses prev_page_url as template if next is null', () => {
    const view = { next_page_url: null, prev_page_url: '/users?page=1&q=glenn' }
    expect(urlForPage(view, 4)).toBe('/users?page=4&q=glenn')
  })

  test('falls back to first/last when prev+next are absent', () => {
    const view = { first_page_url: '/users?page=1', last_page_url: '/users?page=10' }
    // first wins because we OR through next → prev → first → last
    expect(urlForPage(view, 5)).toBe('/users?page=5')
  })

  test('appends page= when template lacks one (rare manual-URL case)', () => {
    const view = { first_page_url: '/users?q=glenn' }
    expect(urlForPage(view, 3)).toBe('/users?q=glenn&page=3')
  })

  test('appends page with ? when template has no query string', () => {
    const view = { first_page_url: '/users' }
    expect(urlForPage(view, 3)).toBe('/users?page=3')
  })

  test('falls back to relative ?page=N when no templates at all', () => {
    expect(urlForPage({}, 7)).toBe('?page=7')
  })

  test('handles & vs ? separators correctly', () => {
    // Template uses & for non-first param
    const view = { next_page_url: '/users?status=active&page=2' }
    expect(urlForPage(view, 5)).toBe('/users?status=active&page=5')
  })
})

describe('paginatorVariant', () => {
  test('classifies full Paginator', () => {
    expect(paginatorVariant({
      data: [], current_page: 1, per_page: 10, total: 50, last_page: 5,
      from: 1, to: 10, has_more_pages: true,
    })).toBe('full')
  })

  test('classifies SimplePaginator (no total/last_page)', () => {
    expect(paginatorVariant({
      data: [], current_page: 1, per_page: 10, has_more_pages: true,
    })).toBe('simple')
  })

  test('classifies CursorPaginator (next_cursor key)', () => {
    expect(paginatorVariant({
      data: [], per_page: 10, next_cursor: 'abc', prev_cursor: null, has_more_pages: true,
    })).toBe('cursor')
  })

  test('CursorPaginator wins even if other fields happen to be present', () => {
    // Defensive — duck-type detection priority matters
    expect(paginatorVariant({
      data: [], per_page: 10, next_cursor: 'abc', total: 100,
    })).toBe('cursor')
  })

  test('non-objects → unknown', () => {
    expect(paginatorVariant(null)).toBe('unknown')
    expect(paginatorVariant(undefined)).toBe('unknown')
    expect(paginatorVariant('string')).toBe('unknown')
    expect(paginatorVariant([])).toBe('unknown') // arrays are typeof object but excluded
  })
})
