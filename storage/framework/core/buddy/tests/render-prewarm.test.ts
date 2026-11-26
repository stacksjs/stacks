import { describe, expect, it } from 'bun:test'
import { isPrewarmRequest, loopbackOrigin, PREWARM_HEADER, prewarmFromSitemap, renderCacheHost, sitemapTargets } from '../src/render-prewarm'

const sitemap = (...locs: string[]) => `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${locs.map(loc => `  <url>\n    <loc>${loc}</loc>\n    <priority>0.5</priority>\n  </url>`).join('\n')}
</urlset>`

describe('sitemapTargets', () => {
  it('lists each page once, as the path and query the server receives', () => {
    const targets = sitemapTargets(sitemap(
      'https://example.com/',
      'https://example.com/features/auth',
      'https://example.com/features/auth',
      'https://example.com/search?q=a&amp;page=2',
    ))
    expect(targets).toEqual([
      { path: '/', host: 'example.com' },
      { path: '/features/auth', host: 'example.com' },
      { path: '/search?q=a&page=2', host: 'example.com' },
    ])
  })

  it('keeps the same path on two hosts apart, for a multi-site app', () => {
    expect(sitemapTargets(sitemap('https://a.example/', 'https://b.example/'))).toEqual([
      { path: '/', host: 'a.example' },
      { path: '/', host: 'b.example' },
    ])
  })

  it('skips what is not a web page, and stops at the limit', () => {
    expect(sitemapTargets(sitemap('mailto:hi@example.com', 'ftp://example.com/x', 'https://example.com/ok'))).toEqual([{ path: '/ok', host: 'example.com' }])
    const many = sitemap(...Array.from({ length: 20 }, (_, index) => `https://example.com/p${index}`))
    expect(sitemapTargets(many, 5)).toHaveLength(5)
  })
})

describe('renderCacheHost', () => {
  const proxied = new Request('http://127.0.0.1:3000/', { headers: { host: '127.0.0.1:3000', 'x-forwarded-host': 'example.com' } })
  const loopback = new Request('http://localhost:3000/', { headers: { host: 'localhost:3000' } })

  it('leaves the host out for a single-site app, so a loopback warm and a proxied visit share an entry', () => {
    const host = renderCacheHost(false, () => { throw new Error('a single-site app never asks') })
    expect(host(proxied)).toBe(host(loopback))
  })

  it('uses the trusted visitor host for a multi-site app', () => {
    const host = renderCacheHost(true, request => request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? '')
    expect(host(proxied)).toBe('example.com')
    expect(host(loopback)).toBe('localhost:3000')
  })
})

describe('loopbackOrigin', () => {
  it('reaches a server bound to every address over 127.0.0.1, and a specific one where it listens', () => {
    expect(loopbackOrigin(3000)).toBe('http://127.0.0.1:3000')
    expect(loopbackOrigin(3000, '0.0.0.0')).toBe('http://127.0.0.1:3000')
    expect(loopbackOrigin(3000, '::')).toBe('http://127.0.0.1:3000')
    expect(loopbackOrigin(3000, '10.0.0.5')).toBe('http://10.0.0.5:3000')
    expect(loopbackOrigin(3000, '::1')).toBe('http://[::1]:3000')
  })
})

describe('prewarmFromSitemap', () => {
  function server(pages: Record<string, number>) {
    const requests: { url: string, headers: Record<string, string> }[] = []
    const fetcher = async (url: string, init?: RequestInit) => {
      requests.push({ url, headers: { ...(init?.headers as Record<string, string>) } })
      const path = url.replace('http://127.0.0.1:3000', '')
      if (path === '/sitemap.xml')
        return new Response(sitemap(...Object.keys(pages).map(page => `https://example.com${page}`)))
      return new Response('page', { status: pages[path] ?? 404 })
    }
    return { requests, fetcher }
  }

  it('requests every page the sitemap lists, through this server, marked as a warm-up', async () => {
    const { requests, fetcher } = server({ '/': 200, '/blog': 200, '/features/auth': 200 })
    const result = await prewarmFromSitemap({ origin: 'http://127.0.0.1:3000', multiHost: false, fetch: fetcher })
    expect(result).toMatchObject({ warmed: 3, failed: 0, total: 3 })
    expect(requests.map(request => request.url).sort()).toEqual([
      'http://127.0.0.1:3000/',
      'http://127.0.0.1:3000/blog',
      'http://127.0.0.1:3000/features/auth',
      'http://127.0.0.1:3000/sitemap.xml',
    ])
    for (const request of requests) {
      expect(request.headers[PREWARM_HEADER]).toBe('1')
      // A single-site app's key has no host, so nothing pretends to be the gateway.
      expect(request.headers['x-forwarded-host']).toBeUndefined()
    }
  })

  it('sends each page\'s own host for a multi-site app, the way the gateway does', async () => {
    const { requests, fetcher } = server({ '/': 200 })
    await prewarmFromSitemap({ origin: 'http://127.0.0.1:3000', multiHost: true, fetch: fetcher })
    expect(requests.find(request => request.url.endsWith(':3000/'))?.headers['x-forwarded-host']).toBe('example.com')
  })

  it('counts a page that does not render, and carries on', async () => {
    const { fetcher } = server({ '/': 200, '/gone': 500 })
    expect(await prewarmFromSitemap({ origin: 'http://127.0.0.1:3000', multiHost: false, fetch: fetcher })).toMatchObject({ warmed: 1, failed: 1, total: 2 })
  })

  it('does nothing, and never throws, when there is no sitemap or no server', async () => {
    const missing = async () => new Response('', { status: 404 })
    expect(await prewarmFromSitemap({ origin: 'http://127.0.0.1:3000', multiHost: false, fetch: missing })).toMatchObject({ warmed: 0, total: 0 })
    const down = async () => { throw new Error('ECONNREFUSED') }
    expect(await prewarmFromSitemap({ origin: 'http://127.0.0.1:3000', multiHost: false, fetch: down })).toMatchObject({ warmed: 0, total: 0 })
  })

  it('waits for a server that is still starting, then warms it', async () => {
    let attempts = 0
    const { fetcher: answer } = server({ '/': 200 })
    const starting = async (url: string, init?: RequestInit) => {
      if (++attempts < 4)
        throw new Error('ECONNREFUSED')
      return answer(url, init)
    }
    const result = await prewarmFromSitemap({ origin: 'http://127.0.0.1:3000', multiHost: false, waitMs: 10_000, fetch: starting, sleep: async () => {} })
    expect(result).toMatchObject({ warmed: 1, total: 1 })
    expect(attempts).toBeGreaterThanOrEqual(4)
  })

  it('keeps no more pages rendering at once than it was given', async () => {
    let active = 0
    let peak = 0
    const fetcher = async (url: string) => {
      if (url.endsWith('/sitemap.xml'))
        return new Response(sitemap(...Array.from({ length: 12 }, (_, index) => `https://example.com/p${index}`)))
      active++
      peak = Math.max(peak, active)
      await Bun.sleep(5)
      active--
      return new Response('page')
    }
    await prewarmFromSitemap({ origin: 'http://127.0.0.1:3000', multiHost: false, concurrency: 3, fetch: fetcher })
    expect(peak).toBe(3)
  })
})

describe('isPrewarmRequest', () => {
  it('tells a warm-up from a visit', () => {
    expect(isPrewarmRequest(new Request('http://x/', { headers: { [PREWARM_HEADER]: '1' } }))).toBe(true)
    expect(isPrewarmRequest(new Request('http://x/'))).toBe(false)
  })
})
