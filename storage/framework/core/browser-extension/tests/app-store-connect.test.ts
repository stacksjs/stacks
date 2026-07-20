import type { ExtensionConfig } from '../src/types'
import { generateKeyPairSync } from 'node:crypto'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { AppStoreConnectClient, appStoreConnectToken, attachSafariBuilds, provisionSafariApp } from '../src/app-store-connect'
import { prepareSafariAppStoreSubmission, submitSafariAppStore } from '../src/app-store-submission'

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
      { platform: 'macos', version: '0.2.0', created: false, updated: true, id: 'mac-version', status: 'ready', appStoreState: 'PREPARE_FOR_SUBMISSION' },
      { platform: 'ios', version: '0.2.0', created: true, updated: false, id: 'ios-version', status: 'ready', appStoreState: 'PREPARE_FOR_SUBMISSION' },
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

  it('queues a new version behind an active App Review submission', async () => {
    let writes = 0
    const fetcher = (async (input: string | URL | Request, init?: RequestInit) => {
      if (init?.method && init.method !== 'GET')
        writes += 1
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
      return Response.json({ data: [{
        type: 'appStoreVersions',
        id: 'mac-version',
        attributes: { platform: 'MAC_OS', versionString: '0.2.0', appStoreState: 'WAITING_FOR_REVIEW' },
      }] })
    }) as typeof fetch

    const result = await provisionSafariApp({ ...config, safariPlatforms: ['macos'] }, {
      keyId: 'KEY123',
      issuerId: 'issuer-123',
      keyPath,
      fetch: fetcher,
      baseUrl: 'https://example.test/v1',
      version: '0.2.1',
    })

    expect(writes).toBe(0)
    expect(result.appStoreVersions).toEqual([{
      platform: 'macos',
      version: '0.2.1',
      created: false,
      updated: false,
      id: 'mac-version',
      status: 'deferred',
      appStoreState: 'WAITING_FOR_REVIEW',
      reason: 'Safari macos version 0.2.1 is queued behind 0.2.0 (WAITING_FOR_REVIEW)',
    }])
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

  it('synchronizes metadata, uploads screenshots, and submits an existing version', async () => {
    const screenshotPath = join(dir, 'mac.png')
    writeFileSync(screenshotPath, Buffer.from('test screenshot'))
    const writes: Array<{ path: string, method: string, body?: any }> = []
    let screenshotCreated = false
    const fetcher = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(String(input))
      const method = init?.method ?? 'GET'
      const body = init?.body && typeof init.body === 'string' ? JSON.parse(init.body) : undefined
      if (method !== 'GET')
        writes.push({ path: url.pathname, method, body })
      if (url.hostname === 'upload.example.test')
        return new Response(null, { status: 200 })
      if (url.pathname.endsWith('/apps/app-123/appInfos'))
        return Response.json({ data: [{ type: 'appInfos', id: 'info-123', attributes: { appStoreState: 'PREPARE_FOR_SUBMISSION' } }] })
      if (url.pathname.endsWith('/appInfos/info-123/appInfoLocalizations'))
        return Response.json({ data: [{ type: 'appInfoLocalizations', id: 'info-loc', attributes: { locale: 'en-US' } }] })
      if (url.pathname.endsWith('/appPriceSchedules/app-123/manualPrices'))
        return Response.json({ data: [] })
      if (url.pathname.endsWith('/apps/app-123/appPricePoints'))
        return Response.json({ data: [{ type: 'appPricePoints', id: 'free-price', attributes: { customerPrice: '0.0' } }] })
      if (url.pathname.endsWith('/apps/app-123/appAvailabilityV2'))
        return Response.json({ errors: [{ detail: 'missing' }] }, { status: 404 })
      if (url.pathname.endsWith('/territories'))
        return Response.json({ data: [{ type: 'territories', id: 'USA', attributes: {} }] })
      if (url.pathname.endsWith('/appStoreVersions/mac-version/appStoreVersionLocalizations'))
        return Response.json({ data: [{ type: 'appStoreVersionLocalizations', id: 'version-loc', attributes: { locale: 'en-US' } }] })
      if (url.pathname.endsWith('/appStoreVersions/mac-version/appStoreReviewDetail'))
        return Response.json({ data: null })
      if (url.pathname.endsWith('/appStoreVersionLocalizations/version-loc/appScreenshotSets'))
        return Response.json({ data: [] })
      if (url.pathname.endsWith('/appScreenshotSets') && method === 'POST')
        return Response.json({ data: { type: 'appScreenshotSets', id: 'set-123', attributes: { screenshotDisplayType: 'APP_DESKTOP' } } }, { status: 201 })
      if (url.pathname.endsWith('/appScreenshotSets/set-123/appScreenshots'))
        return Response.json({ data: [] })
      if (url.pathname.endsWith('/appScreenshots') && method === 'POST') {
        screenshotCreated = true
        return Response.json({
          data: {
            type: 'appScreenshots',
            id: 'shot-123',
            attributes: {
              fileName: 'mac.png',
              fileSize: 15,
              uploadOperations: [{
                method: 'PUT',
                url: 'https://upload.example.test/part',
                length: 15,
                offset: 0,
                requestHeaders: [{ name: 'Content-Type', value: 'image/png' }],
              }],
            },
          },
        }, { status: 201 })
      }
      if (url.pathname.endsWith('/appScreenshots/shot-123') && method === 'GET')
        return Response.json({ data: { type: 'appScreenshots', id: 'shot-123', attributes: { fileName: 'mac.png', assetDeliveryState: { state: 'COMPLETE' } } } })
      if (url.pathname.endsWith('/apps/app-123/reviewSubmissions'))
        return Response.json({ data: [] })
      if (url.pathname.endsWith('/reviewSubmissions') && method === 'POST')
        return Response.json({ data: { type: 'reviewSubmissions', id: 'review-123', attributes: { platform: 'MAC_OS', state: 'READY_FOR_REVIEW' } } }, { status: 201 })
      if (url.pathname.endsWith('/reviewSubmissions/review-123/items'))
        return Response.json({ data: [], included: [] })
      return Response.json({ data: { type: 'result', id: 'ok', attributes: {} } })
    }) as typeof fetch
    const client = new AppStoreConnectClient({
      keyId: 'KEY123',
      issuerId: 'issuer-123',
      keyPath,
      fetch: fetcher,
      baseUrl: 'https://example.test/v1',
    })

    const result = await prepareSafariAppStoreSubmission(client, {
      ...config,
      safariAppStore: {
        subtitle: 'Private blocking',
        privacyPolicyUrl: 'https://example.test/privacy',
        description: 'A private Safari extension.',
        keywords: 'privacy,blocking',
        supportUrl: 'https://example.test/support',
        copyright: '2026 Example',
        primaryCategory: 'UTILITIES',
        contentRightsDeclaration: 'DOES_NOT_USE_THIRD_PARTY_CONTENT',
        price: '0',
        reviewContact: {
          firstName: 'Test',
          lastName: 'Reviewer',
          phone: '+1 555-555-0100',
          email: 'review@example.test',
        },
        screenshots: { APP_DESKTOP: ['mac.png'] },
        submitForReview: true,
      },
    }, 'app-123', [{ platform: 'macos', id: 'mac-version', buildId: 'mac-build' }], {
      cwd: dir,
      screenshotPollIntervalMs: 1,
    })

    expect(screenshotCreated).toBe(true)
    expect(result.reviewSubmissionIds).toEqual(['review-123'])
    expect(writes.some(write => write.path === '/v1/ageRatingDeclarations/info-123' && write.body.data.attributes.advertising === false)).toBe(true)
    expect(writes.some(write => write.path === '/v1/builds/mac-build' && write.body.data.attributes.usesNonExemptEncryption === false)).toBe(true)
    expect(writes.some(write => write.path === '/v1/reviewSubmissions/review-123' && write.body.data.attributes.submitted === true)).toBe(true)
  })

  it('keeps an active review submission intact when a submit command is retried', async () => {
    let writes = 0
    const fetcher = (async (input: string | URL | Request, init?: RequestInit) => {
      if (init?.method && init.method !== 'GET')
        writes += 1
      const url = new URL(String(input))
      if (url.pathname.endsWith('/apps')) {
        return Response.json({ data: [{
          type: 'apps',
          id: 'app-123',
          attributes: { bundleId: config.safariBundleId, name: config.name, primaryLocale: 'en-US', sku: 'test' },
        }] })
      }
      if (url.pathname.endsWith('/apps/app-123/appStoreVersions')) {
        return Response.json({ data: [{
          type: 'appStoreVersions',
          id: 'mac-version',
          attributes: { platform: 'MAC_OS', versionString: '0.2.0', appStoreState: 'WAITING_FOR_REVIEW' },
        }] })
      }
      if (url.pathname.endsWith('/appStoreVersions/mac-version/build'))
        return Response.json({ data: { type: 'builds', id: 'mac-build', attributes: {} } })
      if (url.pathname.endsWith('/appStoreVersions/mac-version/appStoreVersionLocalizations'))
        return Response.json({ data: [{ type: 'appStoreVersionLocalizations', id: 'version-loc', attributes: { locale: 'en-US' } }] })
      if (url.pathname.endsWith('/apps/app-123/reviewSubmissions')) {
        return Response.json({ data: [{
          type: 'reviewSubmissions',
          id: 'review-123',
          attributes: { platform: 'MAC_OS', state: 'WAITING_FOR_REVIEW' },
        }] })
      }
      if (url.pathname.endsWith('/reviewSubmissions/review-123/items')) {
        return Response.json({
          data: [{ type: 'reviewSubmissionItems', id: 'item-123', attributes: { state: 'READY_FOR_REVIEW' } }],
          included: [{ type: 'appStoreVersions', id: 'mac-version', attributes: {} }],
        })
      }
      throw new Error(`Unexpected request ${url.pathname}`)
    }) as typeof fetch

    const result = await submitSafariAppStore({
      ...config,
      safariPlatforms: ['macos'],
      safariAppStore: {
        subtitle: 'Private blocking',
        privacyPolicyUrl: 'https://example.test/privacy',
        description: 'A private Safari extension.',
        keywords: 'privacy,blocking',
        supportUrl: 'https://example.test/support',
        copyright: '2026 Example',
        primaryCategory: 'UTILITIES',
        contentRightsDeclaration: 'DOES_NOT_USE_THIRD_PARTY_CONTENT',
        price: '0',
        reviewContact: {
          firstName: 'Test',
          lastName: 'Reviewer',
          phone: '+1 555-555-0100',
          email: 'review@example.test',
        },
        screenshots: {},
        submitForReview: true,
      },
    }, {
      version: '0.2.0',
      keyId: 'KEY123',
      issuerId: 'issuer-123',
      keyPath,
      fetch: fetcher,
      baseUrl: 'https://example.test/v1',
    })

    expect(result.reviewSubmissionIds).toEqual(['review-123'])
    expect(writes).toBe(0)
  })
})
