import type { ChromeWebStoreConfig, ExtensionConfig } from '../src/types'
import { generateKeyPairSync, verify } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { ChromeWebStoreClient, chromeWebStoreServiceAccountAssertion } from '../src/chrome-web-store'
import { firefoxListingMetadata, firefoxSignArgs, resolveWebExtExecutable } from '../src/firefox-addons'

const chromeConfig: ChromeWebStoreConfig = {
  publisherId: 'publisher-123',
  itemId: 'extension-456',
  deployPercentage: 25,
}

describe('Chrome Web Store API v2', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'browser-extension-chrome-store-'))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('generates a signed service-account assertion with the Web Store scope', () => {
    const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
    const assertion = chromeWebStoreServiceAccountAssertion({
      client_email: 'publisher@example.iam.gserviceaccount.com',
      private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
      token_uri: 'https://oauth2.example.test/token',
    }, 1000)
    const [header, payload, signature] = assertion.split('.')
    expect(JSON.parse(Buffer.from(header!, 'base64url').toString())).toEqual({ alg: 'RS256', typ: 'JWT' })
    expect(JSON.parse(Buffer.from(payload!, 'base64url').toString())).toEqual({
      iss: 'publisher@example.iam.gserviceaccount.com',
      scope: 'https://www.googleapis.com/auth/chromewebstore',
      aud: 'https://oauth2.example.test/token',
      iat: 1000,
      exp: 4600,
    })
    expect(verify('sha256', Buffer.from(`${header}.${payload}`), publicKey, Buffer.from(signature!, 'base64url'))).toBe(true)
  })

  it('uploads, fetches status, and submits an existing item', async () => {
    const packagePath = join(dir, 'extension.zip')
    await Bun.write(packagePath, 'zip-fixture')
    const requests: Array<{ url: string, init?: RequestInit }> = []
    const fetcher = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      requests.push({ url, init })
      if (url.includes('/upload/'))
        return Response.json({ name: 'item', itemId: 'extension-456', crxVersion: '1.2.3', uploadState: 'SUCCEEDED' })
      if (url.endsWith(':publish'))
        return Response.json({ name: 'item', itemId: 'extension-456', state: 'PENDING_REVIEW' })
      return Response.json({ name: 'item', itemId: 'extension-456', publishedItemRevisionStatus: { state: 'PUBLISHED' } })
    }) as typeof fetch
    const client = new ChromeWebStoreClient({
      accessToken: 'test-access-token',
      baseUrl: 'https://chrome.example.test',
      fetch: fetcher,
    })

    expect((await client.upload(chromeConfig, packagePath)).uploadState).toBe('SUCCEEDED')
    expect((await client.fetchStatus(chromeConfig)).publishedItemRevisionStatus?.state).toBe('PUBLISHED')
    expect((await client.publish(chromeConfig)).state).toBe('PENDING_REVIEW')
    expect(requests.map(request => request.url)).toEqual([
      'https://chrome.example.test/upload/v2/publishers/publisher-123/items/extension-456:upload',
      'https://chrome.example.test/v2/publishers/publisher-123/items/extension-456:fetchStatus',
      'https://chrome.example.test/v2/publishers/publisher-123/items/extension-456:publish',
    ])
    expect(requests.every(request => new Headers(request.init?.headers).get('Authorization') === 'Bearer test-access-token')).toBe(true)
    expect(JSON.parse(String(requests[2]?.init?.body))).toEqual({
      publishType: 'DEFAULT_PUBLISH',
      skipReview: false,
      blockOnWarnings: true,
      deployInfos: [{ deployPercentage: 25 }],
    })
  })
})

describe('Firefox Add-ons metadata', () => {
  const config: ExtensionConfig = {
    name: 'Test Extension',
    description: 'Private and fast.',
    geckoId: 'test@example.com',
  }

  it('derives first-listing AMO metadata from extension config', () => {
    expect(firefoxListingMetadata(config, {
      license: 'MIT',
      categories: ['privacy-security'],
      homepage: 'https://example.com',
      supportEmail: 'support@example.com',
    })).toEqual({
      version: { license: 'MIT' },
      categories: { firefox: ['privacy-security'] },
      summary: { 'en-US': 'Private and fast.' },
      homepage: { 'en-US': 'https://example.com' },
      support_email: { 'en-US': 'support@example.com' },
      requires_payment: false,
    })
  })

  it('allows metadata-free updates and rejects incomplete first-listing metadata', () => {
    expect(firefoxListingMetadata(config, {})).toBeUndefined()
    expect(() => firefoxListingMetadata(config, { license: 'MIT' })).toThrow('both firefoxAddons.license and firefoxAddons.categories')
  })

  it('resolves the declared web-ext dependency when it is absent from PATH', () => {
    const executable = resolveWebExtExecutable(() => null)
    expect(executable).toEndWith('/web-ext/bin/web-ext.js')
  })

  it('uses only options supported by current web-ext releases', () => {
    expect(firefoxSignArgs({
      executable: '/bin/web-ext',
      sourceDir: '/extension',
      artifactsDir: '/artifacts',
      channel: 'listed',
      timeout: 300000,
      approvalTimeout: 0,
    })).toEqual([
      '/bin/web-ext',
      'sign',
      '--source-dir', '/extension',
      '--artifacts-dir', '/artifacts',
      '--channel', 'listed',
      '--timeout', '300000',
      '--approval-timeout', '0',
      '--no-input',
    ])
  })
})
