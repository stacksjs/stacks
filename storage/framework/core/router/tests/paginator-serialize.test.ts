import { describe, expect, test } from 'bun:test'
import type { CursorPaginator, Paginator, SimplePaginator } from '@stacksjs/orm'

import { createStacksRouter } from '../src/stacks-router'

// Paginator link examples, followed by a real router serialization check.

function buildExpectedLinks(p: { prev_page_url?: string | null, next_page_url?: string | null, first_page_url?: string, last_page_url?: string }): string {
  const parts: string[] = []
  if (p.prev_page_url) parts.push(`<${p.prev_page_url}>; rel="prev"`)
  if (p.next_page_url) parts.push(`<${p.next_page_url}>; rel="next"`)
  if (p.first_page_url) parts.push(`<${p.first_page_url}>; rel="first"`)
  if (p.last_page_url) parts.push(`<${p.last_page_url}>; rel="last"`)
  return parts.join(', ')
}

describe('Paginator → Link header contract', () => {
  test('full Paginator emits 4 rels when all URLs are present', () => {
    const paginator: Paginator<{ id: number }> = {
      data: [{ id: 1 }],
      current_page: 3,
      per_page: 15,
      total: 100,
      last_page: 7,
      from: 31,
      to: 45,
      has_more_pages: true,
      prev_page_url: '/users?page=2',
      next_page_url: '/users?page=4',
      first_page_url: '/users?page=1',
      last_page_url: '/users?page=7',
    }
    const header = buildExpectedLinks(paginator)
    expect(header).toContain('<' + '/users?page=2' + '>; rel="prev"')
    expect(header).toContain('<' + '/users?page=4' + '>; rel="next"')
    expect(header).toContain('<' + '/users?page=1' + '>; rel="first"')
    expect(header).toContain('<' + '/users?page=7' + '>; rel="last"')
  })

  test('omits prev rel on page 1 (prev_page_url null)', () => {
    const paginator: Paginator<{ id: number }> = {
      data: [{ id: 1 }],
      current_page: 1,
      per_page: 15,
      total: 100,
      last_page: 7,
      from: 1,
      to: 15,
      has_more_pages: true,
      prev_page_url: null,
      next_page_url: '/users?page=2',
      first_page_url: '/users?page=1',
      last_page_url: '/users?page=7',
    }
    const header = buildExpectedLinks(paginator)
    expect(header).not.toContain('rel="prev"')
    expect(header).toContain('rel="next"')
  })

  test('SimplePaginator emits only prev/next (no first/last)', () => {
    const paginator: SimplePaginator<{ id: number }> = {
      data: [{ id: 1 }],
      current_page: 2,
      per_page: 10,
      has_more_pages: true,
      prev_page_url: '/feed?page=1',
      next_page_url: '/feed?page=3',
    }
    const header = buildExpectedLinks(paginator)
    expect(header).toContain('rel="prev"')
    expect(header).toContain('rel="next"')
    expect(header).not.toContain('rel="first"')
    expect(header).not.toContain('rel="last"')
  })

  test('CursorPaginator emits prev/next with cursor params in the URL', () => {
    const paginator: CursorPaginator<{ id: number }> = {
      data: [{ id: 1 }],
      per_page: 10,
      next_cursor: 'after_mid',
      prev_cursor: 'before_mid',
      has_more_pages: true,
      prev_page_url: '/feed?cursor=before_mid',
      next_page_url: '/feed?cursor=after_mid',
    }
    const header = buildExpectedLinks(paginator)
    expect(header).toContain('cursor=after_mid')
    expect(header).toContain('cursor=before_mid')
  })

  test('paginator with no URLs (e.g. CLI-context call) yields empty header', () => {
    const paginator: Paginator<{ id: number }> = {
      data: [{ id: 1 }],
      current_page: 1,
      per_page: 15,
      total: 100,
      last_page: 7,
      from: 1,
      to: 15,
      has_more_pages: true,
      // no URLs — happens when paginate() is called outside any request
    }
    expect(buildExpectedLinks(paginator)).toBe('')
  })
})

// Exercise serialization through the router, including browser negotiation.
describe('formatResult sets Link header on paginator returns', () => {
  test('returning a paginator to a browser results in JSON body + Link header', async () => {
    const paginator: Paginator<{ id: number }> = {
      data: [{ id: 1 }, { id: 2 }],
      current_page: 1,
      per_page: 2,
      total: 5,
      last_page: 3,
      from: 1,
      to: 2,
      has_more_pages: true,
      next_page_url: '/items?page=2',
      first_page_url: '/items?page=1',
      last_page_url: '/items?page=3',
    }
    const router = createStacksRouter()
    router.get('/items', () => paginator)
    const response = await router.handleRequest(new Request('http://localhost/items', {
      headers: { accept: 'text/html', 'sec-fetch-dest': 'document' },
    }))

    expect(response.headers.get('content-type')).toContain('application/json')
    expect(response.headers.get('Link')).toBe('</items?page=2>; rel="next", </items?page=1>; rel="first", </items?page=3>; rel="last"')
    const body = (await response.json()) as Paginator<{ id: number }>
    expect(body.data).toHaveLength(2)
    expect(body.total).toBe(5)
  })
})
