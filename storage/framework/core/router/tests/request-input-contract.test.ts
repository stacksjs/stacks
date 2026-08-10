import { describe, expect, test } from 'bun:test'
import type { EnhancedRequest } from '@stacksjs/bun-router'
import { enhanceRequest } from '../src/stacks-router'

function requestWith(
  input: Record<string, unknown> = {},
  options: { headers?: HeadersInit, method?: string, params?: Record<string, string>, url?: string } = {},
): EnhancedRequest {
  const request = new Request(options.url ?? 'https://example.test/items?query=search', {
    headers: options.headers,
    method: options.method ?? 'POST',
  }) as EnhancedRequest
  request.jsonBody = input
  request.params = options.params ?? {}
  return enhanceRequest(request)
}

describe('request input contract', () => {
  test('provides every typed casting and collection helper', () => {
    const request = requestWith({
      empty: '',
      invalidDate: 'not-a-date',
      publishedAt: '2026-07-31T12:00:00Z',
      status: 'published',
      tags: ['stacks', 'typescript'],
    })
    const statuses = { Draft: 'draft', Published: 'published' } as const

    expect(request.keys().sort()).toEqual([
      'empty',
      'invalidDate',
      'publishedAt',
      'query',
      'status',
      'tags',
    ])
    expect(request.date('publishedAt')?.toISOString()).toBe('2026-07-31T12:00:00.000Z')
    expect(request.date('invalidDate')).toBeNull()
    expect(request.enum('status', statuses)).toBe('published')
    expect(request.collect<string>('tags').toArray()).toEqual(['stacks', 'typescript'])
    expect(request.isValue('status', 'published')).toBe(true)
  })

  test('merges input and runs conditional callbacks', () => {
    const request = requestWith({ empty: '', name: 'Stacks' })
    const calls: string[] = []

    request.merge({ role: 'admin' })
    request.whenHas<string>('name', value => calls.push(`has:${value}`))
    request.whenHas('missing', () => calls.push('unexpected'), () => calls.push('missing'))
    request.whenFilled<string>('name', value => calls.push(`filled:${value}`))
    request.whenFilled('empty', () => calls.push('unexpected'), () => calls.push('empty'))

    expect(request.get('role')).toBe('admin')
    expect(calls).toEqual(['has:Stacks', 'missing', 'filled:Stacks', 'empty'])
  })

  test('supports route, method, browser, and empty-input utilities', () => {
    const request = requestWith({}, {
      headers: {
        'user-agent': 'Stacks Test Browser',
        'x-forwarded-for': '203.0.113.10',
      },
      method: 'PATCH',
      params: { id: '42' },
    })

    expect(request.getParams()).toEqual({ id: '42' })
    expect(request.getMethod()).toBe('PATCH')
    expect(request.browser()).toBe('Stacks Test Browser')
    expect(request.ipForRateLimit()).toBe('203.0.113.10')
    expect(request.isEmpty()).toBe(false)
    expect(requestWith({}, { url: 'https://example.test/items' }).isEmpty()).toBe(true)
  })

  test('decodes route parameters once before actions read them', () => {
    const request = requestWith({}, {
      params: {
        id: 'disk%3Amessage%2520name.html',
        malformed: 'value%2',
      },
    })

    expect(request.getParams()).toEqual({
      id: 'disk:message%20name.html',
      malformed: 'value%2',
    })
    expect(request.get('id')).toBe('disk:message%20name.html')
  })

  test('flashes all, selected, and excluded input on the request', () => {
    const request = requestWith({ email: 'hello@example.com', password: 'secret', remember: true })

    request.flashInputOnly(['email'])
    expect(request.old('email')).toBe('hello@example.com')
    expect(request.old('password')).toBeUndefined()

    request.flashInputExcept(['password'])
    expect(request.old('remember')).toBe(true)
    expect(request.old('password', 'redacted')).toBe('redacted')

    request.flashInput()
    expect(request.old('password')).toBe('secret')
  })
})
