import type { ExtensionConfig, SafariPlatform } from './types'
import type { AppStoreConnectAuth } from './safari'
import { createPrivateKey, sign } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolveAppStoreConnectAuth } from './safari'

const appStoreConnectBaseUrl = 'https://api.appstoreconnect.apple.com/v1'

export type BundleIdPlatform = 'IOS' | 'MAC_OS' | 'UNIVERSAL'

export interface AppStoreConnectResource<T extends Record<string, unknown>> {
  type: string
  id: string
  attributes: T
  relationships?: Record<string, { data?: { type: string, id: string } | null }>
}

export interface BundleIdAttributes extends Record<string, unknown> {
  identifier: string
  name: string
  platform: BundleIdPlatform
  seedId?: string
}

export interface AppAttributes extends Record<string, unknown> {
  bundleId: string
  name: string
  primaryLocale: string
  sku: string
}

export type AppStoreVersionPlatform = 'IOS' | 'MAC_OS'

export interface AppStoreVersionAttributes extends Record<string, unknown> {
  platform: AppStoreVersionPlatform
  versionString: string
  appStoreState: string
}

export interface BuildAttributes extends Record<string, unknown> {
  version: string
  uploadedDate: string
  expired: boolean
  processingState: string
}

export interface PreReleaseVersionAttributes extends Record<string, unknown> {
  version: string
  platform: AppStoreVersionPlatform
}

export interface AppStoreBuildResult {
  id: string
  buildNumber: string
  version: string
  platform: AppStoreVersionPlatform
  processingState: string
}

export interface AppStoreConnectClientOptions extends AppStoreConnectAuth {
  /** Override the API base URL, primarily for tests. */
  baseUrl?: string
  /** Override fetch, primarily for tests. */
  fetch?: typeof globalThis.fetch
  /** Override the current Unix time, primarily for tests. */
  now?: () => number
}

interface ApiListResponse<T extends Record<string, unknown>> {
  data: Array<AppStoreConnectResource<T>>
  included?: Array<AppStoreConnectResource<Record<string, unknown>>>
}

interface ApiResourceResponse<T extends Record<string, unknown>> {
  data: AppStoreConnectResource<T>
}

interface ApiErrorResponse {
  errors?: Array<{ status?: string, code?: string, title?: string, detail?: string }>
}

function base64urlJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url')
}

/** Generate the short-lived ES256 team token required by App Store Connect. */
export function appStoreConnectToken(auth: Required<AppStoreConnectAuth>, now = Math.floor(Date.now() / 1000)): string {
  const header = { alg: 'ES256', kid: auth.keyId, typ: 'JWT' }
  const payload = {
    iss: auth.issuerId,
    iat: now,
    exp: now + 120,
    aud: 'appstoreconnect-v1',
  }
  const input = `${base64urlJson(header)}.${base64urlJson(payload)}`

  let key: ReturnType<typeof createPrivateKey>
  try {
    key = createPrivateKey(readFileSync(auth.keyPath, 'utf8'))
  }
  catch (error) {
    throw new Error(`[browser-extension] App Store Connect API key could not be parsed: ${error instanceof Error ? error.message : String(error)}`)
  }

  const signature = sign('sha256', Buffer.from(input), { key, dsaEncoding: 'ieee-p1363' })
  return `${input}.${signature.toString('base64url')}`
}

/** Minimal official App Store Connect client for Safari provisioning checks. */
export class AppStoreConnectClient {
  private readonly auth: Required<AppStoreConnectAuth>
  private readonly baseUrl: string
  private readonly fetcher: typeof globalThis.fetch
  private readonly now: () => number

  constructor(options: AppStoreConnectClientOptions = {}) {
    this.auth = resolveAppStoreConnectAuth(options)
    this.baseUrl = (options.baseUrl ?? appStoreConnectBaseUrl).replace(/\/$/, '')
    this.fetcher = options.fetch ?? globalThis.fetch
    this.now = options.now ?? (() => Math.floor(Date.now() / 1000))
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await this.fetcher(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${appStoreConnectToken(this.auth, this.now())}`,
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
      },
    })
    if (!response.ok) {
      const body = await response.json().catch(() => ({})) as ApiErrorResponse
      const details = body.errors?.map(error => error.detail ?? error.title ?? error.code).filter(Boolean).join('; ')
      throw new Error(`[browser-extension] App Store Connect ${init.method ?? 'GET'} ${path} failed (${response.status})${details ? `: ${details}` : ''}`)
    }
    if (response.status === 204)
      return undefined as T
    return await response.json() as T
  }

  async findBundleId(identifier: string): Promise<AppStoreConnectResource<BundleIdAttributes> | undefined> {
    const query = new URLSearchParams({ 'filter[identifier]': identifier })
    const response = await this.request<ApiListResponse<BundleIdAttributes>>(`/bundleIds?${query}`)
    return response.data.find(bundleId => bundleId.attributes.identifier === identifier)
  }

  async registerBundleId(identifier: string, name: string, platform: BundleIdPlatform = 'MAC_OS'): Promise<AppStoreConnectResource<BundleIdAttributes>> {
    const response = await this.request<ApiResourceResponse<BundleIdAttributes>>('/bundleIds', {
      method: 'POST',
      body: JSON.stringify({
        data: {
          type: 'bundleIds',
          attributes: { identifier, name, platform },
        },
      }),
    })
    return response.data
  }

  async ensureBundleId(identifier: string, name: string, options: { checkOnly?: boolean, platform?: BundleIdPlatform } = {}): Promise<{ bundleId?: AppStoreConnectResource<BundleIdAttributes>, created: boolean }> {
    const existing = await this.findBundleId(identifier)
    if (existing)
      return { bundleId: existing, created: false }
    if (options.checkOnly)
      return { created: false }
    return {
      bundleId: await this.registerBundleId(identifier, name, options.platform),
      created: true,
    }
  }

  async findApp(bundleId: string): Promise<AppStoreConnectResource<AppAttributes> | undefined> {
    const query = new URLSearchParams({ 'filter[bundleId]': bundleId })
    const response = await this.request<ApiListResponse<AppAttributes>>(`/apps?${query}`)
    return response.data.find(app => app.attributes.bundleId === bundleId)
  }

  async listAppStoreVersions(appId: string): Promise<Array<AppStoreConnectResource<AppStoreVersionAttributes>>> {
    const response = await this.request<ApiListResponse<AppStoreVersionAttributes>>(`/apps/${appId}/appStoreVersions?limit=200`)
    return response.data
  }

  async createAppStoreVersion(appId: string, platform: AppStoreVersionPlatform, versionString: string): Promise<AppStoreConnectResource<AppStoreVersionAttributes>> {
    const response = await this.request<ApiResourceResponse<AppStoreVersionAttributes>>('/appStoreVersions', {
      method: 'POST',
      body: JSON.stringify({
        data: {
          type: 'appStoreVersions',
          attributes: { platform, versionString },
          relationships: { app: { data: { type: 'apps', id: appId } } },
        },
      }),
    })
    return response.data
  }

  async updateAppStoreVersion(versionId: string, versionString: string): Promise<AppStoreConnectResource<AppStoreVersionAttributes>> {
    const response = await this.request<ApiResourceResponse<AppStoreVersionAttributes>>(`/appStoreVersions/${versionId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        data: {
          type: 'appStoreVersions',
          id: versionId,
          attributes: { versionString },
        },
      }),
    })
    return response.data
  }

  async listBuilds(appId: string, buildNumber: string): Promise<AppStoreBuildResult[]> {
    const query = new URLSearchParams({
      'filter[app]': appId,
      'filter[version]': buildNumber,
      'include': 'preReleaseVersion',
      'limit': '20',
      'fields[builds]': 'version,uploadedDate,expired,processingState,preReleaseVersion',
      'fields[preReleaseVersions]': 'version,platform',
    })
    const response = await this.request<ApiListResponse<BuildAttributes>>(`/builds?${query}`)
    const preReleaseVersions = new Map(
      (response.included ?? [])
        .filter(item => item.type === 'preReleaseVersions')
        .map(item => [item.id, item.attributes as PreReleaseVersionAttributes]),
    )

    return response.data.flatMap((build) => {
      const preReleaseVersionId = build.relationships?.preReleaseVersion?.data?.id
      const preReleaseVersion = preReleaseVersionId ? preReleaseVersions.get(preReleaseVersionId) : undefined
      if (!preReleaseVersion)
        return []
      return [{
        id: build.id,
        buildNumber: build.attributes.version,
        version: preReleaseVersion.version,
        platform: preReleaseVersion.platform,
        processingState: build.attributes.processingState,
      }]
    })
  }

  async attachBuild(versionId: string, buildId: string): Promise<void> {
    await this.request<void>(`/appStoreVersions/${versionId}/relationships/build`, {
      method: 'PATCH',
      body: JSON.stringify({ data: { type: 'builds', id: buildId } }),
    })
  }
}

const editableVersionStates = new Set([
  'PREPARE_FOR_SUBMISSION',
  'DEVELOPER_REJECTED',
  'REJECTED',
  'METADATA_REJECTED',
])

function appStorePlatform(platform: SafariPlatform): AppStoreVersionPlatform {
  return platform === 'ios' ? 'IOS' : 'MAC_OS'
}

export interface SafariAppStoreVersionResult {
  platform: SafariPlatform
  version: string
  created: boolean
  updated: boolean
  id: string
}

export interface SafariBuildAttachmentResult {
  platform: SafariPlatform
  versionId: string
  buildId: string
  buildNumber: string
}

export interface AttachSafariBuildsOptions {
  /** Maximum time to wait for App Store Connect processing. @default 20 minutes */
  timeoutMs?: number
  /** Delay between App Store Connect processing checks. @default 15 seconds */
  pollIntervalMs?: number
}

/** Wait for the uploaded binaries to process, then select them for their App Store versions. */
export async function attachSafariBuilds(
  client: AppStoreConnectClient,
  appId: string,
  versions: SafariAppStoreVersionResult[],
  buildNumber: string,
  options: AttachSafariBuildsOptions = {},
): Promise<SafariBuildAttachmentResult[]> {
  const timeoutMs = options.timeoutMs ?? 20 * 60_000
  const pollIntervalMs = options.pollIntervalMs ?? 15_000
  const deadline = Date.now() + timeoutMs
  const pending = new Map(versions.map(version => [appStorePlatform(version.platform), version]))

  while (true) {
    const builds = await client.listBuilds(appId, buildNumber)
    const attachments: SafariBuildAttachmentResult[] = []

    for (const [platform, version] of pending) {
      const build = builds.find(item => item.platform === platform && item.version === version.version)
      if (!build)
        continue
      if (build.processingState === 'FAILED' || build.processingState === 'INVALID')
        throw new Error(`[browser-extension] Safari ${version.platform} build ${buildNumber} failed App Store Connect processing (${build.processingState})`)
      if (build.processingState !== 'VALID')
        continue
      attachments.push({
        platform: version.platform,
        versionId: version.id,
        buildId: build.id,
        buildNumber,
      })
    }

    if (attachments.length === pending.size) {
      for (const attachment of attachments)
        await client.attachBuild(attachment.versionId, attachment.buildId)
      return attachments
    }

    if (Date.now() >= deadline) {
      const waiting = [...pending.values()].map(item => item.platform).join(', ')
      throw new Error(`[browser-extension] timed out waiting for Safari ${waiting} build ${buildNumber} to finish App Store Connect processing`)
    }
    await Bun.sleep(pollIntervalMs)
  }
}

async function ensureConfiguredAppStoreVersions(client: AppStoreConnectClient, appId: string, platforms: SafariPlatform[], version: string): Promise<SafariAppStoreVersionResult[]> {
  const versions = await client.listAppStoreVersions(appId)
  const results: SafariAppStoreVersionResult[] = []
  for (const platform of [...new Set(platforms)]) {
    const applePlatform = appStorePlatform(platform)
    const exact = versions.find(item => item.attributes.platform === applePlatform && item.attributes.versionString === version)
    if (exact) {
      results.push({ platform, version, created: false, updated: false, id: exact.id })
      continue
    }

    const editable = versions.find(item => item.attributes.platform === applePlatform && editableVersionStates.has(item.attributes.appStoreState))
    if (editable) {
      const updated = await client.updateAppStoreVersion(editable.id, version)
      editable.attributes.versionString = version
      results.push({ platform, version, created: false, updated: true, id: updated.id })
      continue
    }

    const created = await client.createAppStoreVersion(appId, applePlatform, version)
    versions.push(created)
    results.push({ platform, version, created: true, updated: false, id: created.id })
  }
  return results
}

export interface SafariProvisionOptions extends AppStoreConnectClientOptions {
  /** Only report missing resources; do not register Bundle IDs. @default false */
  checkOnly?: boolean
  /** Bundle ID platform used when registering. @default MAC_OS */
  platform?: BundleIdPlatform
  /** Create or align editable App Store versions for the selected platforms. */
  version?: string
  /** App Store platforms to provision. @default config.safariPlatforms ?? ['macos'] */
  platforms?: SafariPlatform[]
}

export interface SafariProvisionResult {
  container: { identifier: string, exists: boolean, created: boolean }
  extension: { identifier: string, exists: boolean, created: boolean }
  appRecord: { exists: boolean, id?: string }
  appStoreVersions: SafariAppStoreVersionResult[]
}

/**
 * Register the explicit container and extension Bundle IDs required by a
 * Safari Web Extension, then check for the manually-created App Store Connect
 * app record. Apple does not expose an official API for creating that record.
 */
export async function provisionSafariApp(config: ExtensionConfig, options: SafariProvisionOptions = {}): Promise<SafariProvisionResult> {
  if (!config.safariBundleId)
    throw new Error('[browser-extension] Safari provisioning needs safariBundleId in config/extension.ts')

  const client = new AppStoreConnectClient(options)
  const identifier = config.safariBundleId
  const extensionIdentifier = `${identifier}.Extension`
  const platforms = options.platforms ?? config.safariPlatforms ?? ['macos']
  const bundleIdPlatform = options.platform ?? (platforms.includes('ios') ? 'UNIVERSAL' : 'MAC_OS')
  const bundleOptions = { checkOnly: options.checkOnly, platform: bundleIdPlatform }
  const container = await client.ensureBundleId(identifier, config.name, bundleOptions)
  const extension = await client.ensureBundleId(extensionIdentifier, `${config.name} Safari Extension`, bundleOptions)
  const app = await client.findApp(identifier)
  const appStoreVersions = app && options.version && !options.checkOnly
    ? await ensureConfiguredAppStoreVersions(client, app.id, platforms, options.version)
    : []

  return {
    container: { identifier, exists: Boolean(container.bundleId), created: container.created },
    extension: { identifier: extensionIdentifier, exists: Boolean(extension.bundleId), created: extension.created },
    appRecord: { exists: Boolean(app), id: app?.id },
    appStoreVersions,
  }
}
