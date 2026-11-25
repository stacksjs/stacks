import { afterEach, describe, expect, it } from 'bun:test'
import { BlueskyPublishingDriver } from '../src/drivers/bluesky'
import { InstagramApiError, InstagramPublishingDriver } from '../src/drivers/instagram'
import { LinkedInApiError, LinkedInPublishingDriver } from '../src/drivers/linkedin'
import { MastodonPublishingDriver } from '../src/drivers/mastodon'
import { ThreadsApiError, ThreadsPublishingDriver } from '../src/drivers/threads'
import { TwitterPublishingDriver } from '../src/drivers/twitter'
import { supportsMetrics } from '../src/types'

/**
 * One metrics shape across the drivers that can read engagement
 * (stacksjs/stacks#3379), asserted on the requests each one sends.
 */

const realFetch = globalThis.fetch
afterEach(() => {
  globalThis.fetch = realFetch
})

interface Sent { url: string, headers: Headers }

function mockFetch(answer: (url: string) => unknown | Response): Sent[] {
  const sent: Sent[] = []
  globalThis.fetch = (async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = String(input)
    sent.push({ url, headers: new Headers(init.headers) })
    const reply = answer(url)
    return reply instanceof Response ? reply : new Response(JSON.stringify(reply), { status: 200 })
  }) as typeof fetch
  return sent
}

describe('which drivers read metrics', () => {
  it('every API driver but X does; X is feature-detected as not', () => {
    for (const driver of [new BlueskyPublishingDriver(), new MastodonPublishingDriver(), new ThreadsPublishingDriver(), new InstagramPublishingDriver(), new LinkedInPublishingDriver()])
      expect(supportsMetrics(driver)).toBe(true)
    expect(supportsMetrics(new TwitterPublishingDriver())).toBe(false)
  })
})

describe('Bluesky', () => {
  const identity = { handle: 'glenn.bsky.social', did: 'did:plc:abc', accessToken: 'AT' }

  it('asks 25 posts at a time, counts quotes, and leaves out a deleted post', async () => {
    const uris = Array.from({ length: 30 }, (_, i) => `at://did:plc:abc/app.bsky.feed.post/p${i}`)
    const sent = mockFetch((url) => {
      const asked = new URL(url).searchParams.getAll('uris')
      return { posts: asked.filter(uri => !uri.endsWith('/p3')).map(uri => ({ uri, likeCount: 5, repostCount: 2, replyCount: 1, quoteCount: 4 })) }
    })
    const metrics = await new BlueskyPublishingDriver().metrics(identity, uris)
    expect(sent.map(request => new URL(request.url).searchParams.getAll('uris').length)).toEqual([25, 5])
    expect(metrics).toHaveLength(29)
    expect(metrics[0]).toEqual({ uri: uris[0]!, likes: 5, reposts: 2, replies: 1, quotes: 4 })
    expect(metrics.some(entry => entry.uri.endsWith('/p3'))).toBe(false)
    expect(metrics[0]).not.toHaveProperty('views')
  })
})

describe('Mastodon', () => {
  const identity = { handle: 'glenn', did: 'https://social.example', accessToken: 'AT' }

  it('asks for every status in one request and answers by the uri it was given', async () => {
    const sent = mockFetch(() => [
      { id: '101', favourites_count: 7, reblogs_count: 3, replies_count: 2, quotes_count: 1 },
      { id: '102', favourites_count: 1, reblogs_count: 0, replies_count: 0 },
    ])
    const metrics = await new MastodonPublishingDriver().metrics(identity, ['101', 'https://social.example/@glenn/102', '103'])
    expect(sent).toHaveLength(1)
    expect(sent[0]!.url).toBe('https://social.example/api/v1/statuses?id[]=101&id[]=102&id[]=103')
    expect(sent[0]!.headers.get('authorization')).toBe('Bearer AT')
    expect(metrics).toEqual([
      { uri: '101', likes: 7, reposts: 3, replies: 2, quotes: 1 },
      // Before Mastodon 4.5 there is no quote count: absent, not zero.
      { uri: 'https://social.example/@glenn/102', likes: 1, reposts: 0, replies: 0 },
    ])
  })

  it('asks one status at a time on an instance older than 4.3, skipping one that is gone', async () => {
    const sent = mockFetch((url) => {
      if (url.includes('?id[]=')) return new Response('{"error":"Record not found"}', { status: 404 })
      if (url.endsWith('/102')) return new Response('{"error":"Record not found"}', { status: 404 })
      return { id: url.split('/').pop(), favourites_count: 4, reblogs_count: 1, replies_count: 0 }
    })
    const metrics = await new MastodonPublishingDriver().metrics(identity, ['101', '102'])
    expect(sent.map(request => request.url)).toEqual([
      'https://social.example/api/v1/statuses?id[]=101&id[]=102',
      'https://social.example/api/v1/statuses/101',
      'https://social.example/api/v1/statuses/102',
    ])
    expect(metrics).toEqual([{ uri: '101', likes: 4, reposts: 1, replies: 0 }])
  })

  it('does not hide a failure that is not a missing status', async () => {
    mockFetch(() => new Response('{"error":"The access token was revoked"}', { status: 401 }))
    await expect(new MastodonPublishingDriver().metrics(identity, ['101'])).rejects.toThrow('The access token was revoked')
  })
})

describe('Threads', () => {
  const identity = { handle: 'glenn', did: '42', accessToken: 'AT' }
  const insights = (likes: number) => ({
    data: [
      { name: 'views', period: 'lifetime', values: [{ value: 1200 }] },
      { name: 'likes', period: 'lifetime', values: [{ value: likes }] },
      { name: 'replies', period: 'lifetime', values: [{ value: 3 }] },
      { name: 'reposts', period: 'lifetime', values: [{ value: 2 }] },
      { name: 'quotes', period: 'lifetime', values: [{ value: 1 }] },
      { name: 'shares', period: 'lifetime', values: [{ value: 0 }] },
    ],
  })

  it('reads each post\'s insights, with the token in a header, and skips a post that is gone', async () => {
    const sent = mockFetch((url) => {
      if (url.includes('/gone/')) return new Response(JSON.stringify({ error: { message: 'Unsupported get request. Object with ID \'gone\' does not exist, cannot be loaded due to missing permissions, or does not support this operation', code: 100 } }), { status: 400 })
      return insights(url.includes('/a/') ? 10 : 20)
    })
    const metrics = await new ThreadsPublishingDriver().metrics(identity, ['a', 'gone', 'b'])
    expect(sent.map(request => new URL(request.url).pathname)).toEqual(['/v1.0/a/insights', '/v1.0/gone/insights', '/v1.0/b/insights'])
    expect(new URL(sent[0]!.url).searchParams.get('metric')).toBe('views,likes,replies,reposts,quotes,shares')
    expect(sent[0]!.url).not.toContain('AT')
    expect(sent[0]!.headers.get('authorization')).toBe('Bearer AT')
    expect(metrics).toEqual([
      { uri: 'a', views: 1200, likes: 10, replies: 3, reposts: 2, quotes: 1, shares: 0 },
      { uri: 'b', views: 1200, likes: 20, replies: 3, reposts: 2, quotes: 1, shares: 0 },
    ])
  })

  it('throws when the insights permission is missing, rather than reporting nothing', async () => {
    mockFetch(() => new Response(JSON.stringify({ error: { message: '(#10) Application does not have permission for this action', code: 10 } }), { status: 403 }))
    const failure = new ThreadsPublishingDriver().metrics(identity, ['a'])
    await expect(failure).rejects.toBeInstanceOf(ThreadsApiError)
    await expect(failure).rejects.toThrow('Application does not have permission for this action')
  })
})

describe('Instagram', () => {
  const identity = { handle: 'glenn', did: '1784', accessToken: 'AT' }

  it('reads each post\'s insights into the shared fields, and leaves out what has no data yet', async () => {
    const sent = mockFetch(() => ({
      data: [
        { name: 'likes', period: 'lifetime', values: [{ value: 40 }] },
        { name: 'comments', period: 'lifetime', values: [{ value: 6 }] },
        { name: 'shares', period: 'lifetime', values: [{ value: 2 }] },
        { name: 'saved', period: 'lifetime', values: [{ value: 9 }] },
        { name: 'reach', period: 'lifetime', values: [{ value: 800 }] },
      ],
    }))
    const metrics = await new InstagramPublishingDriver().metrics(identity, ['179'])
    expect(new URL(sent[0]!.url).pathname).toMatch(/^\/v\d+\.0\/179\/insights$/)
    expect(new URL(sent[0]!.url).searchParams.get('metric')).toBe('likes,comments,shares,saved,reach,views')
    expect(sent[0]!.url).not.toContain('AT')
    // No views came back: absent, not zero.
    expect(metrics).toEqual([{ uri: '179', likes: 40, replies: 6, shares: 2, saves: 9, reach: 800 }])
  })

  it('skips a post that is gone and throws on a missing permission', async () => {
    mockFetch(url => url.includes('/gone/')
      ? new Response(JSON.stringify({ error: { message: 'Unsupported get request. Object with ID \'gone\' does not exist', code: 100 } }), { status: 400 })
      : { data: [] })
    expect(await new InstagramPublishingDriver().metrics(identity, ['gone', '180'])).toEqual([{ uri: '180' }])

    mockFetch(() => new Response(JSON.stringify({ error: { message: '(#10) Application does not have permission for this action', code: 10 } }), { status: 403 }))
    await expect(new InstagramPublishingDriver().metrics(identity, ['180'])).rejects.toBeInstanceOf(InstagramApiError)
  })
})

describe('LinkedIn', () => {
  const page = { handle: 'acme', did: 'urn:li:organization:5', accessToken: 'AT' }

  it('asks Social Metadata for 20 posts at a time and adds up every kind of reaction', async () => {
    const uris = Array.from({ length: 21 }, (_, i) => `urn:li:share:${i}`)
    const sent = mockFetch((url) => {
      const asked = decodeURIComponent(url.slice(url.indexOf('List(') + 5, url.lastIndexOf(')'))).split(',')
      return {
        results: Object.fromEntries(asked.filter(urn => urn !== 'urn:li:share:3').map(urn => [urn, {
          reactionSummaries: { LIKE: { reactionType: 'LIKE', count: 4 }, PRAISE: { reactionType: 'PRAISE', count: 2 }, EMPATHY: { reactionType: 'EMPATHY', count: 1 } },
          commentSummary: { count: 5, topLevelCount: 3 },
        }])),
        statuses: {},
        errors: { 'urn:li:share:3': { status: 404 } },
      }
    })
    const metrics = await new LinkedInPublishingDriver().metrics(page, uris)
    expect(sent).toHaveLength(2)
    expect(sent[0]!.url).toStartWith('https://api.linkedin.com/rest/socialMetadata?ids=List(urn%3Ali%3Ashare%3A0,urn%3Ali%3Ashare%3A1,')
    expect(sent[0]!.headers.get('x-restli-protocol-version')).toBe('2.0.0')
    expect(sent[0]!.headers.get('linkedin-version')).toBeTruthy()
    expect(metrics).toHaveLength(20)
    expect(metrics[0]).toEqual({ uri: 'urn:li:share:0', likes: 7, replies: 5 })
    expect(metrics.some(entry => entry.uri === 'urn:li:share:3')).toBe(false)
  })

  it('names the permission a company Page or a member needs when LinkedIn refuses', async () => {
    mockFetch(() => new Response(JSON.stringify({ message: 'Not enough permissions to access: socialMetadata.BATCH_GET', status: 403 }), { status: 403 }))
    const refused = new LinkedInPublishingDriver().metrics(page, ['urn:li:share:1'])
    await expect(refused).rejects.toBeInstanceOf(LinkedInApiError)
    await expect(refused).rejects.toThrow('r_organization_social_feed')
    await expect(new LinkedInPublishingDriver().metrics({ handle: 'glenn', did: 'urn:li:person:abc', accessToken: 'AT' }, ['urn:li:share:1'])).rejects.toThrow('r_member_social_feed')
  })
})
