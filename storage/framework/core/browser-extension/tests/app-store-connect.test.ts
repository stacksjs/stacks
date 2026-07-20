import type { ExtensionConfig } from '../src/types'
import { generateKeyPairSync } from 'node:crypto'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { AppStoreConnectClient, appStoreConnectToken, attachSafariBuilds, provisionSafariApp } from '../src/app-store-connect'

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

  it('aligns an editable macOS version and creates the iOS platform version', async () => {
    interface WriteBody {
      data: {
        type: string
        attributes?: Record<string, unknown>
        relationships?: Record<string, unknown>
      }
    }
    const writes: Array<{ method: string, url: string, body: WriteBody }> = []
    const fetcher = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/bundleIds?')) {
        const identifier = new URL(url).searchParams.get('filter[identifier]')
        return Response.json({ data: [{ type: 'bundleIds', id: identifier, attributes: { identifier, name: 'existing', platform: 'UNIVERSAL' } }] })
      }
      if (url.includes('/apps?')) {
        return Response.json({ data: [{
          type: 'apps',
          id: 'app-123',
          attributes: { bundleId: config.safariBundleId, name: config.name, primaryLocale: 'en-US', sku: 'test' },
        }] })
      }
      if (url.endsWith('/apps/app-123/appStoreVersions?limit=200')) {
        return Response.json({ data: [{
          type: 'appStoreVersions',
          id: 'mac-version',
          attributes: { platform: 'MAC_OS', versionString: '1.0', appStoreState: 'PREPARE_FOR_SUBMISSION' },
        }] })
      }

      const body = JSON.parse(String(init?.body)) as WriteBody
      writes.push({ method: init?.method ?? 'GET', url, body })
      if (init?.method === 'PATCH') {
        return Response.json({ data: {
          type: 'appStoreVersions',
          id: 'mac-version',
          attributes: { platform: 'MAC_OS', versionString: '0.2.0', appStoreState: 'PREPARE_FOR_SUBMISSION' },
        } })
      }
      return Response.json({ data: {
        type: 'appStoreVersions',
        id: 'ios-version',
        attributes: { platform: 'IOS', versionString: '0.2.0', appStoreState: 'PREPARE_FOR_SUBMISSION' },
      } }, { status: 201 })
    }) as typeof fetch

    const result = await provisionSafariApp({ ...config, safariPlatforms: ['macos', 'ios'] }, {
      keyId: 'KEY123',
      issuerId: 'issuer-123',
      keyPath,
      fetch: fetcher,
      baseUrl: 'https://example.test/v1',
      version: '0.2.0',
    })

    expect(result.appStoreVersions).toEqual([
      { platform: 'macos', version: '0.2.0', created: false, updated: true, id: 'mac-version' },
      { platform: 'ios', version: '0.2.0', created: true, updated: false, id: 'ios-version' },
    ])
    expect(writes.map(write => ({ method: write.method, path: new URL(write.url).pathname }))).toEqual([
      { method: 'PATCH', path: '/v1/appStoreVersions/mac-version' },
      { method: 'POST', path: '/v1/appStoreVersions' },
    ])
    expect(writes.at(1)?.body.data).toMatchObject({
      type: 'appStoreVersions',
      attributes: { platform: 'IOS', versionString: '0.2.0' },
      relationships: { app: { data: { type: 'apps', id: 'app-123' } } },
    })
  })

  it('waits for processed builds and selects each Apple platform version', async () => {
    const attached: Array<{ path: string, body: unknown }> = []
    const fetcher = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(String(input))
      if (url.pathname.endsWith('/builds')) {
        expect(url.searchParams.get('filter[app]')).toBe('app-123')
        expect(url.searchParams.get('filter[version]')).toBe('42')
        return Response.json({
          data: [
            {
              type: 'builds',
              id: 'mac-build',
              attributes: { version: '42', uploadedDate: '2026-01-01T00:00:00Z', expired: false, processingState: 'VALID' },
              relationships: { preReleaseVersion: { data: { type: 'preReleaseVersions', id: 'mac-prerelease' } } },
            },
            {
              type: 'builds',
              id: 'ios-build',
              attributes: { version: '42', uploadedDate: '2026-01-01T00:00:00Z', expired: false, processingState: 'VALID' },
              relationships: { preReleaseVersion: { data: { type: 'preReleaseVersions', id: 'ios-prerelease' } } },
            },
          ],
          included: [
            { type: 'preReleaseVersions', id: 'mac-prerelease', attributes: { version: '0.2.0', platform: 'MAC_OS' } },
            { type: 'preReleaseVersions', id: 'ios-prerelease', attributes: { version: '0.2.0', platform: 'IOS' } },
          ],
        })
      }

      attached.push({ path: url.pathname, body: JSON.parse(String(init?.body)) })
      return new Response(null, { status: 204 })
    }) as typeof fetch
    const client = new AppStoreConnectClient({
      keyId: 'KEY123',
      issuerId: 'issuer-123',
      keyPath,
      fetch: fetcher,
      baseUrl: 'https://example.test/v1',
    })

    const result = await attachSafariBuilds(client, 'app-123', [
      { platform: 'macos', version: '0.2.0', created: false, updated: false, id: 'mac-version' },
      { platform: 'ios', version: '0.2.0', created: false, updated: false, id: 'ios-version' },
    ], '42')

    expect(result).toEqual([
      { platform: 'macos', versionId: 'mac-version', buildId: 'mac-build', buildNumber: '42' },
      { platform: 'ios', versionId: 'ios-version', buildId: 'ios-build', buildNumber: '42' },
    ])
    expect(attached).toEqual([
      {
        path: '/v1/appStoreVersions/mac-version/relationships/build',
        body: { data: { type: 'builds', id: 'mac-build' } },
      },
      {
        path: '/v1/appStoreVersions/ios-version/relationships/build',
        body: { data: { type: 'builds', id: 'ios-build' } },
      },
    ])
  })
})
