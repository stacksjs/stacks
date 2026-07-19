import type { ExtensionConfig } from '../src/types'
import { generateKeyPairSync } from 'node:crypto'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { appStoreConnectToken, provisionSafariApp } from '../src/app-store-connect'

const config: ExtensionConfig = {
  name: 'Test Extension',
  description: 'Safari provisioning fixture.',
  safariBundleId: 'com.example.TestExtension',
}

describe('App Store Connect Safari provisioning', () => {
  let dir: string
  let keyPath: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'browser-extension-asc-'))
    keyPath = join(dir, 'AuthKey_TEST.p8')
    const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' })
    writeFileSync(keyPath, privateKey.export({ type: 'pkcs8', format: 'pem' }))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('generates a short-lived ES256 team token', () => {
    const token = appStoreConnectToken({ keyId: 'KEY123', issuerId: 'issuer-123', keyPath }, 1000)
    const [encodedHeader, encodedPayload, encodedSignature] = token.split('.')
    expect(JSON.parse(Buffer.from(encodedHeader!, 'base64url').toString())).toEqual({ alg: 'ES256', kid: 'KEY123', typ: 'JWT' })
    expect(JSON.parse(Buffer.from(encodedPayload!, 'base64url').toString())).toEqual({
      iss: 'issuer-123',
      iat: 1000,
      exp: 1120,
      aud: 'appstoreconnect-v1',
    })
    expect(Buffer.from(encodedSignature!, 'base64url')).toHaveLength(64)
  })

  it('keeps existing Bundle IDs and detects the app record', async () => {
    const requests: Array<{ url: string, init?: RequestInit }> = []
    const fetcher = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      requests.push({ url, init })
      const identifier = new URL(url).searchParams.get('filter[identifier]')
      if (url.includes('/bundleIds')) {
        return Response.json({ data: [{
          type: 'bundleIds',
          id: identifier,
          attributes: { identifier, name: 'existing', platform: 'MAC_OS' },
        }] })
      }
      return Response.json({ data: [{
        type: 'apps',
        id: 'app-123',
        attributes: { bundleId: config.safariBundleId, name: config.name, primaryLocale: 'en-US', sku: 'test' },
      }] })
    }) as typeof fetch

    const result = await provisionSafariApp(config, {
      keyId: 'KEY123',
      issuerId: 'issuer-123',
      keyPath,
      fetch: fetcher,
      baseUrl: 'https://example.test/v1',
    })

    expect(result.container).toEqual({ identifier: 'com.example.TestExtension', exists: true, created: false })
    expect(result.extension).toEqual({ identifier: 'com.example.TestExtension.Extension', exists: true, created: false })
    expect(result.appRecord).toEqual({ exists: true, id: 'app-123' })
    expect(requests).toHaveLength(3)
    expect(requests.every(request => String(new Headers(request.init?.headers).get('Authorization')).startsWith('Bearer '))).toBe(true)
    expect(requests.some(request => request.init?.method === 'POST')).toBe(false)
  })

  it('registers both missing macOS Bundle IDs through the official API', async () => {
    const created: Array<Record<string, unknown>> = []
    const fetcher = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/bundleIds?'))
        return Response.json({ data: [] })
      if (url.endsWith('/bundleIds') && init?.method === 'POST') {
        const body = JSON.parse(String(init.body))
        created.push(body.data.attributes)
        return Response.json({ data: { ...body.data, id: `bundle-${created.length}` } }, { status: 201 })
      }
      return Response.json({ data: [] })
    }) as typeof fetch

    const result = await provisionSafariApp(config, {
      keyId: 'KEY123',
      issuerId: 'issuer-123',
      keyPath,
      fetch: fetcher,
      baseUrl: 'https://example.test/v1',
    })

    expect(created).toEqual([
      { identifier: 'com.example.TestExtension', name: 'Test Extension', platform: 'MAC_OS' },
      { identifier: 'com.example.TestExtension.Extension', name: 'Test Extension Safari Extension', platform: 'MAC_OS' },
    ])
    expect(result.container.created).toBe(true)
    expect(result.extension.created).toBe(true)
    expect(result.appRecord.exists).toBe(false)
  })

  it('does not mutate Apple resources in check mode', async () => {
    let requestCount = 0
    const fetcher = (async () => {
      requestCount += 1
      return Response.json({ data: [] })
    }) as typeof fetch

    const result = await provisionSafariApp(config, {
      keyId: 'KEY123',
      issuerId: 'issuer-123',
      keyPath,
      fetch: fetcher,
      baseUrl: 'https://example.test/v1',
      checkOnly: true,
    })

    expect(requestCount).toBe(3)
    expect(result.container).toEqual({ identifier: 'com.example.TestExtension', exists: false, created: false })
    expect(result.extension).toEqual({ identifier: 'com.example.TestExtension.Extension', exists: false, created: false })
  })
})
