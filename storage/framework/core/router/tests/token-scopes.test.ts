/**
 * What a request's token grants is read from its `scopes`, which every token
 * row carries (stacksjs/stacks#3236).
 *
 * Two shapes are stamped on `request._currentAccessToken`: the Auth middleware
 * stamps a `PersonalAccessToken`, whose `abilities` copy its scopes, and
 * `currentAccessToken()` in `@stacksjs/auth` stamps the plain `AccessToken`
 * row, which has no `abilities` at all. `tokenCan()` and the Abilities
 * middleware read `abilities`, so a request carrying the plain row was denied
 * every ability its token granted.
 */

import { describe, expect, test } from 'bun:test'
import type { EnhancedRequest } from '@stacksjs/bun-router'
import { applyRequestEnhancements } from '@stacksjs/bun-router'
import type { AccessToken, PersonalAccessToken } from '@stacksjs/types'
import Abilities from '../../../defaults/app/Middleware/Abilities'
import { enhanceRequest } from '../src/stacks-router'

function row(scopes: string[]): AccessToken {
  const now = new Date()
  return { id: 1, userId: 7, clientId: 1, name: 'cli', scopes, revoked: false, expiresAt: null, createdAt: now, updatedAt: now }
}

function personal(scopes: string[]): PersonalAccessToken {
  return { ...row(scopes), abilities: scopes }
}

function requestWith(token: AccessToken, abilities?: string): EnhancedRequest {
  const req = enhanceRequest(applyRequestEnhancements(new Request('https://example.com/api/posts'), {}) as EnhancedRequest)
  req._currentAccessToken = token
  if (abilities)
    req._middlewareParams = { abilities }
  return req
}

async function status(run: () => Promise<unknown>): Promise<number> {
  try {
    await run()
    return 200
  }
  catch (error) {
    return (error as { statusCode?: number, status?: number }).statusCode ?? (error as { status?: number }).status ?? 500
  }
}

for (const [shape, make] of [['plain row', row], ['personal token', personal]] as const) {
  describe(`a ${shape}`, () => {
    test('tokenCan grants what its scopes grant, and nothing else', async () => {
      const req = requestWith(make(['posts:read']))
      expect(await req.tokenCan!('posts:read')).toBe(true)
      expect(await req.tokenCan!('posts:write')).toBe(false)
    })

    test('a wildcard scope grants everything', async () => {
      expect(await requestWith(make(['*'])).tokenCan!('posts:write')).toBe(true)
    })

    test('the Abilities middleware lets a granted ability through and refuses the rest', async () => {
      expect(await status(() => Abilities.handle(requestWith(make(['posts:read']), 'posts:read')))).toBe(200)
      expect(await status(() => Abilities.handle(requestWith(make(['posts:read']), 'posts:read,posts:write')))).toBe(403)
    })
  })
}

test('a token with no scopes array fails closed', async () => {
  const broken = { ...row([]), scopes: undefined } as unknown as AccessToken
  expect(await requestWith(broken).tokenCan!('posts:read')).toBe(false)
  expect(await status(() => Abilities.handle(requestWith(broken, 'posts:read')))).toBe(403)
})
