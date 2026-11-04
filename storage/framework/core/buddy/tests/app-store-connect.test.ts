import { describe, expect, it, setSystemTime } from 'bun:test'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { TestFlightBuild } from '../src/app-store-connect'
import { AppStoreConnect, appStoreConnectCredentials, appStoreConnectToken, buildsToExpire, tagForXcodeCloudRun, waitForBuild } from '../src/app-store-connect'

/** A P-256 key pair, the private half as the .p8 PEM App Store Connect hands out. */
async function keyPair(): Promise<{ pem: string, publicKey: CryptoKey }> {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']) as CryptoKeyPair
  const pkcs8 = Buffer.from(await crypto.subtle.exportKey('pkcs8', pair.privateKey)).toString('base64')
  const pem = `-----BEGIN PRIVATE KEY-----\n${pkcs8.match(/.{1,64}/g)!.join('\n')}\n-----END PRIVATE KEY-----`
  return { pem, publicKey: pair.publicKey }
}

const decode = (part: string): any => JSON.parse(Buffer.from(part.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString())

function build(number: number, state = 'VALID', expired = false): TestFlightBuild {
  return { id: `b${number}`, number, uploadedDate: '', processingState: state, expired }
}

describe('App Store Connect for release:ios', () => {
  it('assigns a processed build to the configured internal group found on a later app page', async () => {
    const writes: Array<{ path: string, body: unknown }> = []
    const api = new AppStoreConnect('token', async (input, init) => {
      const url = new URL(input)
      if (init?.method === 'POST') {
        writes.push({ path: url.pathname, body: JSON.parse(String(init.body)) })
        return new Response(null, { status: 204 })
      }
      if (url.pathname === '/v1/apps/app/betaGroups') {
        return url.searchParams.has('cursor')
          ? Response.json({ data: [{ id: 'team', attributes: { name: 'Team', isInternalGroup: true } }] })
          : Response.json({ data: [{ id: 'public', attributes: { name: 'Public', isInternalGroup: false } }], links: { next: 'https://api.appstoreconnect.apple.com/v1/apps/app/betaGroups?cursor=2' } })
      }
      if (url.pathname === '/v1/builds/b158/betaGroups') return Response.json({ data: [] })
      return new Response('Unexpected Apple request', { status: 404 })
    })
    expect(await api.assignBuildToInternalGroups('app', build(158), ['Team'])).toEqual([{ id: 'team', name: 'Team', isInternalGroup: true }])
    expect(writes).toEqual([{ path: '/v1/betaGroups/team/relationships/builds', body: { data: [{ type: 'builds', id: 'b158' }] } }])
  })

  it('rejects missing, external or ambiguous groups before distributing any build', async () => {
    for (const groups of [[], [{ id: 'public', attributes: { name: 'Team', isInternalGroup: false } }],
      [{ id: 'one', attributes: { name: 'Team', isInternalGroup: true } }, { id: 'two', attributes: { name: 'Team', isInternalGroup: true } }]]) {
      let writes = 0
      const api = new AppStoreConnect('token', async (_url, init) => {
        if (init?.method === 'POST') writes++
        return Response.json({ data: groups })
      })
      await expect(api.assignBuildToInternalGroups('app', build(158), ['Team'])).rejects.toThrow('existing internal group')
      expect(writes).toBe(0)
    }
  })

  it('waits for actual internal group delivery before retiring an older build', async () => {
    let clock = 0
    let assigned = false
    const operations: string[] = []
    const api = new AppStoreConnect('token', async (input, init) => {
      const url = new URL(input)
      const path = url.pathname
      if (init?.method === 'POST') { assigned = true; operations.push('assign'); return new Response(null, { status: 204 }) }
      if (init?.method === 'PATCH') { operations.push(`expire:${path}`); return Response.json({ data: {} }) }
      if (path === '/v1/apps/app/betaGroups') return Response.json({ data: [{ id: 'team', attributes: { name: 'Team', isInternalGroup: true } }] })
      if (path === '/v1/builds/b158/betaGroups') return Response.json({ data: assigned && clock >= 60_000 ? [{ id: 'team', attributes: { name: 'Team', isInternalGroup: true } }] : [] })
      if (path === '/v1/builds/b158/buildBetaDetail') return Response.json({ data: { attributes: { internalBuildState: clock >= 60_000 ? 'IN_BETA_TESTING' : 'READY_FOR_BETA_TESTING' } } })
      if (path === '/v1/builds') {
        if (url.searchParams.has('filter[version]')) return Response.json({ data: [{ id: 'b158', attributes: { version: '158', processingState: clock ? 'VALID' : 'PROCESSING', expired: false } }] })
        return Response.json({ data: [155, 156, 157, 158, 159].map(number => ({ id: `b${number}`, attributes: { version: String(number), processingState: 'VALID', expired: false } })) })
      }
      return new Response('Unexpected Apple request', { status: 404 })
    })
    const result = await api.deliverBuild('app', '1.0.0', 158, {
      groups: ['Team'], keepBuilds: 1, timeoutMs: 90_000, intervalMs: 30_000, now: () => clock,
      sleep: async ms => { expect(operations.filter(operation => operation.startsWith('expire:'))).toEqual([]); clock += ms },
    })
    expect(result?.number).toBe(158)
    expect(clock).toBe(60_000)
    expect(operations).toEqual(['assign', 'expire:/v1/builds/b156', 'expire:/v1/builds/b155'])
  })

  it('leaves older builds available when internal testing never becomes ready', async () => {
    let clock = 0
    let assignments = 0
    let expirations = 0
    const api = new AppStoreConnect('token', async (input, init) => {
      const path = new URL(input).pathname
      if (init?.method === 'POST') { assignments++; return new Response(null, { status: 204 }) }
      if (init?.method === 'PATCH') { expirations++; return Response.json({ data: {} }) }
      if (path === '/v1/apps/app/betaGroups') return Response.json({ data: [{ id: 'team', attributes: { name: 'Team', isInternalGroup: true } }] })
      if (path === '/v1/builds/b158/betaGroups') return Response.json({ data: [] })
      if (path === '/v1/builds/b158/buildBetaDetail') return Response.json({ data: { attributes: { internalBuildState: 'READY_FOR_BETA_TESTING' } } })
      if (path === '/v1/builds') return Response.json({ data: [{ id: 'b158', attributes: { version: '158', processingState: 'VALID', expired: false } }] })
      return new Response('Unexpected Apple request', { status: 404 })
    })
    expect(await api.deliverBuild('app', '1.0.0', 158, { groups: ['Team'], timeoutMs: 60_000, now: () => clock, sleep: async ms => { clock += ms } })).toBeNull()
    expect(clock).toBe(60_000)
    expect(assignments).toBe(1)
    expect(expirations).toBe(0)
  })

  it('resumes existing membership without assigning twice and rejects unready or expired builds', async () => {
    let assigned = false
    let writes = 0
    const api = new AppStoreConnect('token', async (input, init) => {
      if (init?.method === 'POST') { assigned = true; writes++; return new Response(null, { status: 204 }) }
      return Response.json({ data: new URL(input).pathname.startsWith('/v1/apps/') || assigned
        ? [{ id: 'team', attributes: { name: 'Team', isInternalGroup: true } }] : [] })
    })
    await api.assignBuildToInternalGroups('app', build(158), ['Team', 'Team'])
    await api.assignBuildToInternalGroups('app', build(158), ['Team'])
    expect(writes).toBe(1)
    for (const candidate of [build(158, 'PROCESSING'), build(158, 'FAILED'), build(158, 'VALID', true)])
      await expect(api.assignBuildToInternalGroups('app', candidate, ['Team'])).rejects.toThrow('processed, unexpired')
    expect(writes).toBe(1)
  })

  it('does not follow a group pagination link to another service', async () => {
    const calls: string[] = []
    const api = new AppStoreConnect('token', async input => {
      calls.push(input)
      return Response.json({ data: [], links: { next: 'https://other.example/v1/groups' } })
    })
    await expect(api.internalTestFlightGroups('app', ['Team'])).rejects.toThrow('unsafe pagination')
    expect(calls).toHaveLength(1)
    expect(new URL(calls[0]!).origin).toBe('https://api.appstoreconnect.apple.com')
  })

  it('reads the key from the environment, inline or from its file, and nothing without all three parts', async () => {
    const { pem } = await keyPair()
    expect(appStoreConnectCredentials({})).toBeNull()
    expect(appStoreConnectCredentials({ APP_STORE_CONNECT_KEY_ID: 'K', APP_STORE_CONNECT_ISSUER_ID: 'I' })).toBeNull()
    // One line in an env file, with literal \n.
    const inline = appStoreConnectCredentials({ APP_STORE_CONNECT_KEY_ID: 'K', APP_STORE_CONNECT_ISSUER_ID: 'I', APP_STORE_CONNECT_PRIVATE_KEY: pem.replace(/\n/g, '\\n') })
    expect(inline?.privateKey).toBe(pem)
    const file = join(mkdtempSync(join(tmpdir(), 'asc-')), 'AuthKey_K.p8')
    writeFileSync(file, pem)
    expect(appStoreConnectCredentials({ APP_STORE_CONNECT_KEY_ID: 'K', APP_STORE_CONNECT_ISSUER_ID: 'I', APP_STORE_CONNECT_PRIVATE_KEY_PATH: file })?.privateKey).toBe(pem)
  })

  it('signs a 20-minute ES256 token the key\'s public half verifies', async () => {
    const { pem, publicKey } = await keyPair()
    const token = await appStoreConnectToken({ keyId: 'ABC123', issuerId: 'issuer-uuid', privateKey: pem }, 1_700_000_000_000)
    const [header, payload, signature] = token.split('.')
    expect(decode(header!)).toEqual({ alg: 'ES256', kid: 'ABC123', typ: 'JWT' })
    expect(decode(payload!)).toEqual({ iss: 'issuer-uuid', iat: 1_700_000_000, exp: 1_700_000_000 + 1200, aud: 'appstoreconnect-v1' })
    const raw = Buffer.from(signature!.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
    expect(raw.length).toBe(64)
    expect(await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, publicKey, raw, Buffer.from(`${header}.${payload}`))).toBe(true)
  })

  it('names the tag after the number Xcode Cloud gives the next run', () => {
    expect(tagForXcodeCloudRun('1.0.0', 9)).toBe('v1.0.0-build.10')
  })

  it('keeps a long release wait authenticated without extending Apple token lifetimes', async () => {
    const { pem, publicKey } = await keyPair()
    const start = Date.parse('2026-11-02T00:00:00Z')
    const presented: string[] = []
    const apple = async (url: string, init?: RequestInit) => {
      expect(new URL(url).pathname).toBe('/v1/apps')
      const token = new Headers(init?.headers).get('authorization')!.slice('Bearer '.length)
      const [header, payload, signature] = token.split('.')
      const claims = decode(payload!)
      const valid = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, publicKey, Buffer.from(signature!, 'base64url'), Buffer.from(`${header}.${payload}`))
      if (!valid || claims.exp <= Date.now() / 1000 || claims.exp - claims.iat > 1200)
        return new Response('Invalid or expired Apple token', { status: 401 })
      presented.push(token)
      return Response.json({ data: [{ id: 'hq-app' }] })
    }
    try {
      setSystemTime(start)
      const api = await AppStoreConnect.connect({ keyId: 'test', issuerId: 'test', privateKey: pem }, apple)
      expect(await api.appId('training.hq.test')).toBe('hq-app')
      setSystemTime(start + 10 * 60_000)
      expect(await api.appId('training.hq.test')).toBe('hq-app')
      expect(presented[1]).toBe(presented[0])
      setSystemTime(start + 21 * 60_000)
      expect(await Promise.all([api.appId('training.hq.test'), api.appId('training.hq.test')])).toEqual(['hq-app', 'hq-app'])
      expect(presented[2]).not.toBe(presented[0])
      expect(presented[3]).toBe(presented[2])
      setSystemTime(start + 42 * 60_000)
      expect(await api.appId('training.hq.test')).toBe('hq-app')
      expect(presented[4]).not.toBe(presented[2])
    }
    finally { setSystemTime() }
  })

  it('retires every finished build but the newest kept, and never one still processing', () => {
    const builds = [build(3), build(9), build(5), build(7), build(4), build(6, 'VALID', true), build(10, 'PROCESSING')]
    expect(buildsToExpire(builds, 1).map(b => b.number)).toEqual([7, 5, 4, 3])
    expect(buildsToExpire(builds, 0).map(b => b.number)).toEqual([9, 7, 5, 4, 3])
    expect(buildsToExpire([build(9)], 1)).toEqual([])
  })

  it('finds the app, its latest Xcode Cloud run and its builds, and expires one', async () => {
    const calls: Array<{ url: string, init?: RequestInit }> = []
    const answers: Record<string, unknown> = {
      '/v1/apps': { data: [{ id: '6820248190' }] },
      '/v1/ciProducts': { data: [{ id: 'product-1' }] },
      '/v1/ciProducts/product-1/buildRuns': { data: [{ attributes: { number: 9 } }] },
      '/v1/builds': { data: [{ id: 'b9', attributes: { version: '9', uploadedDate: '2026-10-09', processingState: 'VALID', expired: false } }] },
    }
    const fakeFetch = async (url: string, init?: RequestInit): Promise<Response> => {
      calls.push({ url, init })
      const path = new URL(url).pathname
      if (init?.method === 'PATCH') return new Response(JSON.stringify({ data: {} }), { status: 200 })
      return new Response(JSON.stringify(answers[path] ?? {}), { status: answers[path] ? 200 : 404 })
    }
    const api = new AppStoreConnect('token', fakeFetch)
    expect(await api.appId('training.hq.app')).toBe('6820248190')
    expect(calls[0]!.url).toContain('filter[bundleId]=training.hq.app')
    expect((calls[0]!.init!.headers as Record<string, string>).Authorization).toBe('Bearer token')
    expect(await api.latestXcodeCloudRun('6820248190')).toBe(9)
    expect(calls.at(-1)!.url).toContain('sort=-number')
    expect((await api.builds('6820248190'))[0]).toEqual({ id: 'b9', number: 9, uploadedDate: '2026-10-09', processingState: 'VALID', expired: false })
    await api.expire('b5')
    expect(calls.at(-1)!.init!.method).toBe('PATCH')
    expect(JSON.parse(String(calls.at(-1)!.init!.body))).toEqual({ data: { type: 'builds', id: 'b5', attributes: { expired: true } } })
    await expect(new AppStoreConnect('t', async () => new Response('nope', { status: 401 })).appId('x')).rejects.toThrow('answered 401')
  })

  it('finds one build by version and number, and sets its What to Test per locale', async () => {
    const calls: Array<{ url: string, method: string, body?: any }> = []
    const fakeFetch = async (url: string, init?: RequestInit): Promise<Response> => {
      const method = init?.method ?? 'GET'
      calls.push({ url, method, body: init?.body ? JSON.parse(String(init.body)) : undefined })
      const path = new URL(url).pathname
      if (path === '/v1/builds')
        return Response.json({ data: [{ id: 'b93', attributes: { version: '93', uploadedDate: '2026-10-21', processingState: 'PROCESSING', expired: false } }] })
      if (path === '/v1/builds/b93/betaBuildLocalizations')
        return Response.json({ data: [{ id: 'loc-en', attributes: { locale: 'en-US', whatsNew: null } }] })
      return Response.json({ data: {} }, { status: method === 'POST' ? 201 : 200 })
    }
    const api = new AppStoreConnect('token', fakeFetch)
    expect(await api.build('app', '1.0.0', 93)).toEqual({ id: 'b93', number: 93, uploadedDate: '2026-10-21', processingState: 'PROCESSING', expired: false })
    expect(decodeURIComponent(calls[0]!.url)).toContain('filter[version]=93&filter[preReleaseVersion.version]=1.0.0')

    await api.setWhatToTest('b93', { 'en-US': 'Features\n- A page', 'de-DE': 'Features\n- A page' })
    expect(calls[2]).toEqual({ url: 'https://api.appstoreconnect.apple.com/v1/betaBuildLocalizations/loc-en', method: 'PATCH', body: { data: { type: 'betaBuildLocalizations', id: 'loc-en', attributes: { whatsNew: 'Features\n- A page' } } } })
    expect(calls[3]!.method).toBe('POST')
    expect(calls[3]!.body).toEqual({ data: { type: 'betaBuildLocalizations', attributes: { locale: 'de-DE', whatsNew: 'Features\n- A page' }, relationships: { build: { data: { type: 'builds', id: 'b93' } } } } })
  })

  it('waits for the upload until it appears or the time is up', async () => {
    let clock = 0
    let looks = 0
    const options = { intervalMs: 30_000, now: () => clock, sleep: async (ms: number) => { clock += ms } }
    const appearsOnThirdLook = { build: async () => ++looks >= 3 ? build(93, 'PROCESSING') : null }
    expect((await waitForBuild(appearsOnThirdLook, 'app', '1.0.0', 93, { ...options, timeoutMs: 60 * 60_000 }))?.number).toBe(93)
    expect(clock).toBe(60_000)

    clock = 0
    looks = 0
    const never = { build: async () => { looks++; return null } }
    expect(await waitForBuild(never, 'app', '1.0.0', 93, { ...options, timeoutMs: 5 * 60_000 })).toBeNull()
    // At 0, 30 s, … and the five minutes themselves.
    expect(looks).toBe(11)
    looks = 0
    expect(await waitForBuild(never, 'app', '1.0.0', 93, { ...options, timeoutMs: 0 })).toBeNull()
    expect(looks).toBe(1)
  })
})
