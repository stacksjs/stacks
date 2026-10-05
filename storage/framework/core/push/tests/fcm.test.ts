import { afterEach, describe, expect, test } from 'bun:test'

/**
 * A JWS segment is base64url with the padding stripped: RFC 7515 section 2,
 * which RFC 7519 inherits for JWTs. Plain base64 is not interchangeable here -
 * Google's token endpoint rejects the assertion outright.
 */
const BASE64URL = /^[A-Za-z0-9_-]+$/

/** A throwaway RSA key in the PEM shape a Firebase service account file carries. */
async function generateServiceAccountKey(): Promise<string> {
  const pair = await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify'],
  ) as CryptoKeyPair

  const pkcs8 = await crypto.subtle.exportKey('pkcs8', pair.privateKey)
  const body = btoa(String.fromCharCode(...new Uint8Array(pkcs8)))
  return `-----BEGIN PRIVATE KEY-----\n${body.replace(/(.{64})/g, '$1\n')}\n-----END PRIVATE KEY-----\n`
}

function decodeSegment(segment: string): unknown {
  const padded = segment.padEnd(segment.length + ((4 - (segment.length % 4)) % 4), '=')
  return JSON.parse(atob(padded.replace(/-/g, '+').replace(/_/g, '/')))
}

describe('FCM service account assertion', () => {
  /**
   * These two addresses are not arbitrary. Under plain `btoa` the first one's
   * claim set encodes to a string ending in '=', and the second one's does not,
   * so a test that only used the second would pass against the bug. Sweeping
   * realistic service account addresses, about 65% land on the first shape -
   * and because the claim set's length is stable for a given account, an
   * affected deployment never authenticates rather than failing intermittently.
   */
  const PADS = 'push@acme-prod.iam.gserviceaccount.com'
  const CLEAN = 'firebase-adminsdk-abc12@my-stacks-app.iam.gserviceaccount.com'
  const NOW = 1791200000

  test.each([
    ['a claim set that needs base64 padding', PADS],
    ['a claim set that happens not to', CLEAN],
  ])('signs %s into three base64url segments', async (_label, clientEmail) => {
    const { buildServiceAccountAssertion } = await import('../src/drivers/fcm')
    const jwt = await buildServiceAccountAssertion(clientEmail, await generateServiceAccountKey(), NOW)

    const segments = jwt.split('.')
    expect(segments).toHaveLength(3)
    for (const segment of segments)
      expect(segment).toMatch(BASE64URL)
  })

  test('carries the claims Google requires for the firebase.messaging scope', async () => {
    const { buildServiceAccountAssertion } = await import('../src/drivers/fcm')
    const jwt = await buildServiceAccountAssertion(PADS, await generateServiceAccountKey(), NOW)

    expect(decodeSegment(jwt.split('.')[0])).toEqual({ alg: 'RS256', typ: 'JWT' })
    expect(decodeSegment(jwt.split('.')[1])).toEqual({
      iss: PADS,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      iat: NOW,
      exp: NOW + 3600,
    })
  })

  test('accepts a PEM whose base64 body is wrapped across lines', async () => {
    const { buildServiceAccountAssertion } = await import('../src/drivers/fcm')
    const pem = await generateServiceAccountKey()
    expect(pem).toContain('\n')
    await expect(buildServiceAccountAssertion(CLEAN, pem, NOW)).resolves.toBeString()
  })
})

describe('FCM topic subscriptions', () => {
  const PROJECT_ID = 'stacks-demo-471203'
  const TOPIC = 'weekly-digest'
  const TOKEN = 'eXampleToken/with+chars=='

  const realFetch = globalThis.fetch
  let requests: Array<{ url: string, method: string, authorization?: string, body?: unknown }> = []

  /**
   * Swapping globalThis.fetch rather than mock.module: a top-level module mock
   * poisons the shared src/ instance for every other test file in the process.
   */
  function stubFetch(topicStatus: number): void {
    requests = []
    globalThis.fetch = (async (input: any, init: any = {}) => {
      const url = String(input?.url ?? input)
      const headers = (init.headers ?? {}) as Record<string, string>
      requests.push({ url, method: init.method ?? 'GET', authorization: headers.Authorization, body: init.body })

      if (url.startsWith('https://oauth2.googleapis.com/token'))
        return new Response(JSON.stringify({ access_token: 'test-access-token' }), { status: 200 })

      return new Response('{}', { status: topicStatus })
    }) as typeof fetch
  }

  async function configureServiceAccount(): Promise<typeof import('../src/drivers/fcm')> {
    const fcm = await import('../src/drivers/fcm')
    fcm.configure({
      projectId: PROJECT_ID,
      serviceAccount: { clientEmail: 'push@acme-prod.iam.gserviceaccount.com', privateKey: await generateServiceAccountKey() },
    })
    return fcm
  }

  afterEach(async () => {
    globalThis.fetch = realFetch
    // Module-level driver config is shared with every other test file in this
    // process, so hand it back the way it was found.
    const fcm = await import('../src/drivers/fcm')
    fcm.configure({ projectId: undefined, serverKey: undefined, serviceAccount: undefined })
  })

  const topicRequests = () => requests.filter(r => !r.url.startsWith('https://oauth2.googleapis.com/token'))

  test('subscribing posts to the v1 API with the topic as a query parameter', async () => {
    stubFetch(200)
    const fcm = await configureServiceAccount()

    expect(await fcm.subscribeToTopic([TOKEN], TOPIC)).toBe(true)

    const [req] = topicRequests()
    expect(req.method).toBe('POST')
    expect(req.url).toBe(
      `https://fcm.googleapis.com/v1/projects/${PROJECT_ID}/registrations/${encodeURIComponent(TOKEN)}/topicSubscriptions?topic_name=${TOPIC}`,
    )
    expect(req.authorization).toBe('Bearer test-access-token')
  })

  test('unsubscribing deletes with the topic as a path segment', async () => {
    stubFetch(200)
    const fcm = await configureServiceAccount()

    expect(await fcm.unsubscribeFromTopic([TOKEN], TOPIC)).toBe(true)

    const [req] = topicRequests()
    expect(req.method).toBe('DELETE')
    expect(req.url).toBe(
      `https://fcm.googleapis.com/v1/projects/${PROJECT_ID}/registrations/${encodeURIComponent(TOKEN)}/topicSubscriptions/${TOPIC}`,
    )
  })

  /** The point of stacksjs/stacks#2856: these endpoints stop serving 2027-09-29. */
  test('never contacts the decommissioned Instance ID endpoints', async () => {
    stubFetch(200)
    const fcm = await configureServiceAccount()

    await fcm.subscribeToTopic([TOKEN], TOPIC)
    await fcm.unsubscribeFromTopic([TOKEN], TOPIC)

    expect(requests.map(r => r.url).join(' ')).not.toContain('iid.googleapis.com')
  })

  test('treats 409 on subscribe as the subscription already existing', async () => {
    stubFetch(409)
    const fcm = await configureServiceAccount()

    expect(await fcm.subscribeToTopic([TOKEN], TOPIC)).toBe(true)
  })

  test('reports failure when the API rejects the request', async () => {
    stubFetch(403)
    const fcm = await configureServiceAccount()

    expect(await fcm.subscribeToTopic([TOKEN], TOPIC)).toBe(false)
  })

  test('sends one request per token', async () => {
    stubFetch(200)
    const fcm = await configureServiceAccount()

    await fcm.subscribeToTopic(['t1', 't2', 't3'], TOPIC)

    expect(topicRequests()).toHaveLength(3)
  })

  test('requires a service account rather than a legacy server key', async () => {
    stubFetch(200)
    const fcm = await import('../src/drivers/fcm')
    fcm.configure({ serverKey: 'legacy-server-key', projectId: undefined, serviceAccount: undefined })

    await expect(fcm.subscribeToTopic([TOKEN], TOPIC)).rejects.toThrow(/service account/i)
  })
})

describe('FCM legacy send path', () => {
  const realFetch = globalThis.fetch
  let calls: string[] = []

  function recordFetch(): void {
    calls = []
    globalThis.fetch = (async (input: any) => {
      calls.push(String(input?.url ?? input))
      return new Response('{}', { status: 200 })
    }) as typeof fetch
  }

  afterEach(async () => {
    globalThis.fetch = realFetch
    const fcm = await import('../src/drivers/fcm')
    fcm.configure({ projectId: undefined, serviceAccount: undefined })
  })

  /**
   * https://fcm.googleapis.com/fcm/send was decommissioned on 2024-06-20 and
   * now answers 404, so falling back to it could only ever produce a confusing
   * failure. Probed directly: the legacy endpoint 404s where the v1 endpoint
   * answers 401.
   */
  test('send() asks for a service account instead of falling back to a dead endpoint', async () => {
    recordFetch()
    const fcm = await import('../src/drivers/fcm')
    fcm.configure({ projectId: undefined, serviceAccount: undefined })

    const result = await fcm.send({ to: 'token', notification: { title: 'a', body: 'b' } })

    expect(result.success).toBe(false)
    expect(result.message).toMatch(/service account/i)
    expect(result.message).not.toMatch(/server key/i)
    expect(calls).toBeEmpty()
  })

  test('sendMulticast() does the same rather than batching to the legacy API', async () => {
    recordFetch()
    const fcm = await import('../src/drivers/fcm')
    fcm.configure({ projectId: undefined, serviceAccount: undefined })

    const results = await fcm.sendMulticast(['t1', 't2'], { notification: { title: 'a', body: 'b' } })

    expect(results).toHaveLength(2)
    expect(results.every(r => !r.success)).toBe(true)
    expect(calls).toBeEmpty()
  })

  test('no longer exports a legacy sender', async () => {
    const fcm = await import('../src/drivers/fcm')
    expect('sendLegacy' in fcm).toBe(false)
  })

  test('the driver calls no decommissioned endpoint', async () => {
    const source = await Bun.file(new URL('../src/drivers/fcm.ts', import.meta.url)).text()

    // Quoted, so this pins call sites and still lets a comment name the dead
    // endpoint and say when it died. Booleans rather than toContain, so a
    // failure reports the match instead of printing the whole file.
    expect(/['"`]https:\/\/fcm\.googleapis\.com\/fcm\/send/.test(source)).toBe(false)
    expect(/['"`]https:\/\/iid\.googleapis\.com/.test(source)).toBe(false)
  })
})
