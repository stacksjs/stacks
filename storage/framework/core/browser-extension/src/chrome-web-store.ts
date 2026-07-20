import type { ChromeWebStoreConfig, ExtensionConfig } from './types'
import { createPrivateKey, sign } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { packageExtension } from './package'

const chromeWebStoreScope = 'https://www.googleapis.com/auth/chromewebstore'
const chromeWebStoreBaseUrl = 'https://chromewebstore.googleapis.com'

export interface GoogleServiceAccount {
  client_email: string
  private_key: string
  token_uri?: string
}

export interface ChromeWebStoreAuth {
  /** Ready-to-use OAuth access token. @default CHROME_WEB_STORE_ACCESS_TOKEN */
  accessToken?: string
  /** Google service-account JSON key. @default CHROME_WEB_STORE_SERVICE_ACCOUNT_PATH or GOOGLE_APPLICATION_CREDENTIALS */
  serviceAccountPath?: string
}

export interface ChromeWebStoreClientOptions extends ChromeWebStoreAuth {
  baseUrl?: string
  fetch?: typeof globalThis.fetch
  now?: () => number
  wait?: (milliseconds: number) => Promise<void>
}

export interface ChromeWebStoreStatus {
  name: string
  itemId: string
  lastAsyncUploadState?: 'UPLOAD_STATE_UNSPECIFIED' | 'SUCCEEDED' | 'IN_PROGRESS' | 'FAILED' | 'NOT_FOUND'
  publishedItemRevisionStatus?: { state: string, distributionChannels?: Array<{ deployPercentage: number, crxVersion: string }> }
  submittedItemRevisionStatus?: { state: string, distributionChannels?: Array<{ deployPercentage: number, crxVersion: string }> }
  takenDown?: boolean
  warned?: boolean
}

export interface ChromeUploadResult {
  name: string
  itemId: string
  crxVersion?: string
  uploadState: 'UPLOAD_STATE_UNSPECIFIED' | 'SUCCEEDED' | 'IN_PROGRESS' | 'FAILED' | 'NOT_FOUND'
}

export interface ChromePublishResult {
  name: string
  itemId: string
  state: string
  warningInfo?: { warnings?: Array<{ reason: string, description: string }> }
}

export interface ChromeDeferredPublishResult {
  state: string
  submittedVersion?: string
  reason: string
}

export interface ChromePublishedVersionResult {
  state: string
  version: string
  reason: string
}

export interface ChromeWebStorePublishResult {
  packagePath: string
  upload?: ChromeUploadResult
  publish?: ChromePublishResult
  /** The requested release is queued behind a revision that Google is reviewing. */
  deferred?: ChromeDeferredPublishResult
  /** The requested release is already live in the configured distribution channel. */
  alreadyPublished?: ChromePublishedVersionResult
}

interface GoogleTokenResponse {
  access_token?: string
  error?: string
  error_description?: string
}

function base64urlJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url')
}

/** Build the RS256 assertion Google exchanges for a short-lived OAuth token. */
export function chromeWebStoreServiceAccountAssertion(serviceAccount: GoogleServiceAccount, now = Math.floor(Date.now() / 1000)): string {
  const tokenUri = serviceAccount.token_uri ?? 'https://oauth2.googleapis.com/token'
  const input = `${base64urlJson({ alg: 'RS256', typ: 'JWT' })}.${base64urlJson({
    iss: serviceAccount.client_email,
    scope: chromeWebStoreScope,
    aud: tokenUri,
    iat: now,
    exp: now + 3600,
  })}`
  let key: ReturnType<typeof createPrivateKey>
  try {
    key = createPrivateKey(serviceAccount.private_key)
  }
  catch (error) {
    throw new Error(`[browser-extension] Chrome Web Store service-account key could not be parsed: ${error instanceof Error ? error.message : String(error)}`)
  }
  return `${input}.${sign('sha256', Buffer.from(input), key).toString('base64url')}`
}

async function resolveChromeAccessToken(options: ChromeWebStoreClientOptions): Promise<string> {
  const supplied = options.accessToken ?? process.env.CHROME_WEB_STORE_ACCESS_TOKEN
  if (supplied)
    return supplied

  const configuredPath = options.serviceAccountPath
    ?? process.env.CHROME_WEB_STORE_SERVICE_ACCOUNT_PATH
    ?? process.env.GOOGLE_APPLICATION_CREDENTIALS
  if (!configuredPath)
    throw new Error('[browser-extension] missing Chrome Web Store credentials: CHROME_WEB_STORE_SERVICE_ACCOUNT_PATH or CHROME_WEB_STORE_ACCESS_TOKEN')
  const keyPath = resolve(configuredPath)
  if (!existsSync(keyPath))
    throw new Error(`[browser-extension] Chrome Web Store service-account key not found: ${keyPath}`)

  let serviceAccount: GoogleServiceAccount
  try {
    serviceAccount = JSON.parse(readFileSync(keyPath, 'utf8')) as GoogleServiceAccount
  }
  catch (error) {
    throw new Error(`[browser-extension] Chrome Web Store service-account JSON could not be parsed: ${error instanceof Error ? error.message : String(error)}`)
  }
  if (!serviceAccount.client_email || !serviceAccount.private_key)
    throw new Error('[browser-extension] Chrome Web Store service-account JSON needs client_email and private_key')

  const tokenUri = serviceAccount.token_uri ?? 'https://oauth2.googleapis.com/token'
  const response = await (options.fetch ?? globalThis.fetch)(tokenUri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: chromeWebStoreServiceAccountAssertion(serviceAccount, options.now?.()),
    }),
  })
  const body = await response.json().catch(() => ({})) as GoogleTokenResponse
  if (!response.ok || !body.access_token)
    throw new Error(`[browser-extension] Google OAuth token exchange failed (${response.status})${body.error_description ? `: ${body.error_description}` : ''}`)
  return body.access_token
}

function storeItemName(config: ChromeWebStoreConfig): string {
  return `publishers/${encodeURIComponent(config.publisherId)}/items/${encodeURIComponent(config.itemId)}`
}

export class ChromeWebStoreClient {
  private readonly options: ChromeWebStoreClientOptions
  private readonly baseUrl: string
  private accessToken?: Promise<string>

  constructor(options: ChromeWebStoreClientOptions = {}) {
    this.options = options
    this.baseUrl = (options.baseUrl ?? chromeWebStoreBaseUrl).replace(/\/$/, '')
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    this.accessToken ??= resolveChromeAccessToken(this.options)
    const response = await (this.options.fetch ?? globalThis.fetch)(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${await this.accessToken}`,
        ...init.headers,
      },
    })
    if (!response.ok) {
      const body = await response.json().catch(() => ({})) as { error?: { message?: string }, message?: string }
      const detail = body.error?.message ?? body.message
      throw new Error(`[browser-extension] Chrome Web Store ${init.method ?? 'GET'} ${path} failed (${response.status})${detail ? `: ${detail}` : ''}`)
    }
    return await response.json() as T
  }

  fetchStatus(config: ChromeWebStoreConfig): Promise<ChromeWebStoreStatus> {
    return this.request(`/v2/${storeItemName(config)}:fetchStatus`)
  }

  async upload(config: ChromeWebStoreConfig, packagePath: string): Promise<ChromeUploadResult> {
    const file = Bun.file(resolve(packagePath))
    if (!await file.exists())
      throw new Error(`[browser-extension] Chrome package not found: ${resolve(packagePath)}`)
    return await this.request(`/upload/v2/${storeItemName(config)}:upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/zip' },
      body: new Uint8Array(await file.arrayBuffer()),
    })
  }

  publish(config: ChromeWebStoreConfig, options: { blockOnWarnings?: boolean } = {}): Promise<ChromePublishResult> {
    if (config.deployPercentage !== undefined && (!Number.isInteger(config.deployPercentage) || config.deployPercentage < 0 || config.deployPercentage > 100))
      throw new Error('[browser-extension] chromeWebStore.deployPercentage must be an integer from 0 to 100')
    const body: Record<string, unknown> = {
      publishType: config.publishType ?? 'DEFAULT_PUBLISH',
      skipReview: config.skipReview ?? false,
      blockOnWarnings: options.blockOnWarnings ?? true,
    }
    if (config.deployPercentage !== undefined)
      body.deployInfos = [{ deployPercentage: config.deployPercentage }]
    return this.request(`/v2/${storeItemName(config)}:publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  async waitForUpload(config: ChromeWebStoreConfig, maxAttempts = 30): Promise<ChromeWebStoreStatus> {
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const status = await this.fetchStatus(config)
      if (status.lastAsyncUploadState !== 'IN_PROGRESS') {
        if (status.lastAsyncUploadState === 'FAILED')
          throw new Error('[browser-extension] Chrome Web Store package processing failed')
        return status
      }
      await (this.options.wait ?? (milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds))))(2000)
    }
    throw new Error('[browser-extension] Chrome Web Store package processing timed out')
  }
}

export interface ChromeWebStorePublishOptions extends ChromeWebStoreClientOptions {
  version: string
  cwd?: string
  packagePath?: string
  /** Upload the package without submitting it for review. @default false */
  uploadOnly?: boolean
  /** Fail publication when Chrome reports warnings. @default true */
  blockOnWarnings?: boolean
}

function pendingReview(status: ChromeWebStoreStatus): ChromeDeferredPublishResult | undefined {
  if (status.submittedItemRevisionStatus?.state !== 'PENDING_REVIEW')
    return undefined

  const submittedVersion = status.submittedItemRevisionStatus.distributionChannels?.[0]?.crxVersion
  return {
    state: status.submittedItemRevisionStatus.state,
    submittedVersion,
    reason: submittedVersion
      ? `Chrome Web Store version ${submittedVersion} is already pending review`
      : 'A Chrome Web Store revision is already pending review',
  }
}

function publishedVersion(status: ChromeWebStoreStatus, version: string): ChromePublishedVersionResult | undefined {
  const published = status.publishedItemRevisionStatus
  if (!published || !['PUBLISHED', 'PUBLISHED_TO_TESTERS'].includes(published.state))
    return undefined
  if (!published.distributionChannels?.some(channel => channel.crxVersion === version))
    return undefined
  return {
    state: published.state,
    version,
    reason: `Chrome Web Store version ${version} is already ${published.state.toLowerCase().replaceAll('_', ' ')}`,
  }
}

/** Build, package, upload, and optionally submit an existing Chrome Web Store item. */
export async function publishChromeExtension(config: ExtensionConfig, options: ChromeWebStorePublishOptions): Promise<ChromeWebStorePublishResult> {
  if (!config.chromeWebStore)
    throw new Error('[browser-extension] Chrome publishing needs chromeWebStore.publisherId and chromeWebStore.itemId in config/extension.ts')
  const cwd = options.cwd ?? process.cwd()
  const packagePath = options.packagePath ?? await packageExtension(config, { target: 'chrome', version: options.version, cwd })
  const client = new ChromeWebStoreClient(options)
  const status = await client.fetchStatus(config.chromeWebStore)
  const alreadyPublished = publishedVersion(status, options.version)
  if (alreadyPublished)
    return { packagePath, alreadyPublished }
  const deferred = pendingReview(status)
  if (deferred)
    return { packagePath, deferred }

  const upload = await client.upload(config.chromeWebStore, packagePath)
  if (upload.uploadState === 'IN_PROGRESS')
    await client.waitForUpload(config.chromeWebStore)
  else if (upload.uploadState !== 'SUCCEEDED')
    throw new Error(`[browser-extension] Chrome Web Store upload failed with state ${upload.uploadState}`)

  return {
    packagePath,
    upload,
    publish: options.uploadOnly ? undefined : await client.publish(config.chromeWebStore, { blockOnWarnings: options.blockOnWarnings }),
  }
}
