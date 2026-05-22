import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import type { EnhancedRequest } from '@stacksjs/bun-router'
import { applyRequestEnhancements } from '@stacksjs/bun-router'
import { Gate } from '@stacksjs/auth'
import { enhanceRequest } from '../src/stacks-router'

// Tests for `req.can` / `req.cannot` / `req.authorize` macros
// (stacksjs/stacks#1874 F-9). The macros lazy-import @stacksjs/auth
// to dodge the router←auth cycle, then delegate to Gate.allows /
// Gate.denies / Gate.authorize.

function makeEnhancedRequest(opts: { user?: unknown } = {}): EnhancedRequest {
  const raw = new Request('https://example.com/api/posts/1', {
    method: 'POST',
  })
  const req = applyRequestEnhancements(raw, { id: '1' }) as EnhancedRequest
  if (opts.user !== undefined) {
    ;(req as any)._authenticatedUser = opts.user
  }
  return enhanceRequest(req)
}

describe('req.can / req.cannot (stacksjs/stacks#1874 F-9)', () => {
  beforeEach(() => {
    Gate.flush()
  })

  afterEach(() => {
    Gate.flush()
  })

  test('req.can returns true when an inline gate allows', async () => {
    Gate.define('publish-post', () => true)
    const req = makeEnhancedRequest({ user: { id: 42, name: 'Alice' } })
    expect(await req.can!('publish-post')).toBe(true)
  })

  test('req.can returns false when the inline gate denies', async () => {
    Gate.define('publish-post', () => false)
    const req = makeEnhancedRequest({ user: { id: 42 } })
    expect(await req.can!('publish-post')).toBe(false)
  })

  test('req.can passes additional args through to the gate', async () => {
    Gate.define('update-post', (_user: unknown, post: any) => post?.authorId === (_user as any)?.id)
    const req = makeEnhancedRequest({ user: { id: 7 } })
    expect(await req.can!('update-post', { authorId: 7 })).toBe(true)
    expect(await req.can!('update-post', { authorId: 99 })).toBe(false)
  })

  test('req.can returns false for empty / non-string ability', async () => {
    const req = makeEnhancedRequest({ user: { id: 7 } })
    expect(await req.can!('')).toBe(false)
    // @ts-expect-error - testing runtime guard
    expect(await req.can!(undefined)).toBe(false)
  })

  test('req.cannot is the inverse of req.can', async () => {
    Gate.define('access-admin', () => false)
    const req = makeEnhancedRequest({ user: { id: 7 } })
    expect(await req.cannot!('access-admin')).toBe(true)

    Gate.define('view-dashboard', () => true)
    expect(await req.cannot!('view-dashboard')).toBe(false)
  })

  test('req.can handles unauthenticated user (passes null to gate)', async () => {
    Gate.define('view-public', (user: unknown) => user === null)
    const req = makeEnhancedRequest({}) // no _authenticatedUser
    expect(await req.can!('view-public')).toBe(true)
  })
})

describe('req.authorize (Laravel-style throw-on-deny)', () => {
  beforeEach(() => {
    Gate.flush()
  })

  afterEach(() => {
    Gate.flush()
  })

  test('resolves silently when allowed', async () => {
    Gate.define('do-thing', () => true)
    const req = makeEnhancedRequest({ user: { id: 1 } })
    await expect(req.authorize!('do-thing')).resolves.toBeUndefined()
  })

  test('throws AuthorizationException when denied', async () => {
    Gate.define('do-thing', () => false)
    const req = makeEnhancedRequest({ user: { id: 1 } })
    await expect(req.authorize!('do-thing')).rejects.toThrow(/unauthorized/i)
  })

  test('throws with the gate-supplied deny reason', async () => {
    const { AuthorizationResponse } = await import('@stacksjs/auth')
    Gate.define('finalize-payment', () => AuthorizationResponse.deny('Subscription expired', 'SUB_EXPIRED'))
    const req = makeEnhancedRequest({ user: { id: 1 } })
    try {
      await req.authorize!('finalize-payment')
      throw new Error('expected authorize to throw')
    }
    catch (e) {
      expect((e as Error).message).toContain('Subscription expired')
    }
  })
})
