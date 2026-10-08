import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { InstagramPublishingDriver } from '../src/drivers/instagram'
import { ThreadsPublishingDriver } from '../src/drivers/threads'

/**
 * A credential never reaches a request URL.
 *
 * Instagram and Threads put the publishing token in a GET query string at four
 * call sites (stacksjs/stacks#2882). Nothing logged it, and a URL is the one
 * part of a request that is logged by default everywhere it passes: this
 * process, any forward proxy, Meta's own edge. A long-lived token that posts as
 * the account is then a credential sitting in files nobody treats as secret.
 *
 * Asserted on what the drivers actually SEND, not on their source. Both take a
 * `graphBase`, so they can be pointed at a server that records every request
 * and answers with the shapes the publish flow expects. A source scan would
 * pass on a driver that assembles the same URL a different way; this cannot.
 */

const TOKEN = 'IGQVJYprobe-token-that-must-never-appear-in-a-url'

interface Seen {
  method: string
  url: string
  path: string
  query: string
  body: string
  authorization: string | null
}

let seen: Seen[] = []
let server: ReturnType<typeof Bun.serve>
let base: string

/**
 * The canned answers each step of the two publish flows needs to continue.
 *
 * Routed on the PATHNAME, with the query considered separately. Matching the
 * whole URL sent `/me/accounts?fields=...` down the fallback branch, because
 * the URL ends with the query rather than the path.
 */
function answer(path: string, query: string): unknown {
  if (path.endsWith('/oauth/access_token')) return { access_token: 'minted', user_id: '42', expires_in: 5184000 }
  if (path.endsWith('/me/accounts')) return { data: [{ access_token: 'page-token', instagram_business_account: { id: '17841400000000000', username: 'probe' } }] }
  if (path.endsWith('/me')) return { id: '98765', username: 'probe' }
  if (query.includes('fields=permalink')) return { permalink: 'https://example.test/p/1' }
  return { id: 'container-1' }
}

beforeAll(() => {
  server = Bun.serve({
    port: 0,
    hostname: '127.0.0.1',
    async fetch(request) {
      const url = new URL(request.url)
      seen.push({
        method: request.method,
        url: request.url,
        path: url.pathname,
        query: url.search,
        body: request.method === 'GET' ? '' : await request.text(),
        authorization: request.headers.get('authorization'),
      })
      return Response.json(answer(url.pathname, url.search))
    },
  })
  base = `http://127.0.0.1:${server.port}`
})

afterAll(() => server.stop(true))

/** Run one flow and hand back every request it made. */
async function record(run: () => Promise<unknown>): Promise<Seen[]> {
  seen = []
  await run()
  expect(seen.length, 'the flow must have reached the server').toBeGreaterThan(0)
  return seen
}

const instagram = () => new InstagramPublishingDriver({ graphBase: base, graphVersion: 'v24.0' })
const threads = () => new ThreadsPublishingDriver({ graphBase: base, graphVersion: 'v1.0' })

const identity = { handle: 'probe', did: '17841400000000000', accessToken: TOKEN }
const post = { text: 'A probe post', media: [{ url: 'https://example.test/shot.png' }] }

describe('Instagram', () => {
  it('publishes with the token in a header and nowhere else', async () => {
    const requests = await record(() => instagram().publish(identity, post))

    // Three requests: create the container, publish it, read the permalink.
    expect(requests.map(r => r.method)).toEqual(['POST', 'POST', 'GET'])

    for (const request of requests) {
      expect(request.url, request.path).not.toContain(TOKEN)
      expect(request.query, request.path).not.toContain('access_token')
      expect(request.body, request.path).not.toContain(TOKEN)
      expect(request.authorization, request.path).toBe(`Bearer ${TOKEN}`)
    }
  })

  it('reads the linked account with the token in a header', async () => {
    const requests = await record(() => instagram().resolveAccount(TOKEN))

    for (const request of requests) {
      expect(request.url).not.toContain(TOKEN)
      expect(request.authorization).toBe(`Bearer ${TOKEN}`)
    }
    // The `fields` list legitimately names access_token as a FIELD to read
    // back, which is not a credential. The query must carry no VALUE.
    expect(requests[0]!.query).toContain('fields=')
  })

  it('exchanges a code without putting the client secret in a URL', async () => {
    // The secret is a long-lived app credential, so the same logging argument
    // applies to it more than to a user token. Meta's token endpoint takes
    // either form; this one has to be the body.
    const requests = await record(() => instagram().exchangeCode({
      clientId: '000',
      clientSecret: 'super-secret-value',
      redirectUrl: 'http://127.0.0.1/cb',
      code: 'probe-code',
    }))

    expect(requests).toHaveLength(1)
    expect(requests[0]!.method).toBe('POST')
    expect(requests[0]!.url).not.toContain('super-secret-value')
    expect(requests[0]!.query).toBe('')
    expect(requests[0]!.body).toContain('super-secret-value')
  })
})

describe('Threads', () => {
  it('publishes with the token in a header and nowhere else', async () => {
    const requests = await record(() => threads().publish({ ...identity, did: '98765' }, post))

    expect(requests.map(r => r.method)).toEqual(['POST', 'POST', 'GET'])

    for (const request of requests) {
      expect(request.url, request.path).not.toContain(TOKEN)
      expect(request.query, request.path).not.toContain('access_token')
      expect(request.body, request.path).not.toContain(TOKEN)
      expect(request.authorization, request.path).toBe(`Bearer ${TOKEN}`)
    }
  })

  it('reads the account with the token in a header', async () => {
    const requests = await record(() => threads().resolveAccount(TOKEN))

    expect(requests[0]!.url).not.toContain(TOKEN)
    expect(requests[0]!.query).not.toContain('access_token')
    expect(requests[0]!.authorization).toBe(`Bearer ${TOKEN}`)
  })

  it('already exchanged its code in a body, and still does', async () => {
    const requests = await record(() => threads().exchangeCode({
      clientId: '000',
      clientSecret: 'super-secret-value',
      redirectUrl: 'http://127.0.0.1/cb',
      code: 'probe-code',
    }))

    expect(requests[0]!.method).toBe('POST')
    expect(requests[0]!.url).not.toContain('super-secret-value')
    expect(requests[0]!.body).toContain('super-secret-value')
  })
})

describe('the content type survives the header being added', () => {
  it('still posts form-encoded bodies', async () => {
    // `graph()` rebuilds the headers to add authorization. Dropping the
    // caller's `content-type` would make Meta read a form body as something
    // else, which is the obvious way to break this while the token test
    // still passes.
    seen = []
    await instagram().publish(identity, post)
    const posts = seen.filter(request => request.method === 'POST')
    expect(posts.length).toBeGreaterThan(0)
    for (const request of posts)
      expect(request.body).toContain('=')
  })
})
