import { describe, expect, test } from 'bun:test'
import { buildWebAnalytics, normalizeAnalyticsRange, normalizeAnalyticsScope } from './request-analytics'

const now = new Date('2026-07-29T12:00:00.000Z')

describe('request analytics', () => {
  test('normalizes supported ranges', () => {
    expect(normalizeAnalyticsRange('week')).toBe('week')
    expect(normalizeAnalyticsRange('invalid')).toBe('month')
  })

  test('normalizes supported traffic scopes', () => {
    expect(normalizeAnalyticsScope('blog')).toBe('blog')
    expect(normalizeAnalyticsScope('commerce')).toBe('commerce')
    expect(normalizeAnalyticsScope('unknown')).toBe('all')
  })

  test('aggregates page traffic without exposing visitor identities', () => {
    const result = buildWebAnalytics([
      {
        method: 'GET',
        path: 'https://example.com/docs',
        statusCode: 200,
        durationMs: 24,
        ipAddress: '192.0.2.1',
        userAgent: 'Mozilla/5.0 Chrome/120.0.0.0 Safari/537.36',
        createdAt: '2026-07-29 11:58:00',
      },
      {
        method: 'GET',
        path: '/docs',
        statusCode: 200,
        durationMs: 36,
        ipAddress: '192.0.2.1',
        userAgent: 'Mozilla/5.0 Chrome/120.0.0.0 Safari/537.36',
        createdAt: '2026-07-29T11:59:00.000Z',
      },
      {
        method: 'GET',
        path: '/api/users',
        statusCode: 500,
        durationMs: 60,
        ipAddress: '192.0.2.2',
        userAgent: 'Mozilla/5.0 Firefox/120.0',
        createdAt: '2026-07-29T11:59:30.000Z',
      },
    ], 'day', now)

    expect(result.overview).toEqual({
      realtime: 1,
      people: 1,
      views: 2,
      avgTimeOnSite: '40 ms',
      bounceRate: '33.3%',
      eventCompletions: 2,
    })
    expect(result.pages).toEqual([{
      path: '/docs',
      entries: 2,
      visitors: 1,
      views: 2,
      percentage: 100,
    }])
    expect(JSON.stringify(result)).not.toContain('192.0.2.1')
  })

  test('filters traffic to native route scopes', () => {
    const rows = [
      {
        method: 'GET',
        path: '/blog/native-stx',
        statusCode: 200,
        durationMs: 20,
        ipAddress: '192.0.2.10',
        userAgent: 'Mozilla/5.0 Chrome/120.0.0.0 Safari/537.36',
        createdAt: '2026-07-29T11:58:00.000Z',
      },
      {
        method: 'GET',
        path: '/commerce/products',
        statusCode: 200,
        durationMs: 30,
        ipAddress: '192.0.2.11',
        userAgent: 'Mozilla/5.0 Firefox/120.0',
        createdAt: '2026-07-29T11:59:00.000Z',
      },
    ]

    const blog = buildWebAnalytics(rows, 'day', now, 'blog')
    const commerce = buildWebAnalytics(rows, 'day', now, 'commerce')

    expect(blog.pages.map(page => page.path)).toEqual(['/blog/native-stx'])
    expect(commerce.pages.map(page => page.path)).toEqual(['/commerce/products'])
  })
})
