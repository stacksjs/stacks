import { afterEach, describe, expect, it } from 'bun:test'
import { createHash } from 'node:crypto'
import { blueskyRecordKey, BlueskyPublishingDriver, detectFacetCandidates, resolveBlueskyService } from '../src/drivers/bluesky'
import { InstagramPublishingDriver } from '../src/drivers/instagram'
import {
  escapeLinkedInText,
  LINKEDIN_API_VERSION,
  LinkedInPublishingDriver,
  linkedInVersionSunset,
  resolveLinkedInVersion,
} from '../src/drivers/linkedin'
import { MastodonPublishingDriver } from '../src/drivers/mastodon'
import { ThreadsPublishingDriver } from '../src/drivers/threads'
import { TwitterPublishingDriver } from '../src/drivers/twitter'
import { fetchPostImage, PostImageError, resolvePostImage, sniffImageType } from '../src/media'

/**
 * What each publishing driver sends, asserted on the requests themselves.
 *
 * These were fixed first in an application as subclasses of these drivers:
 * X attached one image and no alt text, Threads posted every thread segment
 * on its own, Instagram and LinkedIn sent one image, Bluesky's link cards had
 * no picture, Mastodon reposted on a retry. The fixes belong here.
 */

const realFetch = globalThis.fetch
afterEach(() => {
  globalThis.fetch = realFetch
})

interface Sent {
  url: string
  method: string
  headers: Headers
  body: unknown
  redirect?: RequestRedirect
}

/** Record every request; answer each with whatever `answer` returns for it. */
function mockFetch(answer: (url: string, sent: Sent) => unknown | Response): Sent[] {
  const sent: Sent[] = []
  globalThis.fetch = (async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = String(input)
    const record: Sent = { url, method: init.method || 'GET', headers: new Headers(init.headers), body: init.body, ...(init.redirect && { redirect: init.redirect }) }
    sent.push(record)
    const reply = answer(url, record)
    if (reply instanceof Response) return reply
    return new Response(reply === undefined ? '' : JSON.stringify(reply), { status: 200 })
  }) as typeof fetch
  return sent
}

function form(sent: Sent): Record<string, string> {
  return Object.fromEntries(new URLSearchParams(String(sent.body)))
}

function json(sent: Sent): any {
  return JSON.parse(String(sent.body))
}

const PNG = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0])
const JPEG = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0, 0])
const video = {
  bytes: new Uint8Array([0, 0, 0, 20, 102, 116, 121, 112, 105, 115, 111, 109]),
  mimeType: 'video/mp4' as const,
  altText: 'A quiet harbor',
  aspectRatio: { width: 640, height: 360 },
}

describe('post images', () => {
  it('identifies an image by its bytes', () => {
    expect(sniffImageType(PNG)).toBe('image/png')
    expect(sniffImageType(JPEG)).toBe('image/jpeg')
    expect(sniffImageType(new TextEncoder().encode('<html>'))).toBeNull()
  })

  it('refuses an address on this machine without sending anything to it', async () => {
    const sent = mockFetch(() => PNG)
    expect(await fetchPostImage('http://127.0.0.1:5432/x.png')).toBeNull()
    expect(await fetchPostImage('http://169.254.169.254/latest/meta-data')).toBeNull()
    expect(sent).toHaveLength(0)
  })

  it('fails the post for an address that gives no image, rather than posting without it', async () => {
    await expect(resolvePostImage({ url: 'https://example.com/gone.png' }, async () => null)).rejects.toBeInstanceOf(PostImageError)
    expect(await resolvePostImage({ bytes: PNG }, async () => null)).toEqual({ bytes: PNG, mimeType: 'image/png' })
    expect(await resolvePostImage({}, async () => null)).toBeUndefined()
  })
})

describe('publishing video', () => {
  const mastodonIdentity = { handle: 'glenn', did: 'https://social.example', accessToken: 'AT' }
  const blueskyIdentity = { handle: 'glenn.example', did: 'did:plc:glenn', accessToken: 'SESSION' }
  const job = { did: blueskyIdentity.did, jobId: 'video-job', state: 'JOB_STATE_CREATED' }
  const blob = { $type: 'blob', ref: { $link: 'bafkreivideo' }, mimeType: 'video/mp4', size: 4096 }

  it('publishes Mastodon video only after the instance has finished processing', async () => {
    let statusChecks = 0
    const sent = mockFetch((url) => {
      const path = new URL(url).pathname
      if (path === '/api/v2/instance') return { configuration: { media_attachments: { video_size_limit: 20, supported_mime_types: ['video/mp4'] } } }
      if (path === '/api/v2/media') return Response.json({ id: '42', url: null }, { status: 202 })
      if (path === '/api/v1/media/42') {
        statusChecks++
        if (statusChecks === 1) return new Response(null, { status: 206 })
        return { id: '42', type: 'video', url: 'https://media.example/video.mp4' }
      }
      if (path === '/api/v1/statuses') return { id: '99' }
      throw new Error(`Unexpected request ${url}`)
    })
    const driver = new MastodonPublishingDriver()
    await expect(driver.publish(mastodonIdentity, { text: 'Harbor', video }, { idempotencyKey: 'harbor-1' })).resolves.toMatchObject({ uri: '99' })
    expect(sent.map(request => new URL(request.url).pathname)).toEqual(['/api/v2/instance', '/api/v2/media', '/api/v1/media/42', '/api/v1/media/42', '/api/v1/statuses'])
    for (const request of sent.slice(1, 4)) {
      expect(request.headers.get('authorization')).toBe('Bearer AT')
      expect(request.redirect).toBe('error')
    }
    const fields = sent[1]!.body as FormData
    expect(fields.get('description')).toBe('A quiet harbor')
    const file = fields.get('file') as File
    expect(file.name).toBe('upload.mp4')
    expect(file.type).toBe('video/mp4')
    expect(new Uint8Array(await file.arrayBuffer())).toEqual(video.bytes)
    expect(sent.at(-1)!.headers.get('idempotency-key')).toBe('harbor-1')
    expect(json(sent.at(-1)!)).toEqual({ status: 'Harbor', visibility: 'public', media_ids: ['42'] })
  })

  it('keeps Mastodon video failures and incompatible attachments from publishing', async () => {
    const sent = mockFetch((url) => {
      const path = new URL(url).pathname
      if (path === '/api/v2/instance') return { configuration: { media_attachments: { video_size_limit: 12 } } }
      if (path === '/api/v2/media') return Response.json({ id: '42', url: null }, { status: 202 })
      if (path === '/api/v1/media/42') return Response.json({ error: 'Video encoding failed' }, { status: 422 })
      throw new Error(`Unexpected request ${url}`)
    })
    const driver = new MastodonPublishingDriver()
    await expect(driver.publish(mastodonIdentity, { text: 'Harbor', video, media: [{ bytes: PNG }] })).rejects.toThrow('together with images')
    await expect(driver.publish(mastodonIdentity, { text: 'Harbor', video: { ...video, bytes: new Uint8Array(13) } })).rejects.toThrow('12-byte limit')
    expect(sent).toHaveLength(1)
    await expect(driver.publish(mastodonIdentity, { text: 'Harbor', video })).rejects.toThrow('Video encoding failed')
    expect(sent).toHaveLength(3)
  })

  function blueskyApi(upload: Response, processing: unknown): Sent[] {
    return mockFetch((url) => {
      const path = new URL(url).pathname
      if (path.endsWith('.getSession')) {
        return {
          did: blueskyIdentity.did, emailConfirmed: true,
          didDoc: { id: blueskyIdentity.did, service: [{ id: '#atproto_pds', type: 'AtprotoPersonalDataServer', serviceEndpoint: 'https://pds.example' }] },
        }
      }
      if (path.endsWith('.getServiceAuth')) return { token: 'UPLOAD' }
      if (path.endsWith('.uploadVideo')) return upload
      if (path.endsWith('.getJobStatus')) return { jobStatus: processing }
      if (path.endsWith('.createRecord')) return { uri: 'at://did:plc:glenn/app.bsky.feed.post/3harbor' }
      throw new Error(`Unexpected request ${url}`)
    })
  }

  it('uploads to Bluesky with a PDS-scoped token and embeds the completed blob', async () => {
    const sent = blueskyApi(Response.json(job), { ...job, state: 'JOB_STATE_COMPLETED', blob })
    await new BlueskyPublishingDriver().publish(blueskyIdentity, { text: 'Harbor', video }, { rkey: '3harbor' })
    expect(sent).toHaveLength(5)
    const tokenUrl = new URL(sent[1]!.url)
    expect(tokenUrl.origin).toBe('https://bsky.social')
    expect(tokenUrl.searchParams.get('aud')).toBe('did:web:pds.example')
    expect(tokenUrl.searchParams.get('lxm')).toBe('com.atproto.repo.uploadBlob')
    expect(tokenUrl.searchParams.get('exp')).toMatch(/^\d+$/)
    expect(sent[1]!.headers.get('authorization')).toBe('Bearer SESSION')

    const upload = sent[2]!
    expect(new URL(upload.url).origin).toBe('https://video.bsky.app')
    expect(new URL(upload.url).searchParams.get('did')).toBe(blueskyIdentity.did)
    expect(upload.headers.get('authorization')).toBe('Bearer UPLOAD')
    expect(upload.headers.get('content-type')).toBe('video/mp4')
    expect(upload.body).toEqual(video.bytes)
    expect(upload.redirect).toBe('error')
    expect(sent[3]!.headers.has('authorization')).toBe(false)
    expect(new URL(sent[3]!.url).searchParams.get('jobId')).toBe(job.jobId)
    expect(sent[4]!.headers.get('authorization')).toBe('Bearer SESSION')
    expect(json(sent[4]!)).toMatchObject({
      rkey: '3harbor',
      record: { embed: { $type: 'app.bsky.embed.video', video: blob, alt: video.altText, aspectRatio: video.aspectRatio } },
    })
  })

  it('reuses a previously processed Bluesky video and refuses a failed processing job', async () => {
    const sent = blueskyApi(Response.json({ ...job, error: 'already_exists', state: 'JOB_STATE_COMPLETED' }, { status: 409 }), { ...job, error: 'already_exists', state: 'JOB_STATE_FAILED', blob })
    const driver = new BlueskyPublishingDriver()
    await driver.publish(blueskyIdentity, { text: 'Harbor', video })
    expect(sent).toHaveLength(5)
    expect(json(sent[4]!).record.embed.video).toEqual(blob)

    const failed = blueskyApi(Response.json(job), { ...job, state: 'JOB_STATE_FAILED', message: 'Video could not be encoded' })
    await expect(driver.publish(blueskyIdentity, { text: 'Harbor', video })).rejects.toThrow('Video could not be encoded')
    expect(failed).toHaveLength(4)
  })

  it('rejects unsupported video without posting text to the requested provider', async () => {
    const sent = mockFetch(() => { throw new Error('Unexpected request') })
    const drivers = [new InstagramPublishingDriver(), new LinkedInPublishingDriver(), new ThreadsPublishingDriver(), new TwitterPublishingDriver()]
    for (const driver of drivers)
      await expect(driver.publish(blueskyIdentity, { text: 'Harbor', video })).rejects.toThrow('Video publishing')
    expect(sent).toEqual([])
  })
})

describe('X', () => {
  const identity = { handle: 'glenn', accessToken: 'AT' }

  function api(): Sent[] {
    let media = 0
    return mockFetch((url) => {
      if (url.endsWith('/2/media/upload')) return { data: { id: `m${++media}` } }
      if (url.endsWith('/2/media/metadata')) return {}
      return { data: { id: 'tweet1' } }
    })
  }

  it('attaches up to four images, each with its alt text', async () => {
    const sent = api()
    const media = Array.from({ length: 5 }, (_, i) => ({ bytes: PNG, mimeType: 'image/png', altText: ` picture ${i + 1} ` }))
    const result = await new TwitterPublishingDriver().publish(identity, { text: 'four of them', media })

    expect(sent.filter(s => s.url.endsWith('/2/media/upload'))).toHaveLength(4)
    const metadata = sent.filter(s => s.url.endsWith('/2/media/metadata')).map(json)
    expect(metadata).toEqual([1, 2, 3, 4].map(i => ({ id: `m${i}`, metadata: { alt_text: { text: `picture ${i}` } } })))
    expect(json(sent.at(-1)!).media).toEqual({ media_ids: ['m1', 'm2', 'm3', 'm4'] })
    expect(result).toEqual({ provider: 'twitter', uri: 'tweet1', cid: 'tweet1', url: 'https://x.com/glenn/status/tweet1' })
  })

  it('still posts when X will not take the alt text, and says so', async () => {
    mockFetch((url) => {
      if (url.endsWith('/2/media/upload')) return { data: { id: 'm1' } }
      if (url.endsWith('/2/media/metadata')) return new Response('{"title":"Forbidden"}', { status: 403 })
      return { data: { id: 'tweet1' } }
    })
    const result = await new TwitterPublishingDriver().publish(identity, { text: 'hi', media: [{ bytes: PNG, altText: 'a cat' }] })
    expect(result.uri).toBe('tweet1')
    expect(result.warnings).toEqual(['X did not take the description for image 1.'])
  })

  it('downloads an image given by address through its image fetcher', async () => {
    const sent = api()
    const driver = new TwitterPublishingDriver()
    const asked: string[] = []
    driver.fetchImage = async (url) => {
      asked.push(url)
      return { bytes: JPEG, mimeType: 'image/jpeg' }
    }
    await driver.publish(identity, { text: 'hi', media: [{ url: 'https://cdn.example/a.jpg' }] })
    expect(asked).toEqual(['https://cdn.example/a.jpg'])
    expect(sent.some(s => s.url === 'https://cdn.example/a.jpg')).toBe(false)
  })

  it('refuses the post when an image address gives nothing', async () => {
    const sent = api()
    const driver = new TwitterPublishingDriver()
    driver.fetchImage = async () => null
    await expect(driver.publish(identity, { text: 'hi', media: [{ url: 'https://cdn.example/a.jpg' }] })).rejects.toBeInstanceOf(PostImageError)
    expect(sent).toHaveLength(0)
  })

  it('measures X\'s weighted length, not UTF-16 units', async () => {
    api()
    const driver = new TwitterPublishingDriver()
    await expect(driver.publish(identity, { text: 'あ'.repeat(150) })).rejects.toThrow('280 characters or fewer')
    await expect(driver.publish(identity, { text: `${'a'.repeat(250)} https://example.com/${'x'.repeat(100)}` })).resolves.toBeDefined()
  })
})

describe('Bluesky', () => {
  const identity = { handle: 'glenn.bsky.social', did: 'did:plc:abc', accessToken: 'AT' }

  function api(upload: () => unknown | Response = () => ({ blob: { ref: 'blob1' } })): Sent[] {
    return mockFetch((url) => {
      if (url.includes('uploadBlob')) return upload()
      if (url.includes('resolveHandle')) return {}
      return { uri: 'at://did:plc:abc/app.bsky.feed.post/3k', cid: 'cid1' }
    })
  }

  const quote = { uri: 'at://did:plc:friend/app.bsky.feed.post/3kquote', cid: 'bafyreiquote' }

  it('resolves a quote by handle through the authenticated account service', async () => {
    const service = 'https://account-pds.example'
    const sent = mockFetch(url => url.includes('resolveHandle') ? { did: 'did:plc:friend' } : {
      posts: [{ ...quote, uri: 'at://did:plc:other/app.bsky.feed.post/3kquote' }, quote],
    })
    const driver = new BlueskyPublishingDriver({ service })
    await expect(driver.resolveQuote(identity, 'https://bsky.app/profile/friend.example/post/3kquote?ref=share')).resolves.toEqual(quote)
    expect(sent.map(item => new URL(item.url).origin)).toEqual([service, service])
    expect(new URL(sent[0]!.url).searchParams.get('handle')).toBe('friend.example')
    expect(sent[0]!.headers.get('authorization')).toBeNull()
    expect(new URL(sent[1]!.url).searchParams.getAll('uris')).toEqual([quote.uri])
    expect(sent[1]!.headers.get('authorization')).toBe('Bearer AT')
  })

  it('declines inaccessible posts and posts whose author disables quoting', async () => {
    const driver = new BlueskyPublishingDriver()
    let disabled = false
    const sent = mockFetch(() => ({ posts: disabled ? [{ ...quote, viewer: { embeddingDisabled: true } }] : [] }))
    await expect(driver.resolveQuote(identity, 'https://bsky.app/profile/did%3Aplc%3Afriend/post/3kquote')).rejects.toThrow('Could not find')
    disabled = true
    await expect(driver.resolveQuote(identity, quote.uri)).rejects.toThrow('disabled quoting')
    await expect(driver.resolveQuote(identity, 'https://example.org/profile/did:plc:friend/post/3kquote')).rejects.toThrow('valid Bluesky post')
    expect(sent).toHaveLength(2)
    expect(sent.every(request => request.url.includes('app.bsky.feed.getPosts'))).toBe(true)
  })

  it('publishes a quote with explicit self-labels and keeps its record key', async () => {
    const sent = api()
    const rkey = blueskyRecordKey()
    await new BlueskyPublishingDriver().publish(identity, { text: 'My comment' }, {
      rkey, quote, selfLabels: ['nudity', 'graphic-media', 'nudity'],
    })
    expect(json(sent.at(-1)!)).toMatchObject({
      rkey,
      record: {
        embed: { $type: 'app.bsky.embed.record', record: quote },
        labels: { $type: 'com.atproto.label.defs#selfLabels', values: [{ val: 'nudity' }, { val: 'graphic-media' }] },
      },
    })
  })

  it('combines a quote with an image or a link card through the native embed', async () => {
    const sent = api()
    const driver = new BlueskyPublishingDriver()
    await driver.publish(identity, { text: 'Picture', media: [{ bytes: PNG, altText: 'An illustration' }] }, { quote })
    await driver.publish(identity, { text: 'Related', external: { uri: 'https://example.org/article', title: 'An article' } }, { quote })
    const records = sent.filter(request => request.url.includes('createRecord')).map(json)
    expect(records.map(result => result.record.embed.$type)).toEqual(['app.bsky.embed.recordWithMedia', 'app.bsky.embed.recordWithMedia'])
    expect(records[0]!.record.embed).toMatchObject({
      record: { $type: 'app.bsky.embed.record', record: quote },
      media: { $type: 'app.bsky.embed.images', images: [{ alt: 'An illustration' }] },
    })
    expect(records[1]!.record.embed.media.$type).toBe('app.bsky.embed.external')
  })

  it('rejects malformed quote references and labels before sending any writes', async () => {
    const sent = api()
    const driver = new BlueskyPublishingDriver()
    await expect(driver.publish(identity, { text: 'Quote', media: [{ bytes: PNG }] }, {
      quote: { ...quote, uri: 'at://friend.example/app.bsky.feed.post/3kquote' },
    })).rejects.toThrow('Resolve the Bluesky post')
    await expect(driver.publish(identity, { text: 'Label' }, { selfLabels: ['bad label'] })).rejects.toThrow('lowercase')
    expect(sent).toHaveLength(0)
  })

  it('lets 300 emoji through: Bluesky counts graphemes', async () => {
    api()
    await expect(new BlueskyPublishingDriver().publish(identity, { text: '🎉'.repeat(300) })).resolves.toBeDefined()
    await expect(new BlueskyPublishingDriver().publish(identity, { text: '🎉'.repeat(301) })).rejects.toThrow('300 characters or fewer')
  })

  it('uploads a link card\'s picture and attaches it', async () => {
    const sent = api()
    await new BlueskyPublishingDriver().publish(identity, {
      text: 'read this',
      langs: ['en', 'de', 'fr', 'es'],
      external: { uri: 'https://example.com', title: 'Example', thumb: { bytes: PNG, mimeType: 'image/png' } },
    })
    const record = json(sent.at(-1)!).record
    expect(record.embed).toEqual({
      $type: 'app.bsky.embed.external',
      external: { uri: 'https://example.com', title: 'Example', description: '', thumb: { ref: 'blob1' } },
    })
    // Bluesky keeps three languages.
    expect(record.langs).toEqual(['en', 'de', 'fr'])
  })

  it('sends the card without its picture when the picture is refused', async () => {
    const sent = api(() => new Response('{"error":"BlobTooLarge"}', { status: 400 }))
    const result = await new BlueskyPublishingDriver().publish(identity, {
      text: 'read this',
      external: { uri: 'https://example.com', title: 'Example', thumb: { bytes: PNG, mimeType: 'image/png' } },
    })
    expect(json(sent.at(-1)!).record.embed.external.thumb).toBeUndefined()
    expect(result.warnings?.length).toBe(1)
  })

  it('does not upload a card picture larger than Bluesky takes', async () => {
    const sent = api()
    await new BlueskyPublishingDriver().publish(identity, {
      text: 'read this',
      external: { uri: 'https://example.com', title: 'Example', thumb: { bytes: new Uint8Array(1_000_001), mimeType: 'image/png' } },
    })
    expect(sent.some(s => s.url.includes('uploadBlob'))).toBe(false)
  })

  it('prefers attached images over a link card', async () => {
    const sent = api()
    await new BlueskyPublishingDriver().publish(identity, {
      text: 'look',
      media: [{ bytes: PNG, mimeType: 'image/png', altText: 'a cat' }],
      external: { uri: 'https://example.com', title: 'Example', thumb: { bytes: PNG, mimeType: 'image/png' } },
    })
    expect(sent.filter(s => s.url.includes('uploadBlob'))).toHaveLength(1)
    expect(json(sent.at(-1)!).record.embed).toEqual({ $type: 'app.bsky.embed.images', images: [{ image: { ref: 'blob1' }, alt: 'a cat' }] })
  })

  // stacksjs/stacks#3376: the card used to be dropped without a word.
  it('says so when images leave the link card out', async () => {
    api()
    const result = await new BlueskyPublishingDriver().publish(identity, {
      text: 'look',
      media: [{ bytes: PNG, mimeType: 'image/png' }],
      external: { uri: 'https://example.com', title: 'Example' },
    })
    expect(result.warnings).toEqual([expect.stringContaining('link card')])
  })

  it('sends the record key it is given, so a retry cannot post twice', async () => {
    const rkey = blueskyRecordKey()
    const sent = api()
    await new BlueskyPublishingDriver().publish(identity, { text: 'once' }, { rkey })
    expect(json(sent.at(-1)!).rkey).toBe(rkey)
  })

  it('answers a retry whose first attempt went through with the post that exists', async () => {
    const rkey = blueskyRecordKey()
    const sent = mockFetch((url) => {
      if (url.includes('createRecord'))
        return new Response('{"error":"InvalidRequest","message":"Record already exists"}', { status: 400 })
      if (url.includes('getRecord'))
        return { uri: `at://did:plc:abc/app.bsky.feed.post/${rkey}`, cid: 'cid-first', value: { text: 'once' } }
      return {}
    })
    const result = await new BlueskyPublishingDriver().publish(identity, { text: 'once' }, { rkey })

    expect(result.uri).toBe(`at://did:plc:abc/app.bsky.feed.post/${rkey}`)
    expect(result.cid).toBe('cid-first')
    const lookup = new URL(sent.find(s => s.url.includes('getRecord'))!.url)
    expect(Object.fromEntries(lookup.searchParams)).toEqual({ repo: 'did:plc:abc', collection: 'app.bsky.feed.post', rkey })
  })

  it('still fails a refused post when nothing went out under its key', async () => {
    mockFetch((url) => {
      if (url.includes('createRecord'))
        return new Response('{"error":"InvalidRequest","message":"Invalid record"}', { status: 400 })
      if (url.includes('getRecord'))
        return new Response('{"error":"RecordNotFound"}', { status: 400 })
      return {}
    })
    await expect(new BlueskyPublishingDriver().publish(identity, { text: 'x' }, { rkey: blueskyRecordKey() })).rejects.toThrow('Invalid record')
  })
})

// stacksjs/stacks#3376: an account on its own PDS cannot sign in at
// bsky.social, and nothing found where it lives.
describe('Bluesky hosting', () => {
  const plcDoc = (endpoint: string) => ({
    id: 'did:plc:self',
    alsoKnownAs: ['at://me.example.org'],
    service: [{ id: '#atproto_pds', type: 'AtprotoPersonalDataServer', serviceEndpoint: endpoint }],
  })
  const session = { did: 'did:plc:self', handle: 'me.example.org', accessJwt: 'AJ', refreshJwt: 'RJ' }

  it('signs a self-hosted account in at its own PDS, and posts there', async () => {
    const sent = mockFetch((url) => {
      const u = new URL(url)
      if (u.host === 'bsky.social' && u.pathname.endsWith('createSession'))
        return new Response('{"error":"AuthenticationRequired","message":"Invalid identifier or password"}', { status: 401 })
      if (u.host === 'bsky.social' && u.pathname.endsWith('resolveHandle')) return { did: 'did:plc:self' }
      if (u.host === 'plc.directory') return plcDoc('https://pds.example.org/')
      if (u.host === 'pds.example.org' && u.pathname.endsWith('createSession')) return session
      if (u.host === 'pds.example.org' && u.pathname.endsWith('createRecord')) return { uri: 'at://did:plc:self/app.bsky.feed.post/3k', cid: 'c' }
      return {}
    })
    const driver = new BlueskyPublishingDriver()
    const signedIn = await driver.createSession({ identifier: 'me.example.org', password: 'app-pass' })

    expect(signedIn).toMatchObject({ did: 'did:plc:self', accessJwt: 'AJ', service: 'https://pds.example.org' })
    expect(new URL(sent.find(s => s.url.includes('plc.directory'))!.url).pathname).toBe('/did:plc:self')
    await driver.publish({ handle: 'me.example.org', did: 'did:plc:self', accessToken: 'AJ' }, { text: 'hello' })
    expect(new URL(sent.at(-1)!.url).host).toBe('pds.example.org')
    // The password went to bsky.social first, which refused it, and then to the account's own PDS.
    expect(sent.filter(s => s.url.endsWith('createSession')).map(s => new URL(s.url).host)).toEqual(['bsky.social', 'pds.example.org'])
  })

  it('keeps an account Bluesky hosts on bsky.social, with no lookup', async () => {
    const sent = mockFetch((url) => url.endsWith('createSession') ? session : {})
    const signedIn = await new BlueskyPublishingDriver().createSession({ identifier: 'me.bsky.social', password: 'p' })
    expect(signedIn.service).toBe('https://bsky.social')
    expect(sent.map(s => new URL(s.url).pathname)).toEqual(['/xrpc/com.atproto.server.createSession', '/xrpc/app.bsky.actor.getProfile'])
  })

  it('does not look anywhere else when a PDS is configured', async () => {
    const sent = mockFetch(() => new Response('{"error":"AuthenticationRequired"}', { status: 401 }))
    await expect(new BlueskyPublishingDriver({ service: 'https://pds.mine' }).createSession({ identifier: 'me.example.org', password: 'p' })).rejects.toThrow('401')
    expect(sent).toHaveLength(1)
  })

  it('passes same-server XRPC requests through the configured transport with redirects disabled', async () => {
    const requests: Array<{ origin: string, redirect?: RequestRedirect }> = []
    const driver = new BlueskyPublishingDriver({
      service: 'https://pds.example.org',
      fetcher: async (url, init) => {
        requests.push({ origin: url.origin, redirect: init.redirect })
        return Response.json(url.pathname.endsWith('createSession') ? session : {})
      },
    })
    await driver.createSession({ identifier: 'me.example.org', password: 'test-password' })
    expect(requests).toEqual([
      { origin: 'https://pds.example.org', redirect: 'error' },
      { origin: 'https://pds.example.org', redirect: 'error' },
    ])
  })

  it('reports the refusal when the account\'s own PDS refuses the password too', async () => {
    const sent = mockFetch((url) => {
      if (url.endsWith('createSession')) return new Response('{"error":"AuthenticationRequired","message":"Invalid identifier or password"}', { status: 401 })
      if (url.includes('resolveHandle')) return { did: 'did:plc:self' }
      return plcDoc('https://pds.example.org')
    })
    await expect(new BlueskyPublishingDriver().createSession({ identifier: 'me.example.org', password: 'wrong' })).rejects.toThrow('Invalid identifier or password')
    expect(sent.filter(s => s.url.endsWith('createSession'))).toHaveLength(2)
  })
})

describe('resolveBlueskyService', () => {
  const doc = (endpoint: string, id = '#atproto_pds', did = 'did:plc:x') => ({
    id: did,
    service: [{ id, type: 'AtprotoPersonalDataServer', serviceEndpoint: endpoint }],
  })

  it('reads a did:web document from its own host', async () => {
    const asked: string[] = []
    const found = await resolveBlueskyService('did:web:me.example.org', { fetchJson: async (url) => { asked.push(url); return doc('https://pds.example.org', '#atproto_pds', 'did:web:me.example.org') } })
    expect(asked).toEqual(['https://me.example.org/.well-known/did.json'])
    expect(found).toBe('https://pds.example.org')
  })

  it('takes only an https PDS, and only a document that names one', async () => {
    expect(await resolveBlueskyService('did:plc:x', { fetchJson: async () => doc('http://pds.example.org') })).toBeUndefined()
    expect(await resolveBlueskyService('did:plc:x', { fetchJson: async () => ({ service: [] }) })).toBeUndefined()
    expect(await resolveBlueskyService('did:plc:x', { fetchJson: async () => { throw new Error('offline') } })).toBeUndefined()
  })

  it('requires the DID and handle to agree before returning a service', async () => {
    const fetchJson = async (url: string, did: string, handle: string) => url.includes('resolveHandle')
      ? { did: 'did:plc:x' }
      : { ...doc('https://pds.example.org', '#atproto_pds', did), alsoKnownAs: [`at://${handle}`] }
    const resolveWith = (did: string, handle: string) => resolveBlueskyService('me.example.org', { fetchJson: url => fetchJson(url, did, handle) })
    expect(await resolveWith('did:plc:x', 'me.example.org')).toBe('https://pds.example.org')
    expect(await resolveWith('did:plc:y', 'me.example.org')).toBeUndefined()
    expect(await resolveWith('did:plc:x', 'other.example.org')).toBeUndefined()
  })
})

describe('Bluesky record keys', () => {
  it('are TIDs: 13 sortable base32 characters, later keys sorting later', () => {
    const first = blueskyRecordKey(1_764_000_000_000, 0)
    const later = blueskyRecordKey(1_764_000_000_001, 0)
    expect(first).toMatch(/^[234567abcdefghij][234567abcdefghijklmnopqrstuvwxyz]{12}$/)
    expect(later > first).toBe(true)
    expect(blueskyRecordKey()).not.toBe(blueskyRecordKey())
  })
})

// stacksjs/stacks#3376: tags were ASCII only, so #café stopped at the é and
// #日本 was no tag at all.
describe('Bluesky hashtags', () => {
  const tags = (text: string) => detectFacetCandidates(text).filter(c => c.type === 'tag').map(c => c.value)

  it('takes letters from any script', () => {
    expect(tags('#café and #日本 and #Ünïcode')).toEqual(['café', '日本', 'Ünïcode'])
  })

  it('takes the full-width hash sign', () => {
    expect(tags('＃東京')).toEqual(['東京'])
  })

  it('leaves trailing punctuation out, and skips a number or a bare hash', () => {
    expect(tags('#launch! #2024 # nothing #v2.')).toEqual(['launch', 'v2'])
  })

  it('measures its range in UTF-8 bytes', () => {
    const [tag] = detectFacetCandidates('hi #café')
    expect(tag).toMatchObject({ type: 'tag', byteStart: 3, byteEnd: 3 + new TextEncoder().encode('#café').length })
  })

  it('skips a tag longer than 64 characters', () => {
    expect(tags(`#${'a'.repeat(65)}`)).toEqual([])
    expect(tags(`#${'a'.repeat(64)}`)).toEqual(['a'.repeat(64)])
  })
})

describe('Mastodon', () => {
  const identity = { handle: 'glenn', did: 'https://social.example', accessToken: 'AT' }

  function api(instance: unknown | Response = { configuration: { statuses: { max_characters: 1000, characters_reserved_per_url: 23, max_media_attachments: 6 } } }): Sent[] {
    let media = 0
    return mockFetch((url) => {
      if (url.endsWith('/api/v2/instance')) return instance
      if (url.endsWith('/api/v2/media')) return { id: `m${++media}` }
      return { id: 's1', url: 'https://social.example/@glenn/s1' }
    })
  }

  const polls = { max_options: 3, max_characters_per_option: 3, min_expiration: 600, max_expiration: 7200 }

  it('publishes native poll data with the connected instance’s advertised limits', async () => {
    const sent = api({ configuration: { polls } })
    const driver = new MastodonPublishingDriver()
    expect((await driver.instanceLimits(identity)).poll).toEqual({
      maxOptions: 3, maxCharactersPerOption: 3, minExpiration: 600, maxExpiration: 7200,
    })
    await driver.publish(identity, { text: 'Vote' }, {
      poll: { options: [' 👨‍👩‍👦 ', 'Yes', 'No'], expiresIn: 3600, multiple: true, hideTotals: true },
      idempotencyKey: 'poll-1',
    })
    expect(sent.at(-1)!.headers.get('idempotency-key')).toBe('poll-1')
    expect(json(sent.at(-1)!)).toEqual({
      status: 'Vote', visibility: 'public',
      poll: { options: ['👨‍👩‍👦', 'Yes', 'No'], expires_in: 3600, multiple: true, hide_totals: true },
    })
  })

  it('rejects incompatible or invalid polls before publishing or uploading', async () => {
    const sent = api({ api_versions: { mastodon: 7 }, configuration: { polls } })
    const driver = new MastodonPublishingDriver()
    const poll = { options: ['Yes', 'No'], expiresIn: 3600 }
    await expect(driver.publish(identity, { text: 'Vote', media: [{ bytes: PNG }] }, { poll })).rejects.toThrow('images')
    await expect(driver.publish(identity, { text: 'Vote' }, { poll, quotedStatusId: '45' })).rejects.toThrow('poll or a quoted post')
    await expect(driver.publish(identity, { text: 'Vote' }, { poll: { ...poll, options: ['Yes', 'Yes '] } })).rejects.toThrow('distinct')
    await expect(driver.publish(identity, { text: 'Vote' }, { poll: { ...poll, options: ['Yes', 'Long'] } })).rejects.toThrow('3 characters')
    await expect(driver.publish(identity, { text: 'Vote' }, { poll: { ...poll, expiresIn: 599 } })).rejects.toThrow('600 and 7200')
    expect(sent.every(request => request.method === 'GET')).toBe(true)
  })

  it('resolves a federated quote to the instance-local status ID and sends it', async () => {
    const address = 'https://remote.example/@author/456'
    const sent = mockFetch((url) => {
      if (url.endsWith('/api/v2/instance')) return { api_versions: { mastodon: 7 } }
      if (new URL(url).pathname === '/api/v2/search')
        return { statuses: [{ id: '899', url: 'https://remote.example/@another/457' }, { id: '944', url: address }] }
      return { id: '935', url: 'https://social.example/@glenn/935' }
    })
    const driver = new MastodonPublishingDriver()
    const quotedStatusId = await driver.resolvePostId(identity, address + '#context')
    expect(quotedStatusId).toBe('944')
    const search = sent[0]!
    expect(new URL(search.url).origin).toBe(identity.did)
    expect(Object.fromEntries(new URL(search.url).searchParams)).toEqual({ q: address, type: 'statuses', resolve: 'true', limit: '1' })
    expect(search.headers.get('authorization')).toBe('Bearer AT')
    await driver.publish(identity, { text: 'My comment' }, { quotedStatusId })
    expect(json(sent.at(-1)!)).toMatchObject({ status: 'My comment', quoted_status_id: '944' })
  })

  it('declines a quote on older instances and polls when capabilities are unavailable', async () => {
    const sent = api({ api_versions: { mastodon: 6 } })
    const driver = new MastodonPublishingDriver()
    await expect(driver.publish(identity, { text: 'Quote' }, { quotedStatusId: '45' })).rejects.toThrow('does not advertise quote posts')
    await expect(driver.publish(identity, { text: 'Vote' }, { poll: { options: ['Yes', 'No'], expiresIn: 600 } })).rejects.toThrow('did not report')
    expect(sent.every(request => request.method === 'GET')).toBe(true)
  })

  it('sends an idempotency key, visibility, a content warning and a language', async () => {
    const sent = api()
    const result = await new MastodonPublishingDriver().publish(identity, { text: 'hello', langs: ['de'] }, {
      idempotencyKey: 'post-1-a',
      visibility: 'unlisted',
      spoilerText: ' spoilers ',
    })
    const status = sent.at(-1)!
    expect(status.headers.get('idempotency-key')).toBe('post-1-a')
    expect(json(status)).toEqual({ status: 'hello', visibility: 'unlisted', spoiler_text: 'spoilers', language: 'de' })
    expect(result).toEqual({ provider: 'mastodon', uri: 's1', cid: 's1', url: 'https://social.example/@glenn/s1' })
  })

  it('goes by the instance\'s own character and attachment limits', async () => {
    const sent = api()
    const driver = new MastodonPublishingDriver()
    await expect(driver.publish(identity, { text: 'x'.repeat(900) })).resolves.toBeDefined()
    await expect(driver.publish(identity, { text: 'x'.repeat(1001) })).rejects.toThrow('1000 characters or fewer')

    const media = Array.from({ length: 8 }, (_, i) => ({ bytes: PNG, altText: `picture ${i}` }))
    await driver.publish(identity, { text: 'pictures', media })
    expect(json(sent.at(-1)!).media_ids).toHaveLength(6)
    // Asked once, then remembered.
    expect(sent.filter(s => s.url.endsWith('/api/v2/instance'))).toHaveLength(1)
  })

  it('falls back to Mastodon\'s defaults when the instance will not say', async () => {
    api(new Response('not found', { status: 404 }))
    const driver = new MastodonPublishingDriver()
    expect(await driver.instanceLimits(identity)).toEqual({ characters: 500, charactersPerUrl: 23, mediaAttachments: 4 })
    await expect(driver.publish(identity, { text: 'x'.repeat(501) })).rejects.toThrow('500 characters or fewer')
  })

  it('sends each image\'s alt text with its upload', async () => {
    const sent = api()
    await new MastodonPublishingDriver().publish(identity, { text: 'a cat', media: [{ bytes: PNG, mimeType: 'image/png', altText: ' a cat ' }] })
    const upload = sent.find(s => s.url.endsWith('/api/v2/media'))!
    expect((upload.body as FormData).get('description')).toBe('a cat')
  })
})

describe('Threads', () => {
  const identity = { handle: 'glenn', did: '42', accessToken: 'AT' }

  function api(): Sent[] {
    let container = 0
    return mockFetch((url) => {
      if (url.endsWith('/threads_publish')) return { id: 'post9' }
      if (url.includes('fields=permalink')) return { permalink: 'https://threads.net/@glenn/post/9' }
      if (url.endsWith('/threads')) return { id: `c${++container}` }
      return { access_token: 'LONG', expires_in: 5184000 }
    })
  }

  it('replies to the segment above and returns the id as the cid, so a thread chains', async () => {
    const sent = api()
    const result = await new ThreadsPublishingDriver().publish(identity, {
      text: 'part two',
      reply: { root: { uri: 'post1', cid: 'post1' }, parent: { uri: 'post8', cid: 'post8' } },
    })
    expect(form(sent[0]!)).toEqual({ media_type: 'TEXT', text: 'part two', reply_to_id: 'post8' })
    expect(result).toEqual({ provider: 'threads', uri: 'post9', cid: 'post9', url: 'https://threads.net/@glenn/post/9' })
  })

  it('sends two or more images as a carousel, each with its alt text', async () => {
    const sent = api()
    await new ThreadsPublishingDriver().publish(identity, {
      text: 'two',
      media: [{ url: 'https://cdn.example/1.png', altText: 'one' }, { url: 'https://cdn.example/2.png' }],
    })
    const containers = sent.filter(s => s.url.endsWith('/threads')).map(form)
    expect(containers).toEqual([
      { media_type: 'IMAGE', image_url: 'https://cdn.example/1.png', alt_text: 'one', is_carousel_item: 'true' },
      { media_type: 'IMAGE', image_url: 'https://cdn.example/2.png', is_carousel_item: 'true' },
      { media_type: 'CAROUSEL', children: 'c1,c2', text: 'two' },
    ])
    expect(form(sent.find(s => s.url.endsWith('/threads_publish'))!)).toEqual({ creation_id: 'c3' })
  })

  it('refuses an image without an address rather than dropping it', async () => {
    const sent = api()
    await expect(new ThreadsPublishingDriver().publish(identity, { text: 'x', media: [{ bytes: PNG }] })).rejects.toThrow('public address')
    expect(sent).toHaveLength(0)
  })

  it('counts graphemes', async () => {
    api()
    await expect(new ThreadsPublishingDriver().publish(identity, { text: '🎉'.repeat(500) })).resolves.toBeDefined()
  })

  it('exchanges and refreshes a long-lived token with the token in the body, not the URL', async () => {
    const sent = api()
    const driver = new ThreadsPublishingDriver()
    expect(await driver.exchangeLongLivedToken('secret', 'SHORT')).toEqual({ accessToken: 'LONG', expiresIn: 5184000 })
    expect(await driver.refreshLongLivedToken('LONG')).toEqual({ accessToken: 'LONG', expiresIn: 5184000 })

    expect(sent.map(s => [s.method, s.url])).toEqual([
      ['POST', 'https://graph.threads.net/access_token'],
      ['POST', 'https://graph.threads.net/refresh_access_token'],
    ])
    expect(form(sent[0]!)).toEqual({ grant_type: 'th_exchange_token', client_secret: 'secret', access_token: 'SHORT' })
    expect(form(sent[1]!)).toEqual({ grant_type: 'th_refresh_token', access_token: 'LONG' })
  })
})

describe('Instagram', () => {
  const identity = { handle: 'glenn', did: '1784', accessToken: 'AT' }

  it('comments on published media with the authorized User token in a header', async () => {
    const sent = mockFetch(() => ({ id: '17870913679156914' }))
    const text = 'Link & details: https://example.org/?n=1+x #release'
    const comment = await new InstagramPublishingDriver({ graphVersion: 'v27.0' }).createComment(
      { ...identity, accessToken: 'USER_AT' }, '17895695668004550', text,
    )
    expect(comment).toBe('17870913679156914')
    expect(sent).toHaveLength(1)
    const request = sent[0]!
    const url = new URL(request.url)
    expect(url.origin).toBe('https://graph.facebook.com')
    expect(url.pathname).toBe('/v27.0/17895695668004550/comments')
    expect([...url.searchParams]).toEqual([['message', text]])
    expect(request.method).toBe('POST')
    expect(request.redirect).toBe('error')
    expect(request.headers.get('authorization')).toBe('Bearer USER_AT')
  })

  it('refuses invalid media IDs and empty comments before a request', async () => {
    const sent = mockFetch(() => undefined)
    const driver = new InstagramPublishingDriver()
    await expect(driver.createComment(identity, '42/media_publish', 'Hello')).rejects.toThrow('published media ID')
    await expect(driver.createComment(identity, '42', ' ')).rejects.toThrow('comment text')
    await expect(driver.createComment({ ...identity, accessToken: '' }, '42', 'Hello')).rejects.toThrow('access token')
    expect(sent).toHaveLength(0)
  })

  it('reports the Graph comment response and keeps failed writes separate from publish', async () => {
    const sent = mockFetch(() => new Response(JSON.stringify({ error: { code: 200, message: 'Comment permission is missing' } }), { status: 403 }))
    await expect(new InstagramPublishingDriver().createComment(identity, '17895695668004550', 'Hello')).rejects.toMatchObject({
      network: 'instagram', status: 403,
    })
    expect(sent).toHaveLength(1)
    expect(new URL(sent[0]!.url).pathname).toEndWith('/comments')
  })

  it('reports acceptance even when Meta supplies no usable comment ID', async () => {
    const sent = mockFetch(() => new Response(null, { status: 204 }))
    expect(await new InstagramPublishingDriver().createComment(identity, '42', 'Hello')).toBeNull()
    expect(sent).toHaveLength(1)
  })

  function api(statuses: string[] = ['FINISHED']): Sent[] {
    let container = 0
    let polled = 0
    return mockFetch((url) => {
      if (url.endsWith('/media_publish')) return { id: 'ig9' }
      if (url.includes('fields=permalink')) return { permalink: 'https://instagram.com/p/9' }
      if (url.includes('fields=status_code')) {
        const code = statuses[Math.min(polled++, statuses.length - 1)]
        return code === 'ERROR' ? { status_code: code, status: 'Error: 2207026' } : { status_code: code }
      }
      if (url.endsWith('/media')) return { id: `c${++container}` }
      return { access_token: 'LONG', expires_in: 5184000 }
    })
  }

  /** A driver that waits no real time between status checks, and counts them. */
  function driver(): InstagramPublishingDriver & { waited: number[] } {
    const made = new InstagramPublishingDriver() as InstagramPublishingDriver & { waited: number[] }
    made.waited = []
    ;(made as any).sleep = async (ms: number) => { made.waited.push(ms) }
    return made
  }

  it('sends two or more images as a carousel', async () => {
    const sent = api()
    const result = await driver().publish(identity, {
      text: 'caption',
      media: [{ url: 'https://cdn.example/1.png' }, { url: 'https://cdn.example/2.png' }],
    })
    expect(sent.filter(s => s.url.endsWith('/media')).map(form)).toEqual([
      { image_url: 'https://cdn.example/1.png', is_carousel_item: 'true' },
      { image_url: 'https://cdn.example/2.png', is_carousel_item: 'true' },
      { media_type: 'CAROUSEL', children: 'c1,c2', caption: 'caption' },
    ])
    expect(result).toEqual({ provider: 'instagram', uri: 'ig9', url: 'https://instagram.com/p/9' })
  })

  it('refuses an image without an address rather than leaving it out', async () => {
    api()
    await expect(new InstagramPublishingDriver().publish(identity, { text: 'x', media: [{ url: 'https://cdn.example/1.png' }, { bytes: PNG }] }))
      .rejects
      .toThrow('public address')
  })

  it('exchanges a long-lived user token without a secret in the URL', async () => {
    const sent = api()
    expect(await new InstagramPublishingDriver().exchangeLongLivedUserToken('id', 'secret', 'SHORT')).toEqual({ accessToken: 'LONG', expiresIn: 5184000 })
    expect(sent[0]!.method).toBe('POST')
    expect(sent[0]!.url).not.toContain('secret')
    expect(form(sent[0]!)).toEqual({ grant_type: 'fb_exchange_token', client_id: 'id', client_secret: 'secret', fb_exchange_token: 'SHORT' })
  })

  // stacksjs/stacks#3377. The container was published the moment it was
  // created, so an image Instagram had not finished fetching failed the post.
  it('publishes the container only once Instagram has finished it', async () => {
    const sent = api(['IN_PROGRESS', 'IN_PROGRESS', 'FINISHED'])
    const made = driver()
    await made.publish(identity, { text: 'x', media: [{ url: 'https://cdn.example/1.jpg' }] })

    const order = sent.map(s => s.url.includes('status_code') ? 'status' : s.url.endsWith('/media_publish') ? 'publish' : s.url.endsWith('/media') ? 'create' : 'other')
    expect(order.slice(0, 5)).toEqual(['create', 'status', 'status', 'status', 'publish'])
    expect(made.waited).toHaveLength(2)
  })

  it('fails with Instagram\'s own reason when the container errors, and does not publish', async () => {
    const sent = api(['ERROR'])
    await expect(driver().publish(identity, { text: 'x', media: [{ url: 'https://cdn.example/1.jpg' }] })).rejects.toThrow('2207026')
    expect(sent.some(s => s.url.endsWith('/media_publish'))).toBe(false)
  })

  it('gives up on a container still processing after its time, without publishing', async () => {
    const sent = api(['IN_PROGRESS'])
    const made = driver()
    made.containerTimeoutMs = 10_000
    await expect(made.publish(identity, { text: 'x', media: [{ url: 'https://cdn.example/1.jpg' }] })).rejects.toThrow('still processing')
    expect(sent.some(s => s.url.endsWith('/media_publish'))).toBe(false)
    expect(made.waited.reduce((a, b) => a + b, 0)).toBeGreaterThanOrEqual(10_000)
  })

  it('sends each image\'s alt text, on a single image and on carousel items', async () => {
    const sent = api()
    await driver().publish(identity, { text: 'one', media: [{ url: 'https://cdn.example/1.jpg', altText: 'a cat' }] })
    await driver().publish(identity, { text: 'two', media: [{ url: 'https://cdn.example/1.jpg', altText: 'a cat' }, { url: 'https://cdn.example/2.jpg' }] })
    const created = sent.filter(s => s.url.endsWith('/media')).map(form)
    expect(created[0]).toEqual({ image_url: 'https://cdn.example/1.jpg', alt_text: 'a cat', caption: 'one' })
    expect(created[1]).toEqual({ image_url: 'https://cdn.example/1.jpg', is_carousel_item: 'true', alt_text: 'a cat' })
    expect(created[2]).toEqual({ image_url: 'https://cdn.example/2.jpg', is_carousel_item: 'true' })
    // The carousel container itself takes no alt text.
    expect(created[3]).not.toHaveProperty('alt_text')
  })

  it('refuses an image it knows is not a JPEG, the one format Instagram takes', async () => {
    const sent = api()
    await expect(driver().publish(identity, { text: 'x', media: [{ url: 'https://cdn.example/1.png', mimeType: 'image/png' }] })).rejects.toThrow('JPEG')
    expect(sent).toHaveLength(0)
  })

  it('finds the Instagram account on any page of the user\'s Pages, not only the first', async () => {
    const sent = mockFetch((url) => {
      if (url.includes('after=PAGE2'))
        return { data: [{ access_token: 'PAGE_TOKEN', instagram_business_account: { id: '1784', username: 'glenn' } }] }
      return { data: [{ access_token: 'other' }], paging: { next: 'https://graph.facebook.com/v22.0/me/accounts?after=PAGE2' } }
    })
    expect(await new InstagramPublishingDriver().resolveAccount('USER')).toEqual({ igUserId: '1784', username: 'glenn', pageAccessToken: 'PAGE_TOKEN' })
    expect(sent).toHaveLength(2)
    expect(sent[1]!.url).toContain('after=PAGE2')
    expect(sent[1]!.headers.get('authorization')).toBe('Bearer USER')
  })

  it('lists each linked Facebook Page across result pages for the owner to choose', async () => {
    const first = { id: '123', name: 'Studio', access_token: 'STUDIO', instagram_business_account: { id: '1784', username: 'studio' } }
    const second = { id: '456', name: 'Shop', access_token: 'SHOP', instagram_business_account: { id: '1785', username: 'shop' } }
    const sent = mockFetch((url) => {
      if (url.includes('after=PAGE2')) return { data: [first, second] }
      return {
        data: [{ id: 'unlinked', access_token: 'UNLINKED' }, first],
        paging: { next: 'https://graph.facebook.com/v26.0/me/accounts?after=PAGE2&access_token=USER' },
      }
    })
    expect(await new InstagramPublishingDriver().listAccounts('USER')).toEqual([
      { pageId: '123', pageName: 'Studio', igUserId: '1784', username: 'studio', pageAccessToken: 'STUDIO' },
      { pageId: '456', pageName: 'Shop', igUserId: '1785', username: 'shop', pageAccessToken: 'SHOP' },
    ])
    expect(new URL(sent[0]!.url).searchParams.get('fields')).toContain('id,name,')
    expect(sent[1]!.url).not.toContain('access_token')
    expect(sent[1]!.headers.get('authorization')).toBe('Bearer USER')
  })

  it('does not follow a paging address on another host, which would carry the token there', async () => {
    const sent = mockFetch(() => ({ data: [], paging: { next: 'https://evil.example/me/accounts?after=2' } }))
    await expect(new InstagramPublishingDriver().resolveAccount('USER')).rejects.toThrow('another host')
    expect(sent.map(s => new URL(s.url).host)).toEqual(['graph.facebook.com'])
  })
})

describe('Threads deletion (stacksjs/stacks#3377)', () => {
  it('deletes a post with DELETE /{post-id}, the token in a header', async () => {
    const sent = mockFetch(() => ({ success: true }))
    await new ThreadsPublishingDriver().deletePost({ handle: 'glenn', did: '42', accessToken: 'AT' }, { uri: 'post9' })
    expect(sent).toHaveLength(1)
    expect(sent[0]!.method).toBe('DELETE')
    expect(new URL(sent[0]!.url).pathname).toEndWith('/post9')
    expect(sent[0]!.url).not.toContain('AT')
    expect(sent[0]!.headers.get('authorization')).toBe('Bearer AT')
  })

  it('refuses an id that is not a plain post id', async () => {
    mockFetch(() => ({}))
    await expect(new ThreadsPublishingDriver().deletePost({ handle: 'glenn', did: '42', accessToken: 'AT' }, { uri: '42/threads' })).rejects.toThrow()
  })
})

describe('LinkedIn', () => {
  const identity = { handle: 'glenn', did: 'urn:li:person:abc', accessToken: 'AT' }

  it('creates a first comment as the published post’s author or organization', async () => {
    const sent = mockFetch(() => new Response(null, { status: 201, headers: { 'x-restli-id': '6915442672119734272' } }))
    const driver = new LinkedInPublishingDriver()
    const text = 'Release notes (and links) #release.'
    for (const [actor, urn] of [[identity.did, 'urn:li:share:9'], ['urn:li:organization:42', 'urn:li:ugcPost:8']] as const)
      expect(await driver.createComment({ ...identity, did: actor }, urn, text)).toBe('6915442672119734272')

    for (const [index, actor, object] of [
      [0, identity.did, 'urn:li:share:9'], [1, 'urn:li:organization:42', 'urn:li:ugcPost:8'],
    ] as const) {
      const request = sent[index]!
      expect(request.url).toBe(`https://api.linkedin.com/rest/socialActions/${encodeURIComponent(object)}/comments`)
      expect(request.method).toBe('POST')
      expect(request.redirect).toBe('error')
      expect(request.headers.get('authorization')).toBe('Bearer AT')
      expect(request.headers.get('linkedin-version')).toBe(LINKEDIN_API_VERSION)
      expect(request.headers.get('x-restli-protocol-version')).toBe('2.0.0')
      expect(json(request)).toEqual({ actor, object, message: { text } })
    }
  })

  it('refuses the wrong URN, missing actor and empty text before a request', async () => {
    const sent = mockFetch(() => undefined)
    const driver = new LinkedInPublishingDriver()
    await expect(driver.createComment(identity, 'https://www.linkedin.com/feed/update/urn:li:share:9', 'Test')).rejects.toThrow('post URN')
    await expect(driver.createComment({ ...identity, did: undefined }, 'urn:li:share:9', 'Test')).rejects.toThrow('author URN')
    await expect(driver.createComment(identity, 'urn:li:share:9', ' ')).rejects.toThrow('comment text')
    expect(sent).toHaveLength(0)
  })

  it('accepts a body ID and preserves an acknowledged write with a missing ID', async () => {
    const driver = new LinkedInPublishingDriver()
    mockFetch(() => new Response(JSON.stringify({ id: '90071992547409931' }), { status: 201 }))
    expect(await driver.createComment(identity, 'urn:li:share:9', 'First')).toBe('90071992547409931')
    const sent = mockFetch(() => new Response('not a comment record', { status: 201 }))
    expect(await driver.createComment(identity, 'urn:li:share:9', 'Second')).toBeNull()
    expect(sent).toHaveLength(1)
  })

  it('reports comment permission failure without issuing another write', async () => {
    const sent = mockFetch(() => new Response(JSON.stringify({ message: 'Comment permission required' }), { status: 403 }))
    await expect(new LinkedInPublishingDriver().createComment(identity, 'urn:li:share:9', 'Hello')).rejects.toMatchObject({
      network: 'linkedin', status: 403,
    })
    expect(sent).toHaveLength(1)
    expect(sent[0]!.url).toEndWith('/comments')
  })

  function api(): Sent[] {
    let image = 0
    return mockFetch((url) => {
      if (url.includes('initializeUpload')) {
        image++
        return { value: { uploadUrl: `https://upload.example/${image}`, image: `urn:li:image:${image}` } }
      }
      if (url.startsWith('https://upload.example/')) return undefined
      if (url.endsWith('/oauth/v2/accessToken'))
        return { access_token: 'NEW', expires_in: 5183999, refresh_token: 'RT', refresh_token_expires_in: 31535999 }
      return new Response('', { status: 201, headers: { 'x-restli-id': 'urn:li:share:9' } })
    })
  }

  it('sends one image as media and two or more as a multi-image post, each with its alt text', async () => {
    let sent = api()
    await new LinkedInPublishingDriver().publish(identity, { text: 'one', media: [{ bytes: PNG, altText: 'a cat' }] })
    expect(json(sent.at(-1)!).content).toEqual({ media: { id: 'urn:li:image:1', altText: 'a cat' } })

    sent = api()
    const result = await new LinkedInPublishingDriver().publish(identity, {
      text: 'two',
      media: [{ bytes: PNG, altText: 'a cat' }, { bytes: JPEG }],
      external: { uri: 'https://example.com', title: 'Ignored' },
    })
    expect(json(sent.at(-1)!).content).toEqual({ multiImage: { images: [{ id: 'urn:li:image:1', altText: 'a cat' }, { id: 'urn:li:image:2' }] } })
    expect(sent.filter(s => s.method === 'PUT').map(s => s.headers.get('content-type'))).toEqual(['image/png', 'image/jpeg'])
    expect(result).toEqual({ provider: 'linkedin', uri: 'urn:li:share:9', url: 'https://www.linkedin.com/feed/update/urn:li:share:9' })
  })

  it('sends a version LinkedIn has not retired', async () => {
    const sent = api()
    await new LinkedInPublishingDriver({ apiVersion: '202405' }).publish(identity, { text: 'hi' })
    expect(sent.at(-1)!.headers.get('linkedin-version')).toBe(LINKEDIN_API_VERSION)
  })

  it('keeps the refresh token LinkedIn returns, and refreshes with it', async () => {
    const sent = api()
    const driver = new LinkedInPublishingDriver()
    const token = await driver.exchangeCode({ clientId: 'id', clientSecret: 's', redirectUrl: 'https://app/cb', code: 'c' })
    expect(token).toMatchObject({ accessToken: 'NEW', refreshToken: 'RT', refreshTokenExpiresIn: 31535999 })

    await driver.refreshAccessToken({ clientId: 'id', clientSecret: 's', refreshToken: 'RT' })
    expect(form(sent.at(-1)!)).toEqual({ grant_type: 'refresh_token', refresh_token: 'RT', client_id: 'id', client_secret: 's' })
  })

  it('creates a fresh S256 proof and exchanges it for a native LinkedIn token', async () => {
    const sent = api()
    const driver = new LinkedInPublishingDriver()
    const start = { clientId: 'id', redirectUrl: 'http://127.0.0.1:31777/callback', scopes: ['openid', 'w_member_social'], state: 'native-state' }
    const { url, codeVerifier } = await driver.createNativeAuthorization(start)
    const authorization = new URL(url)
    const challenge = createHash('sha256').update(codeVerifier).digest('base64url')
    expect(authorization.origin + authorization.pathname).toBe('https://www.linkedin.com/oauth/native-pkce/authorization')
    expect(Object.fromEntries(authorization.searchParams)).toEqual({
      response_type: 'code', client_id: 'id', redirect_uri: start.redirectUrl, scope: 'openid w_member_social',
      state: 'native-state', code_challenge: challenge, code_challenge_method: 'S256',
    })
    expect(codeVerifier).toMatch(/^[\w~-]{43}$/)
    expect((await driver.createNativeAuthorization(start)).codeVerifier).not.toBe(codeVerifier)

    const token = await driver.exchangeNativeCode({ clientId: start.clientId, redirectUrl: start.redirectUrl, code: 'c', codeVerifier })
    const request = sent.at(-1)!
    expect(token.accessToken).toBe('NEW')
    expect(request.url).toBe('https://www.linkedin.com/oauth/v2/accessToken')
    expect(request.method).toBe('POST')
    expect(request.headers.get('content-type')).toBe('application/x-www-form-urlencoded')
    expect(form(request)).toEqual({ grant_type: 'authorization_code', code: 'c', client_id: 'id', redirect_uri: start.redirectUrl, code_verifier: codeVerifier })
  })

  it('keeps hosted consent on the confidential web authorization path', async () => {
    const sent = api()
    const driver = new LinkedInPublishingDriver()
    const input = { clientId: 'id', redirectUrl: 'https://app.example/callback', scopes: ['openid'], state: 'web-state' }
    const authorization = new URL(driver.getAuthUrl(input))
    expect(authorization.pathname).toBe('/oauth/v2/authorization')
    expect(authorization.searchParams.has('code_challenge')).toBe(false)
    await driver.exchangeCode({ ...input, clientSecret: 'fixture-secret', code: 'c' })
    expect(form(sent.at(-1)!)).toEqual({ grant_type: 'authorization_code', code: 'c', client_id: 'id', redirect_uri: input.redirectUrl, client_secret: 'fixture-secret' })
  })

  it('accepts IPv6 loopback and rejects non-loopback callbacks or an invalid verifier before sending', async () => {
    const sent = api()
    const driver = new LinkedInPublishingDriver()
    const redirectUrl = 'https://[::1]:31777/callback'
    const input = { clientId: 'id', redirectUrl, scopes: ['openid'], state: 'native-state' }
    const authorization = await driver.createNativeAuthorization(input)
    expect(new URL(authorization.url).searchParams.get('redirect_uri')).toBe(redirectUrl)

    for (const outside of [
      'https://remote.example/callback',
      'http://localhost:31777/callback',
      'http://127.0.0.1.remote.example/callback',
      'http://127.1:31777/callback',
      'http://127.0.0.1:0/callback',
      'http://user@127.0.0.1:31777/callback',
      'http://[::1]:31777/callback#fragment',
    ]) {
      await expect(driver.createNativeAuthorization({ ...input, redirectUrl: outside })).rejects.toThrow('loopback')
      await expect(driver.exchangeNativeCode({ clientId: 'id', redirectUrl: outside, code: 'c', codeVerifier: authorization.codeVerifier })).rejects.toThrow('loopback')
    }
    await expect(driver.exchangeNativeCode({ clientId: 'id', redirectUrl, code: 'c', codeVerifier: 'absent-proof' })).rejects.toThrow('verifier')
    await expect(driver.exchangeNativeCode({ clientId: 'id', redirectUrl, code: '', codeVerifier: authorization.codeVerifier })).rejects.toThrow('authorization code')
    expect(sent).toHaveLength(0)
  })
})

// stacksjs/stacks#3373: posting as a company Page. LinkedIn's Posts and
// Images APIs take an organization URN as the author and owner; what was
// missing was finding the Pages a member may post for.
describe('LinkedIn organizations', () => {
  const member = { handle: 'glenn', did: 'urn:li:person:abc', accessToken: 'AT' }
  const company = { handle: 'acme', did: 'urn:li:organization:42', accessToken: 'AT' }

  it('lists the Pages the member may post for, with their names, across pages of results', async () => {
    const sent = mockFetch((url) => {
      const u = new URL(url)
      if (u.pathname === '/rest/organizationAcls' && u.searchParams.get('start') === '0') {
        return {
          elements: [
            { role: 'ADMINISTRATOR', state: 'APPROVED', organizationTarget: 'urn:li:organization:42' },
            { role: 'ANALYST', state: 'APPROVED', organizationTarget: 'urn:li:organization:7' },
          ],
          paging: { start: 0, count: 2, total: 3 },
        }
      }
      if (u.pathname === '/rest/organizationAcls')
        return { elements: [{ role: 'CONTENT_ADMINISTRATOR', state: 'APPROVED', organization: 'urn:li:organization:99' }], paging: { start: 2, count: 2, total: 3 } }
      if (u.pathname === '/rest/organizations/42') return { localizedName: 'Acme' }
      return new Response('{"status":403}', { status: 403 })
    })
    const driver = new LinkedInPublishingDriver() as LinkedInPublishingDriver & { organizationPageSize: number }
    driver.organizationPageSize = 2

    expect(await driver.listOrganizations('AT')).toEqual([
      { urn: 'urn:li:organization:42', id: '42', role: 'ADMINISTRATOR', name: 'Acme' },
      // A name LinkedIn will not give is left out rather than failing the list.
      { urn: 'urn:li:organization:99', id: '99', role: 'CONTENT_ADMINISTRATOR' },
    ])
    const acl = new URL(sent[0]!.url)
    expect(Object.fromEntries(acl.searchParams)).toEqual({ q: 'roleAssignee', state: 'APPROVED', start: '0', count: '2' })
    expect(sent[0]!.headers.get('authorization')).toBe('Bearer AT')
    expect(sent[0]!.headers.get('x-restli-protocol-version')).toBe('2.0.0')
    expect(sent[0]!.headers.get('linkedin-version')).toMatch(/^\d{6}$/)
    // An analyst cannot post, so its Page is not even looked up.
    expect(sent.some(s => s.url.includes('/organizations/7'))).toBe(false)
  })

  it('names the permission it needs when LinkedIn refuses the list', async () => {
    mockFetch(() => new Response('{"status":403}', { status: 403 }))
    await expect(new LinkedInPublishingDriver().listOrganizations('AT')).rejects.toThrow('rw_organization_admin')
  })

  it('publishes as the Page, which owns the images too', async () => {
    const sent = mockFetch((url) => {
      if (url.includes('initializeUpload')) return { value: { uploadUrl: 'https://upload.example/1', image: 'urn:li:image:1' } }
      if (url.startsWith('https://upload.example/')) return undefined
      return new Response('', { status: 201, headers: { 'x-restli-id': 'urn:li:share:9' } })
    })
    await new LinkedInPublishingDriver().publish(company, { text: 'hello', media: [{ bytes: PNG }] })
    expect(json(sent[0]!).initializeUploadRequest.owner).toBe('urn:li:organization:42')
    expect(json(sent.at(-1)!).author).toBe('urn:li:organization:42')
  })

  it('names the organization permission when a Page\'s posts cannot be listed', async () => {
    mockFetch(() => new Response('{"status":403}', { status: 403 }))
    await expect(new LinkedInPublishingDriver().listAuthoredPosts(company)).rejects.toThrow('r_organization_social')
    await expect(new LinkedInPublishingDriver().listAuthoredPosts(member)).rejects.toThrow('r_member_social')
  })
})

describe('LinkedIn text and versions', () => {
  it('keeps hashtags and escapes every other reserved character', () => {
    expect(escapeLinkedInText('Ship it #stacks (today) @team')).toBe('Ship it #stacks \\(today\\) \\@team')
    expect(escapeLinkedInText('issue # 4, #1 and C#')).toBe('issue \\# 4, \\#1 and C\\#')
    expect(escapeLinkedInText('#über')).toBe('#über')
  })

  it('replaces a configured version once LinkedIn has retired it', () => {
    const now = Date.UTC(2026, 10, 23)
    expect(resolveLinkedInVersion('202605', now)).toBe('202605')
    expect(resolveLinkedInVersion('202405', now)).toBe(LINKEDIN_API_VERSION)
    expect(resolveLinkedInVersion('garbage', now)).toBe(LINKEDIN_API_VERSION)
    expect(resolveLinkedInVersion(undefined, now)).toBe(LINKEDIN_API_VERSION)
  })

  it('has a default with at least two months left before LinkedIn retires it', () => {
    const twoMonths = 61 * 24 * 60 * 60 * 1000
    expect(linkedInVersionSunset(LINKEDIN_API_VERSION).getTime() - Date.now()).toBeGreaterThan(twoMonths)
  })
})
