import { afterEach, describe, expect, test } from 'bun:test'
import { fetchPublicUrl, OutboundUrlError } from '../src/outbound'

/**
 * stacksjs/stacks#2909 — `assertPublicOutboundUrl` blesses a URL and the
 * caller's `fetch` then follows redirects and re-resolves the name, which
 * gives back everything the check established. These pin that every hop is
 * checked, that the connection goes to an address that was checked, and that
 * the request is bounded.
 *
 * `fetch` is stubbed rather than served locally: a local server can only be
 * reached at a private address, which the guard refuses by design, so a real
 * socket cannot express "hop 1 was public".
 */

const realFetch = globalThis.fetch

/** Every address resolves public, so hop validation turns on the URL alone. */
const publicResolve = async () => ['93.184.216.34']

interface Call { url: string, init: RequestInit & { tls?: { serverName: string } } }

/** Answer each request from a script, recording what was sent. */
function stubFetch(script: (call: Call, index: number) => Response): Call[] {
  const calls: Call[] = []
  globalThis.fetch = (async (input: string | URL | Request, init: RequestInit = {}) => {
    const call = { url: String(input instanceof Request ? input.url : input), init }
    calls.push(call)
    return script(call, calls.length - 1)
  }) as unknown as typeof fetch
  return calls
}

const redirectTo = (location: string, status = 302) => new Response(null, { status, headers: { Location: location } })

afterEach(() => {
  globalThis.fetch = realFetch
})

describe('fetchPublicUrl redirects', () => {
  test('connects to the single validated DNS answer without resolving a second time', async () => {
    const calls = stubFetch(() => new Response('ok'))
    let resolutions = 0
    await fetchPublicUrl('https://webhook.example.com/hook', {}, {
      resolve: async () => ++resolutions === 1 ? ['93.184.216.34'] : ['127.0.0.1'],
    })
    expect(resolutions).toBe(1)
    expect(calls[0]!.url).toBe('https://93.184.216.34/hook')
  })
  test('refuses a redirect into the metadata service, and never sends it', async () => {
    const calls = stubFetch(() => redirectTo('http://169.254.169.254/latest/meta-data/iam/security-credentials/'))

    const attempt = fetchPublicUrl('https://webhook.example.com/hook', {}, { allowHttp: true, resolve: publicResolve })
    await expect(attempt).rejects.toThrow('private or local address')
    await attempt.catch((error: OutboundUrlError) => expect(error.reason).toBe('private'))

    // The second request is the one that mattered. It was never issued.
    expect(calls).toHaveLength(1)
  })

  test('follows a redirect that is still public, and checks it first', async () => {
    const calls = stubFetch((_call, index) => index === 0
      ? redirectTo('https://elsewhere.example.com/landed')
      : new Response('arrived', { status: 200 }))

    const response = await fetchPublicUrl('https://webhook.example.com/hook', {}, { resolve: publicResolve })
    expect(await response.text()).toBe('arrived')
    expect(calls).toHaveLength(2)
  })

  test('stops at maxRedirects rather than looping', async () => {
    const calls = stubFetch(() => redirectTo('https://webhook.example.com/again'))

    const attempt = fetchPublicUrl('https://webhook.example.com/hook', {}, { resolve: publicResolve, maxRedirects: 2 })
    await expect(attempt).rejects.toThrow('redirected more than 2 times')
    expect(calls).toHaveLength(3)
  })

  test('maxRedirects 0 refuses the first one', async () => {
    stubFetch(() => redirectTo('https://elsewhere.example.com/landed'))
    await expect(fetchPublicUrl('https://webhook.example.com/hook', {}, { resolve: publicResolve, maxRedirects: 0 }))
      .rejects.toThrow('redirected more than 0 times')
  })

  test('a redirect to another scheme is refused by the same rules', async () => {
    stubFetch(() => redirectTo('ftp://files.example.com/secrets'))
    const attempt = fetchPublicUrl('https://webhook.example.com/hook', {}, { resolve: publicResolve })
    await attempt.catch((error: OutboundUrlError) => expect(error.reason).toBe('scheme'))
    await expect(attempt).rejects.toThrow('must start with https://')
  })

  test('drops credentials when a redirect crosses to another origin', async () => {
    const calls = stubFetch((_call, index) => index === 0
      ? redirectTo('https://elsewhere.example.com/landed')
      : new Response('ok'))

    await fetchPublicUrl('https://webhook.example.com/hook', {
      headers: { Authorization: 'Bearer secret', Cookie: 'session=abc', 'X-Trace': 'keep-me' },
    }, { resolve: publicResolve })

    const second = new Headers(calls[1]!.init.headers)
    expect(second.get('authorization')).toBeNull()
    expect(second.get('cookie')).toBeNull()
    // Only the sensitive ones go; the rest of the request is intact.
    expect(second.get('x-trace')).toBe('keep-me')
  })

  test('keeps credentials on a redirect within the same origin', async () => {
    const calls = stubFetch((_call, index) => index === 0
      ? redirectTo('https://webhook.example.com/moved')
      : new Response('ok'))

    await fetchPublicUrl('https://webhook.example.com/hook', { headers: { Authorization: 'Bearer secret' } }, { resolve: publicResolve })
    expect(new Headers(calls[1]!.init.headers).get('authorization')).toBe('Bearer secret')
  })

  test('303 becomes a GET without the body, 307 keeps both', async () => {
    const seeOther = stubFetch((_call, index) => index === 0 ? redirectTo('https://webhook.example.com/landed', 303) : new Response('ok'))
    await fetchPublicUrl('https://webhook.example.com/hook', { method: 'POST', body: 'payload' }, { resolve: publicResolve })
    expect(seeOther[1]!.init.method).toBe('GET')
    expect(seeOther[1]!.init.body).toBeUndefined()

    globalThis.fetch = realFetch
    const temporary = stubFetch((_call, index) => index === 0 ? redirectTo('https://webhook.example.com/landed', 307) : new Response('ok'))
    await fetchPublicUrl('https://webhook.example.com/hook', { method: 'POST', body: 'payload' }, { resolve: publicResolve })
    expect(temporary[1]!.init.method).toBe('POST')
    expect(temporary[1]!.init.body).toBe('payload')
  })
})

describe('fetchPublicUrl connects to the address it checked', () => {
  test('sends to the resolved address, with the name in Host and in SNI', async () => {
    const calls = stubFetch(() => new Response('ok'))

    await fetchPublicUrl('https://webhook.example.com/hook', {}, { resolve: publicResolve })

    // Not to the name: a second resolution is the rebinding window.
    expect(calls[0]!.url).toBe('https://93.184.216.34/hook')
    expect(new Headers(calls[0]!.init.headers).get('host')).toBe('webhook.example.com')
    // So the certificate is still checked against the name.
    expect(calls[0]!.init.tls).toEqual({ serverName: 'webhook.example.com' })
  })

  test('leaves a URL that is already an address alone', async () => {
    const calls = stubFetch(() => new Response('ok'))
    await fetchPublicUrl('https://93.184.216.34/hook', {}, {})
    expect(calls[0]!.url).toBe('https://93.184.216.34/hook')
    expect(calls[0]!.init.tls).toBeUndefined()
  })
})

describe('fetchPublicUrl bounds the response', () => {
  test('refuses a body over the cap, by its declared length', async () => {
    stubFetch(() => new Response('x'.repeat(100), { headers: { 'Content-Length': '100' } }))
    const attempt = fetchPublicUrl('https://webhook.example.com/hook', {}, { resolve: publicResolve, maxBytes: 10 })
    await expect(attempt).rejects.toThrow('over the 10 byte limit')
    await attempt.catch((error: OutboundUrlError) => expect(error.reason).toBe('too-large'))
  })

  test('refuses a body over the cap that did not declare one', async () => {
    stubFetch(() => new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('x'.repeat(50)))
        controller.close()
      },
    })))
    await expect(fetchPublicUrl('https://webhook.example.com/hook', {}, { resolve: publicResolve, maxBytes: 10 }))
      .rejects.toThrow('over the 10 byte limit')
  })

  test('returns a body under the cap intact', async () => {
    stubFetch(() => new Response('small enough', { status: 201, headers: { 'X-Kept': 'yes' } }))
    const response = await fetchPublicUrl('https://webhook.example.com/hook', {}, { resolve: publicResolve, maxBytes: 1024 })
    expect(response.status).toBe(201)
    expect(response.headers.get('x-kept')).toBe('yes')
    expect(await response.text()).toBe('small enough')
  })
})
