import { afterEach, describe, expect, it } from 'bun:test'
import { BlueskyApiError, BlueskyPublishingDriver } from '../src/drivers/bluesky'
import { InstagramApiError } from '../src/drivers/instagram'
import { LinkedInApiError, LinkedInPublishingDriver } from '../src/drivers/linkedin'
import { MastodonApiError, MastodonPublishingDriver } from '../src/drivers/mastodon'
import { ThreadsApiError, ThreadsPublishingDriver } from '../src/drivers/threads'
import { TwitterApiError, TwitterPublishingDriver } from '../src/drivers/twitter'
import { retryAfterMs, SocialApiError } from '../src/errors'

/**
 * One error type across the publishing drivers (stacksjs/stacks#3379): the
 * network, what kind of failure, the network's reason as the message rather
 * than its raw body, and how long it asked to be left alone.
 */

const realFetch = globalThis.fetch
afterEach(() => {
  globalThis.fetch = realFetch
})

function answerWith(status: number, body: unknown, headers: Record<string, string> = {}): void {
  globalThis.fetch = (async () => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers })) as unknown as typeof fetch
}

async function failure(attempt: () => Promise<unknown>): Promise<SocialApiError> {
  try {
    await attempt()
  }
  catch (error) {
    if (error instanceof SocialApiError) return error
    throw error
  }
  throw new Error('expected the call to fail')
}

describe('every driver error is a SocialApiError', () => {
  it('keeps its own class and names its network', () => {
    const errors = [
      [new BlueskyApiError('m', 400, ''), 'bluesky'],
      [new InstagramApiError('m', 400, ''), 'instagram'],
      [new LinkedInApiError('m', 400, ''), 'linkedin'],
      [new MastodonApiError('m', 400, ''), 'mastodon'],
      [new ThreadsApiError('m', 400, ''), 'threads'],
      [new TwitterApiError('m', 400, ''), 'twitter'],
    ] as const
    for (const [error, network] of errors) {
      expect(error).toBeInstanceOf(SocialApiError)
      expect(error.network).toBe(network)
      expect(error.name).toBe(error.constructor.name)
    }
  })
})

describe('a failed answer', () => {
  it('says the network\'s reason, and keeps the raw body on the error', async () => {
    const body = { error: 'Validation failed: Text character limit of 500 exceeded' }
    answerWith(422, body)
    const error = await failure(() => new MastodonPublishingDriver().publish({ handle: 'glenn', did: 'https://social.example', accessToken: 'AT' }, { text: 'hi' }))
    expect(error).toBeInstanceOf(MastodonApiError)
    expect(error.message).toBe('Mastodon API failed (422): Validation failed: Text character limit of 500 exceeded')
    expect(error.body).toBe(JSON.stringify(body))
    expect(error.kind).toBe('content')
    expect(error.reason).toBe('Validation failed: Text character limit of 500 exceeded')
  })

  it('falls back to the status text, never to a dump', async () => {
    answerWith(502, '<html><body>bad gateway</body></html>')
    const error = await failure(() => new TwitterPublishingDriver().publish({ handle: 'glenn', accessToken: 'AT' }, { text: 'hi' }))
    expect(error.message).not.toContain('<html>')
    expect(error.message).toStartWith('Twitter API failed (502): ')
    expect(error.kind).toBe('temporary')
  })

  it('carries a duplicate post on X as a duplicate, not an expired sign-in', async () => {
    answerWith(403, { detail: 'You are not allowed to create a Tweet with duplicate content.' })
    const error = await failure(() => new TwitterPublishingDriver().publish({ handle: 'glenn', accessToken: 'AT' }, { text: 'hi' }))
    expect(error.kind).toBe('duplicate')
    expect(error.message).toBe('Twitter API failed (403): You are not allowed to create a Tweet with duplicate content')
  })

  it('carries how long Bluesky asked to wait on a rate limit', async () => {
    const reset = Math.floor(Date.now() / 1000) + 120
    answerWith(429, { error: 'RateLimitExceeded', message: 'Rate Limit Exceeded' }, { 'ratelimit-reset': String(reset) })
    const error = await failure(() => new BlueskyPublishingDriver().publish({ handle: 'glenn.bsky.social', did: 'did:plc:abc', accessToken: 'AT' }, { text: 'hi' }))
    expect(error.kind).toBe('rate-limited')
    expect(error.retryAfterMs).toBeGreaterThan(110_000)
    expect(error.retryAfterMs).toBeLessThanOrEqual(120_000)
  })

  it('reads a Meta rate limit, which comes as a 400', async () => {
    answerWith(400, { error: { message: '(#4) Application request limit reached', code: 4 } }, {
      'x-business-use-case-usage': JSON.stringify({ 1784: [{ type: 'instagram', call_count: 100, estimated_time_to_regain_access: 7 }] }),
    })
    const error = await failure(() => new ThreadsPublishingDriver().publish({ handle: 'glenn', did: '42', accessToken: 'AT' }, { text: 'hi' }))
    expect(error).toBeInstanceOf(ThreadsApiError)
    expect(error.kind).toBe('rate-limited')
    expect(error.retryAfterMs).toBe(7 * 60_000)
  })

  it('honours Retry-After on LinkedIn', async () => {
    answerWith(429, { message: 'Resource level throttle limit for calls to this resource is reached', status: 429 }, { 'retry-after': '60' })
    const error = await failure(() => new LinkedInPublishingDriver().publish({ handle: 'glenn', did: 'urn:li:person:abc', accessToken: 'AT' }, { text: 'hi' }))
    expect(error.kind).toBe('rate-limited')
    expect(error.retryAfterMs).toBe(60_000)
  })
})

describe('retryAfterMs', () => {
  const now = Date.parse('2026-11-26T12:00:00Z')
  const headers = (entries: Record<string, string>): Headers => new Headers(entries)

  it('reads Retry-After as seconds or a date, on any answer', () => {
    expect(retryAfterMs(headers({ 'retry-after': '60' }), { rateLimited: false, now })).toBe(60_000)
    expect(retryAfterMs(headers({ 'retry-after': 'Thu, 26 Nov 2026 12:01:30 GMT' }), { rateLimited: false, now })).toBe(90_000)
  })

  it('reads each network\'s reset header on a rate limit', () => {
    const unix = String(now / 1000 + 300)
    expect(retryAfterMs(headers({ 'x-rate-limit-reset': unix }), { rateLimited: true, now })).toBe(300_000)
    expect(retryAfterMs(headers({ 'ratelimit-reset': unix }), { rateLimited: true, now })).toBe(300_000)
    expect(retryAfterMs(headers({ 'x-ratelimit-reset': '2026-11-26T12:05:00.000Z' }), { rateLimited: true, now })).toBe(300_000)
    expect(retryAfterMs(headers({ 'x-app-usage': '{"call_count":100,"estimated_time_to_regain_access":2}' }), { rateLimited: true, now })).toBe(120_000)
  })

  it('ignores reset headers on an answer that is not a rate limit: they come with every answer', () => {
    expect(retryAfterMs(headers({ 'x-rate-limit-reset': String(now / 1000 + 300) }), { rateLimited: false, now })).toBeUndefined()
  })

  it('never asks to wait a negative time, and gives nothing for nothing', () => {
    expect(retryAfterMs(headers({ 'x-rate-limit-reset': String(now / 1000 - 30) }), { rateLimited: true, now })).toBe(0)
    expect(retryAfterMs(headers({}), { rateLimited: true, now })).toBeUndefined()
    expect(retryAfterMs(headers({ 'retry-after': 'soon' }), { rateLimited: true, now })).toBeUndefined()
  })
})
