import { afterEach, describe, expect, test } from 'bun:test'
import { enrichPaginatorUrls, resolveCursorArgs, resolvePageArgs } from '../src/paginator-request'
import { runWithRequest } from '@stacksjs/router'

// stacksjs/stacks#1906 (P2) — request-aware pagination helpers.

function fakeRequest(url: string, query: Record<string, string | string[] | undefined> = {}) {
  // Match the shape paginator-request reads: just `url` + `query`.
  return { url, query } as any
}

afterEach(() => {
  // No global state to reset — lazy-import cache is one-shot per process
  // and the router module is real (we wrap real `runWithRequest` calls).
})

describe('resolvePageArgs — no request scope', () => {
  test('returns defaults when no args + no request', () => {
    const { perPage, page } = resolvePageArgs()
    expect(perPage).toBe(15)
    expect(page).toBe(1)
  })

  test('respects explicit args even with no request', () => {
    expect(resolvePageArgs(25, 3)).toEqual({ perPage: 25, page: 3 })
  })

  test('clamps page >= 1 when caller passes 0 / negative', () => {
    expect(resolvePageArgs(15, 0).page).toBe(1)
    expect(resolvePageArgs(15, -5).page).toBe(1)
  })
})

describe('resolvePageArgs — with active request', () => {
  test('reads ?page= and ?per_page= from active request', () => {
    runWithRequest(fakeRequest('http://example.com/users?page=3&per_page=25', { page: '3', per_page: '25' }), () => {
      const { perPage, page } = resolvePageArgs()
      expect(perPage).toBe(25)
      expect(page).toBe(3)
    })
  })

  test('explicit args win over query string', () => {
    runWithRequest(fakeRequest('http://example.com/users?page=99&per_page=99', { page: '99', per_page: '99' }), () => {
      expect(resolvePageArgs(10, 2)).toEqual({ perPage: 10, page: 2 })
    })
  })

  test('clamps ?per_page= to max 100 (DoS guard)', () => {
    runWithRequest(fakeRequest('http://example.com/users?per_page=1000000', { per_page: '1000000' }), () => {
      const { perPage } = resolvePageArgs()
      expect(perPage).toBe(100)
    })
  })

  test('but trusts explicit positional perPage (apps can pass >100 deliberately)', () => {
    runWithRequest(fakeRequest('http://example.com/users', {}), () => {
      const { perPage } = resolvePageArgs(500)
      expect(perPage).toBe(500)
    })
  })

  test('garbage query string falls back to defaults', () => {
    runWithRequest(fakeRequest('http://example.com/users?page=lol&per_page=NaN', { page: 'lol', per_page: 'NaN' }), () => {
      const { perPage, page } = resolvePageArgs()
      expect(perPage).toBe(15)
      expect(page).toBe(1)
    })
  })
})

describe('resolveCursorArgs', () => {
  test('reads ?cursor= and ?per_page= from request', () => {
    runWithRequest(fakeRequest('http://example.com/feed?cursor=abc&per_page=20', { cursor: 'abc', per_page: '20' }), () => {
      expect(resolveCursorArgs()).toEqual({ perPage: 20, cursor: 'abc' })
    })
  })

  test('explicit cursor=null beats query string', () => {
    runWithRequest(fakeRequest('http://example.com/feed?cursor=abc', { cursor: 'abc' }), () => {
      expect(resolveCursorArgs(15, null)).toEqual({ perPage: 15, cursor: null })
    })
  })
})

describe('enrichPaginatorUrls — full Paginator', () => {
  test('fills path + prev/next/first/last when on a middle page', () => {
    runWithRequest(fakeRequest('http://example.com/users?page=3&per_page=15', { page: '3', per_page: '15' }), () => {
      const paginator = {
        data: [],
        current_page: 3,
        per_page: 15,
        total: 100,
        last_page: 7,
        from: 31,
        to: 45,
        has_more_pages: true,
      }
      const enriched = enrichPaginatorUrls(paginator)
      expect(enriched.path).toBe('/users')
      expect(enriched.prev_page_url).toBe('/users?page=2&per_page=15')
      expect(enriched.next_page_url).toBe('/users?page=4&per_page=15')
      expect(enriched.first_page_url).toBe('/users?page=1&per_page=15')
      expect(enriched.last_page_url).toBe('/users?page=7&per_page=15')
    })
  })

  test('prev_page_url is null on page 1', () => {
    runWithRequest(fakeRequest('http://example.com/users?page=1', { page: '1' }), () => {
      const p = enrichPaginatorUrls({
        data: [], current_page: 1, per_page: 15, total: 100, last_page: 7,
        from: 1, to: 15, has_more_pages: true,
      })
      expect(p.prev_page_url).toBeNull()
    })
  })

  test('next_page_url is null on the last page', () => {
    runWithRequest(fakeRequest('http://example.com/users?page=7', { page: '7' }), () => {
      const p = enrichPaginatorUrls({
        data: [], current_page: 7, per_page: 15, total: 100, last_page: 7,
        from: 91, to: 100, has_more_pages: false,
      })
      expect(p.next_page_url).toBeNull()
    })
  })

  test('preserves OTHER query params (search filters survive pagination)', () => {
    runWithRequest(fakeRequest('http://example.com/users?page=2&status=active&q=glenn', { page: '2', status: 'active', q: 'glenn' }), () => {
      const p = enrichPaginatorUrls({
        data: [], current_page: 2, per_page: 15, total: 100, last_page: 7,
        from: 16, to: 30, has_more_pages: true,
      })
      expect(p.next_page_url).toContain('status=active')
      expect(p.next_page_url).toContain('q=glenn')
      expect(p.next_page_url).toContain('page=3')
    })
  })
})

describe('enrichPaginatorUrls — SimplePaginator', () => {
  test('only sets prev / next URLs (no first/last)', () => {
    runWithRequest(fakeRequest('http://example.com/feed?page=2', { page: '2' }), () => {
      const p = enrichPaginatorUrls({
        data: [], current_page: 2, per_page: 10, has_more_pages: true,
      })
      expect(p.prev_page_url).toBe('/feed?page=1')
      expect(p.next_page_url).toBe('/feed?page=3')
      expect((p as any).first_page_url).toBeUndefined()
      expect((p as any).last_page_url).toBeUndefined()
    })
  })

  test('next_page_url null when has_more_pages false', () => {
    runWithRequest(fakeRequest('http://example.com/feed?page=5', { page: '5' }), () => {
      const p = enrichPaginatorUrls({
        data: [], current_page: 5, per_page: 10, has_more_pages: false,
      })
      expect(p.next_page_url).toBeNull()
    })
  })
})

describe('enrichPaginatorUrls — CursorPaginator', () => {
  test('emits prev/next URLs with cursor query param', () => {
    runWithRequest(fakeRequest('http://example.com/feed?cursor=mid', { cursor: 'mid' }), () => {
      const p = enrichPaginatorUrls({
        data: [], per_page: 10, next_cursor: 'after_mid', prev_cursor: 'before_mid', has_more_pages: true,
      })
      expect(p.next_page_url).toContain('cursor=after_mid')
      expect(p.prev_page_url).toContain('cursor=before_mid')
    })
  })

  test('null cursors map to null URLs', () => {
    runWithRequest(fakeRequest('http://example.com/feed', {}), () => {
      const p = enrichPaginatorUrls({
        data: [], per_page: 10, next_cursor: null, prev_cursor: null, has_more_pages: false,
      })
      expect(p.next_page_url).toBeNull()
      expect(p.prev_page_url).toBeNull()
    })
  })
})

describe('enrichPaginatorUrls — no request scope', () => {
  test('returns paginator untouched when no request is active', () => {
    const p = enrichPaginatorUrls({
      data: [], current_page: 1, per_page: 10, total: 0, last_page: 1,
      from: null, to: null, has_more_pages: false,
    })
    expect(p.path).toBeUndefined()
    expect(p.next_page_url).toBeUndefined()
  })
})
