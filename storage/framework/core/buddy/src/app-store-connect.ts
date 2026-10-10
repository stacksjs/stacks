/**
 * Just enough of the App Store Connect API for `buddy release:ios`.
 *
 * TestFlight shows Xcode Cloud's build number, not the tag's: Xcode Cloud
 * numbers every run, failed ones too, so `v1.0.0-build.4` arrived as build
 * (10) beside builds 3, 4, 5, 7 and 9, and nothing said which was which. With
 * an API key the release names its tag after the number Xcode Cloud will give
 * it, and expires the builds it supersedes, so TestFlight lists the newest.
 *
 * The key is an App Store Connect API key (Users and Access → Integrations →
 * App Store Connect API), App Manager role or above:
 *   APP_STORE_CONNECT_KEY_ID, APP_STORE_CONNECT_ISSUER_ID, and the .p8 key as
 *   APP_STORE_CONNECT_PRIVATE_KEY (its contents) or _PRIVATE_KEY_PATH.
 * Without one, releases work as before and say what they cannot do.
 */
import { existsSync, readFileSync } from 'node:fs'
import { nextBuildNumber } from '@stacksjs/bumpx'

const API = 'https://api.appstoreconnect.apple.com'

export interface AppStoreConnectCredentials {
  keyId: string
  issuerId: string
  privateKey: string
}

/** The API key from the environment, or null when one is not configured. */
export function appStoreConnectCredentials(env: Record<string, string | undefined> = process.env): AppStoreConnectCredentials | null {
  const keyId = env.APP_STORE_CONNECT_KEY_ID?.trim()
  const issuerId = env.APP_STORE_CONNECT_ISSUER_ID?.trim()
  let privateKey = env.APP_STORE_CONNECT_PRIVATE_KEY?.trim()
  const keyPath = env.APP_STORE_CONNECT_PRIVATE_KEY_PATH?.trim()
  if (!privateKey && keyPath && existsSync(keyPath))
    privateKey = readFileSync(keyPath, 'utf8').trim()
  if (!keyId || !issuerId || !privateKey)
    return null
  // An env file keeps a multi-line key on one line with literal \n.
  return { keyId, issuerId, privateKey: privateKey.replace(/\\n/g, '\n') }
}

function base64url(bytes: Uint8Array | string): string {
  const buffer = typeof bytes === 'string' ? Buffer.from(bytes) : Buffer.from(bytes)
  return buffer.toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
}

/**
 * A token for the API: an ES256 JWT, valid for 20 minutes (Apple's limit),
 * signed with the key's private half.
 */
export async function appStoreConnectToken(credentials: AppStoreConnectCredentials, now = Date.now()): Promise<string> {
  const pem = credentials.privateKey.replace(/-----(BEGIN|END) PRIVATE KEY-----/g, '').replace(/\s+/g, '')
  const key = await crypto.subtle.importKey('pkcs8', Buffer.from(pem, 'base64'), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])
  const iat = Math.floor(now / 1000)
  const header = base64url(JSON.stringify({ alg: 'ES256', kid: credentials.keyId, typ: 'JWT' }))
  const payload = base64url(JSON.stringify({ iss: credentials.issuerId, iat, exp: iat + 20 * 60, aud: 'appstoreconnect-v1' }))
  // WebCrypto signs ECDSA as raw r||s, which is the form a JWT carries.
  const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, Buffer.from(`${header}.${payload}`))
  return `${header}.${payload}.${base64url(new Uint8Array(signature))}`
}

type Fetch = (input: string, init?: RequestInit) => Promise<Response>

export interface TestFlightBuild {
  id: string
  /** The build number TestFlight shows, `(10)`. */
  number: number
  uploadedDate: string
  processingState: string
  expired: boolean
}

export class AppStoreConnect {
  constructor(private readonly token: string, private readonly fetchImpl: Fetch = fetch) {}

  static async connect(credentials: AppStoreConnectCredentials, fetchImpl?: Fetch): Promise<AppStoreConnect> {
    return new AppStoreConnect(await appStoreConnectToken(credentials), fetchImpl)
  }

  private async request<T = any>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await this.fetchImpl(`${API}${path}`, {
      ...init,
      headers: { 'Authorization': `Bearer ${this.token}`, 'Content-Type': 'application/json', ...(init.headers as Record<string, string> | undefined) },
    })
    if (!response.ok) {
      const body = await response.text().catch(() => '')
      throw new Error(`App Store Connect ${init.method ?? 'GET'} ${path} answered ${response.status}${body ? `: ${body.slice(0, 300)}` : ''}`)
    }
    return (response.status === 204 ? null : await response.json()) as T
  }

  /** The app's App Store Connect id, from its bundle id. */
  async appId(bundleId: string): Promise<string> {
    const body = await this.request(`/v1/apps?filter[bundleId]=${encodeURIComponent(bundleId)}&limit=1`)
    const id = body?.data?.[0]?.id
    if (!id)
      throw new Error(`App Store Connect has no app with the bundle id ${bundleId}`)
    return id
  }

  /**
   * The number of the newest Xcode Cloud run for the app, or null when it has
   * no Xcode Cloud product. Every run takes one, finished or not.
   */
  async latestXcodeCloudRun(appId: string): Promise<number | null> {
    const products = await this.request(`/v1/ciProducts?filter[app]=${appId}&limit=1`)
    const productId = products?.data?.[0]?.id
    if (!productId)
      return null
    const runs = await this.request(`/v1/ciProducts/${productId}/buildRuns?sort=-number&limit=1&fields[ciBuildRuns]=number`)
    const number = Number(runs?.data?.[0]?.attributes?.number)
    return Number.isSafeInteger(number) && number >= 0 ? number : null
  }

  /** The app's TestFlight builds, newest first. */
  async builds(appId: string): Promise<TestFlightBuild[]> {
    const body = await this.request(`/v1/builds?filter[app]=${appId}&sort=-uploadedDate&limit=50&fields[builds]=version,uploadedDate,processingState,expired`)
    return (body?.data ?? []).map((build: any) => ({
      id: build.id,
      number: Number(build.attributes?.version),
      uploadedDate: String(build.attributes?.uploadedDate ?? ''),
      processingState: String(build.attributes?.processingState ?? ''),
      expired: Boolean(build.attributes?.expired),
    }))
  }

  async expire(buildId: string): Promise<void> {
    await this.request(`/v1/builds/${buildId}`, {
      method: 'PATCH',
      body: JSON.stringify({ data: { type: 'builds', id: buildId, attributes: { expired: true } } }),
    })
  }
}

/**
 * The builds a release retires: every unexpired build but the newest `keep`
 * that finished processing. A build still processing is never touched, and
 * neither is anything newer than the newest kept one.
 */
export function buildsToExpire(builds: TestFlightBuild[], keep = 1): TestFlightBuild[] {
  const live = builds
    .filter(build => !build.expired && build.processingState === 'VALID')
    .sort((a, b) => b.number - a.number)
  return live.slice(Math.max(0, keep))
}

/** The tag for the build Xcode Cloud is about to number, given its newest run. */
export function tagForXcodeCloudRun(version: string, latestRun: number): string {
  return `v${version}-build.${nextBuildNumber(latestRun)}`
}
