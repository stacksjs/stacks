import { describe, expect, it } from 'bun:test'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { TestFlightBuild } from '../src/app-store-connect'
import { AppStoreConnect, appStoreConnectCredentials, appStoreConnectToken, buildsToExpire, tagForXcodeCloudRun } from '../src/app-store-connect'

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
})
