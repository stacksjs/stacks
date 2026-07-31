import { describe, expect, test } from 'bun:test'
import {
  buildWebAnalytics,
  normalizeAnalyticsRange,
  normalizeAnalyticsScope,
  requestAnalyticsRow,
} from './request-analytics'

const now = new Date('2026-07-29T12:00:00.000Z')

describe('request analytics', () => {
  test('normalizes supported ranges', () => {
    expect(normalizeAnalyticsRange('week')).toBe('week')
    expect(normalizeAnalyticsRange(undefined)).toBe('month')
    expect(() => normalizeAnalyticsRange('invalid')).toThrow('must be day, week, month, or year')
    expect(() => normalizeAnalyticsRange(7)).toThrow('must be a string')
  })

  test('normalizes supported traffic scopes', () => {
    expect(normalizeAnalyticsScope('blog')).toBe('blog')
    expect(normalizeAnalyticsScope('commerce')).toBe('commerce')
    expect(normalizeAnalyticsScope(undefined)).toBe('all')
    expect(() => normalizeAnalyticsScope('unknown')).toThrow('must be all, blog, or commerce')
  })

  test('maps valid request records and rejects corrupted metrics', () => {
    const values: Record<string, unknown> = {
      method: 'GET',
      path: '/docs',
      status_code: 200,
      duration_ms: 24,
      ip_address: null,
      user_agent: 'Test browser',
      created_at: '2026-07-29T11:58:00.000Z',
    }
    const record = { get: (key: string) => values[key] }

    expect(requestAnalyticsRow(record)).toEqual({
      method: 'GET',
      path: '/docs',
      statusCode: 200,
      durationMs: 24,
      ipAddress: '',
      userAgent: 'Test browser',
      createdAt: '2026-07-29T11:58:00.000Z',
    })

    values.status_code = 'unknown'
    expect(() => requestAnalyticsRow(record)).toThrow('status_code must be a finite number')
    values.status_code = 200
    values.created_at = 'not-a-date'
    expect(() => requestAnalyticsRow(record)).toThrow('created_at must be a valid timestamp')
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
      realtimeVisitors: 1,
      uniqueVisitors: 1,
      pageViews: 2,
      averageResponseTime: '40 ms',
      errorRate: '33.3%',
      successfulRequests: 2,
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
