import { afterEach, describe, expect, test } from 'bun:test'
import {
  BlueskyPublishingDriver,
  LinkedInApiError,
  LinkedInPublishingDriver,
  MastodonPublishingDriver,
  normalizeInstance,
  parseAtUri,
  supportsDeletion,
  supportsEnumeration,
  TwitterApiError,
  TwitterPublishingDriver,
} from '@stacksjs/socials'

/**
 * Deletion is the one capability that cannot be walked back, so every driver
 * that claims it is pinned here: the endpoint it calls, the method, and how it
 * keys the post it is removing.
 */

const realFetch = globalThis.fetch
afterEach(() => { globalThis.fetch = realFetch })

interface Captured { url: string, method: string, body: any }

function mockApi(captured: Captured[], respond: (url: string) => Response): void {
  globalThis.fetch = (async (input: any, init: any = {}) => {
    const url = String(input)
    let body = init.body
    try { body = init.body ? JSON.parse(String(init.body)) : undefined }
    catch { /* form bodies stay as-is */ }
    captured.push({ url, method: init.method || 'GET', body })
    return respond(url)
  }) as typeof fetch
}

const bluesky = { handle: 'tester.bsky.social', did: 'did:plc:test', accessToken: 'jwt' }
const mastodon = { handle: '@glenn@mastodon.social', did: 'https://mastodon.social', accessToken: 'tok' }
const twitter = { handle: 'glenn', did: '77', accessToken: 'AT' }
const linkedin = { handle: 'Chris', did: 'urn:li:person:abc', accessToken: 'AT' }

describe('capability detection', () => {
  test('reports what each driver can actually do', () => {
    // Publishing and deleting are independent: every driver here deletes, but
    // LinkedIn needs a partner permission before it will enumerate.
    for (const driver of [
      new BlueskyPublishingDriver(),
      new TwitterPublishingDriver(),
      new MastodonPublishingDriver(),
      new LinkedInPublishingDriver(),
    ]) {
      expect(supportsDeletion(driver)).toBe(true)
      expect(supportsEnumeration(driver)).toBe(true)
    }
  })

  test('a publish-only driver is not mistaken for a deleting one', () => {
    expect(supportsDeletion({ provider: 'instagram', publish: () => {} })).toBe(false)
    expect(supportsEnumeration({ deletePost: () => {} })).toBe(false)
  })
})

describe('parseAtUri', () => {
  test('splits an AT-URI into the parts a delete needs', () => {
    expect(parseAtUri('at://did:plc:test/app.bsky.feed.post/abc')).toEqual({
      repo: 'did:plc:test',
      collection: 'app.bsky.feed.post',
      rkey: 'abc',
    })
  })

  test('rejects anything that is not a post URI', () => {
    expect(() => parseAtUri('https://bsky.app/profile/x/post/y')).toThrow(/not a Bluesky post URI/)
  })
})

describe('BlueskyPublishingDriver deletion', () => {
  test('deletes by repo, collection and record key', async () => {
    const cap: Captured[] = []
    mockApi(cap, () => new Response('{}', { status: 200 }))

    await new BlueskyPublishingDriver().deletePost(bluesky, { uri: 'at://did:plc:test/app.bsky.feed.post/abc' })

    expect(cap[0]?.url).toContain('com.atproto.repo.deleteRecord')
    expect(cap[0]?.method).toBe('POST')
    expect(cap[0]?.body).toEqual({ repo: 'did:plc:test', collection: 'app.bsky.feed.post', rkey: 'abc' })
  })

  test('lists the account\'s own records with a cursor', async () => {
    const cap: Captured[] = []
    mockApi(cap, () => new Response(JSON.stringify({
      cursor: 'next',
      records: [{ uri: 'at://did:plc:test/app.bsky.feed.post/one', cid: 'cid1', value: { text: 'hello' } }],
    }), { status: 200 }))

    const page = await new BlueskyPublishingDriver().listAuthoredPosts(bluesky)

    expect(cap[0]?.url).toContain('com.atproto.repo.listRecords')
    expect(cap[0]?.url).toContain('collection=app.bsky.feed.post')
    expect(page.cursor).toBe('next')
    expect(page.posts[0]).toMatchObject({ uri: 'at://did:plc:test/app.bsky.feed.post/one', text: 'hello' })
  })

  test('refuses without an access token', async () => {
    await expect(new BlueskyPublishingDriver().deletePost({ handle: 'x' }, { uri: 'at://a/b/c' }))
      .rejects.toThrow(/access token/i)
  })
})

describe('TwitterPublishingDriver deletion', () => {
  test('deletes a tweet by id', async () => {
    const cap: Captured[] = []
    mockApi(cap, () => new Response(JSON.stringify({ data: { deleted: true } }), { status: 200 }))

    await new TwitterPublishingDriver().deletePost(twitter, { uri: '111' })

    expect(cap[0]?.url).toEndWith('/2/tweets/111')
    expect(cap[0]?.method).toBe('DELETE')
  })

  test('treats "deleted: false" as a failure rather than success', async () => {
    mockApi([], () => new Response(JSON.stringify({ data: { deleted: false } }), { status: 200 }))
    await expect(new TwitterPublishingDriver().deletePost(twitter, { uri: '111' })).rejects.toThrow(TwitterApiError)
  })

  test('pages through authored tweets', async () => {
    const cap: Captured[] = []
    mockApi(cap, () => new Response(JSON.stringify({
      data: [{ id: '111', text: 'first' }],
      meta: { next_token: 'page2' },
    }), { status: 200 }))

    const page = await new TwitterPublishingDriver().listAuthoredPosts(twitter, { cursor: 'page1' })

    expect(cap[0]?.url).toContain('/2/users/77/tweets')
    expect(cap[0]?.url).toContain('pagination_token=page1')
    expect(page.cursor).toBe('page2')
  })
})

describe('MastodonPublishingDriver deletion', () => {
  test('normalizes instance URLs', () => {
    expect(normalizeInstance('mastodon.social')).toBe('https://mastodon.social')
    expect(normalizeInstance('https://hachyderm.io/home')).toBe('https://hachyderm.io')
    expect(() => normalizeInstance('')).toThrow(/required/i)
  })

  test('deletes by status id', async () => {
    const cap: Captured[] = []
    mockApi(cap, () => new Response('{}', { status: 200 }))

    await new MastodonPublishingDriver().deletePost(mastodon, { uri: '900', cid: '900' })

    expect(cap[0]?.url).toEndWith('/api/v1/statuses/900')
    expect(cap[0]?.method).toBe('DELETE')
  })

  test('falls back to the id in a stored status URL', async () => {
    const cap: Captured[] = []
    mockApi(cap, () => new Response('{}', { status: 200 }))

    // Callers that recorded the public URL rather than the id still delete.
    await new MastodonPublishingDriver().deletePost(mastodon, { uri: 'https://mastodon.social/@glenn/12345' })

    expect(cap[0]?.url).toEndWith('/api/v1/statuses/12345')
  })

  test('excludes boosts and cursors on the oldest id', async () => {
    const cap: Captured[] = []
    mockApi(cap, (url) => {
      if (url.includes('verify_credentials'))
        return new Response(JSON.stringify({ id: '42', username: 'glenn', url: 'https://mastodon.social/@glenn' }), { status: 200 })
      return new Response(JSON.stringify([{ id: '900' }, { id: '800' }]), { status: 200 })
    })

    const page = await new MastodonPublishingDriver().listAuthoredPosts(mastodon)

    expect(cap[1]?.url).toContain('/api/v1/accounts/42/statuses')
    expect(cap[1]?.url).toContain('exclude_reblogs=true')
    expect(page.cursor).toBe('800')
  })
})

describe('LinkedInPublishingDriver deletion', () => {
  test('deletes by URN', async () => {
    const cap: Captured[] = []
    mockApi(cap, () => new Response('', { status: 204 }))

    await new LinkedInPublishingDriver().deletePost(linkedin, { uri: 'urn:li:ugcPost:123' })

    expect(cap[0]?.url).toEndWith('/rest/posts/urn%3Ali%3AugcPost%3A123')
    expect(cap[0]?.method).toBe('DELETE')
  })

  test('treats an already-deleted post as success', async () => {
    mockApi([], () => new Response('gone', { status: 404 }))
    await expect(new LinkedInPublishingDriver().deletePost(linkedin, { uri: 'urn:li:share:9' }))
      .resolves.toBeUndefined()
  })

  test('names the missing permission when enumeration is refused', async () => {
    mockApi([], () => new Response('{}', { status: 403 }))
    await expect(new LinkedInPublishingDriver().listAuthoredPosts(linkedin))
      .rejects.toThrow(/r_member_social/)
  })

  test('surfaces a real failure', async () => {
    mockApi([], () => new Response('nope', { status: 500 }))
    await expect(new LinkedInPublishingDriver().deletePost(linkedin, { uri: 'urn:li:share:9' }))
      .rejects.toThrow(LinkedInApiError)
  })
})
