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

export interface TestFlightGroup {
  id: string
  name: string
  isInternalGroup: boolean
}

export class AppStoreConnect {
  private tokenProvider?: () => Promise<{ token: string, renewAt: number }>
  private renewAt = Number.POSITIVE_INFINITY
  private renewing?: Promise<void>

  constructor(private token: string, private readonly fetchImpl: Fetch = fetch) {}

  static async connect(credentials: AppStoreConnectCredentials, fetchImpl?: Fetch): Promise<AppStoreConnect> {
    const { keyId, issuerId, privateKey } = credentials
    const issue = async () => {
      const now = Date.now()
      return { token: await appStoreConnectToken({ keyId, issuerId, privateKey }, now), renewAt: now + 15 * 60_000 }
    }
    const issued = await issue()
    const api = new AppStoreConnect(issued.token, fetchImpl)
    api.tokenProvider = issue
    api.renewAt = issued.renewAt
    return api
  }

  private async authorization(): Promise<string> {
    // Release waits can exceed Apple's 20-minute JWT lifetime. Renew with a
    // margin before expiry; simultaneous readers share the same signing work.
    // The explicit-token constructor remains caller-managed.
    if (this.tokenProvider && Date.now() >= this.renewAt) {
      if (!this.renewing) {
        this.renewing = this.tokenProvider().then((issued) => {
          this.token = issued.token
          this.renewAt = issued.renewAt
        }).finally(() => { this.renewing = undefined })
      }
      await this.renewing
    }
    return `Bearer ${this.token}`
  }

  private async request<T = any>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await this.fetchImpl(`${API}${path}`, {
      ...init,
      signal: init.signal ?? AbortSignal.timeout(30_000),
      headers: { 'Authorization': await this.authorization(), 'Content-Type': 'application/json', ...(init.headers as Record<string, string> | undefined) },
    })
    if (!response.ok) {
      const body = await response.text().catch(() => '')
      throw new Error(`App Store Connect ${init.method ?? 'GET'} ${path} answered ${response.status}${body ? `: ${body.slice(0, 300)}` : ''}`)
    }
    return (response.status === 204 ? null : await response.json()) as T
  }

  private async pages(path: string): Promise<any[]> {
    const rows: any[] = []
    const visited = new Set<string>()
    while (path) {
      if (visited.has(path)) throw new Error('App Store Connect repeated a pagination link')
      visited.add(path)
      const page = await this.request(path)
      rows.push(...(page?.data ?? []))
      if (!page?.links?.next) break
      const next = new URL(page.links.next, API)
      if (next.origin !== API || !next.pathname.startsWith('/v1/') || next.username || next.password)
        throw new Error('App Store Connect returned an unsafe pagination link')
      path = next.pathname + next.search
    }
    return rows
  }

  /** Resolve every configured group before any build is distributed. */
  async internalTestFlightGroups(appId: string, names: readonly string[]): Promise<TestFlightGroup[]> {
    if (!Array.isArray(names) || names.some(name => typeof name !== 'string' || !name.trim()))
      throw new Error('ios.testFlightGroups must contain nonempty internal group names')
    if (!names.length) return []
    const groups: TestFlightGroup[] = (await this.pages(`/v1/apps/${encodeURIComponent(appId)}/betaGroups?limit=200&fields[betaGroups]=name,isInternalGroup`))
      .map(row => ({ id: String(row.id), name: String(row.attributes?.name ?? ''), isInternalGroup: row.attributes?.isInternalGroup === true }))
    return [...new Set(names.map(name => name.trim()))].map(name => {
      const matching = groups.filter(group => group.name === name)
      if (matching.length !== 1 || !matching[0]!.isInternalGroup)
        throw new Error(`TestFlight group ${JSON.stringify(name)} must name one existing internal group for this app`)
      return matching[0]!
    })
  }

  /** Add only this build to existing internal groups; never create testers or public links. */
  async assignBuildToInternalGroups(appId: string, build: TestFlightBuild, names: readonly string[]): Promise<TestFlightGroup[]> {
    if (build.processingState !== 'VALID' || build.expired)
      throw new Error('Only a processed, unexpired build can be distributed to TestFlight')
    const groups = await this.internalTestFlightGroups(appId, names)
    if (!groups.length) return groups
    const assigned = new Set((await this.buildTestFlightGroups(build.id)).map(group => group.id))
    for (const group of groups) {
      if (assigned.has(group.id)) continue
      await this.request(`/v1/betaGroups/${encodeURIComponent(group.id)}/relationships/builds`, {
        method: 'POST',
        body: JSON.stringify({ data: [{ type: 'builds', id: build.id }] }),
      })
    }
    return groups
  }

  private async buildTestFlightGroups(buildId: string): Promise<any[]> {
    // Apple exposes membership through the filtered collection. A build's
    // betaGroups relationship supports writes, but rejects GET_RELATED.
    return this.pages(`/v1/betaGroups?filter[builds]=${encodeURIComponent(buildId)}&limit=200&fields[betaGroups]=name,isInternalGroup`)
  }

  async testFlightStatus(buildId: string): Promise<{ internalBuildState: string, groupIds: string[] }> {
    const [detail, groups] = await Promise.all([
      this.request(`/v1/builds/${encodeURIComponent(buildId)}/buildBetaDetail`),
      this.buildTestFlightGroups(buildId),
    ])
    return { internalBuildState: String(detail?.data?.attributes?.internalBuildState ?? ''), groupIds: groups.map(group => String(group.id)) }
  }

  /** Confirm real tester availability before retiring any older release. */
  async deliverBuild(appId: string, version: string, number: number, options: TestFlightDeliveryOptions): Promise<TestFlightBuild | null> {
    const interval = options.intervalMs ?? 30_000
    const keep = options.keepBuilds ?? 1
    if (!Number.isFinite(options.timeoutMs) || options.timeoutMs < 0 || !Number.isFinite(interval) || interval <= 0 || !Number.isSafeInteger(keep) || keep < 0)
      throw new Error('TestFlight delivery needs a nonnegative wait/retention count and a positive polling interval')
    const now = options.now ?? Date.now
    const sleep = options.sleep ?? (ms => new Promise(resolve => setTimeout(resolve, ms)))
    const start = now()
    const groups = await this.internalTestFlightGroups(appId, options.groups ?? [])
    let appliedBuild: string | undefined
    for (;;) {
      const build = await this.build(appId, version, number)
      if (build?.expired || build && ['FAILED', 'INVALID'].includes(build.processingState))
        throw new Error(`TestFlight build ${number} is ${build.expired ? 'expired' : build.processingState}`)
      if (build?.processingState === 'VALID') {
        if (appliedBuild !== build.id) {
          if (options.notes && Object.keys(options.notes).length) await this.setWhatToTest(build.id, options.notes)
          await this.assignBuildToInternalGroups(appId, build, options.groups ?? [])
          appliedBuild = build.id
        }
        const status = await this.testFlightStatus(build.id)
        if (status.internalBuildState === 'IN_BETA_TESTING' && groups.every(group => status.groupIds.includes(group.id))) {
          if (options.timeoutMs > 0 && now() - start > options.timeoutMs) return null
          // A concurrently released newer build is never this release's to expire.
          const older = (await this.builds(appId)).filter(candidate => candidate.number < number)
          for (const retiring of buildsToExpire(older, keep)) await this.expire(retiring.id)
          return build
        }
      }
      const elapsed = now() - start
      if (elapsed + interval > options.timeoutMs) return null
      options.onWait?.(elapsed)
      await sleep(interval)
    }
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
    const rows = await this.pages(`/v1/builds?filter[app]=${encodeURIComponent(appId)}&sort=-uploadedDate&limit=200&fields[builds]=version,uploadedDate,processingState,expired`)
    return rows.map((build: any) => ({
      id: build.id,
      number: Number(build.attributes?.version),
      uploadedDate: String(build.attributes?.uploadedDate ?? ''),
      processingState: String(build.attributes?.processingState ?? ''),
      expired: Boolean(build.attributes?.expired),
    }))
  }

  /** The build `number` of `version`, once App Store Connect lists it, else null. */
  async build(appId: string, version: string, number: number): Promise<TestFlightBuild | null> {
    const query = `filter[app]=${appId}&filter[version]=${encodeURIComponent(String(number))}&filter[preReleaseVersion.version]=${encodeURIComponent(version)}&limit=1&fields[builds]=version,uploadedDate,processingState,expired`
    const build = (await this.request(`/v1/builds?${query}`))?.data?.[0]
    return build
      ? { id: build.id, number: Number(build.attributes?.version), uploadedDate: String(build.attributes?.uploadedDate ?? ''), processingState: String(build.attributes?.processingState ?? ''), expired: Boolean(build.attributes?.expired) }
      : null
  }

  /**
   * Set a build's "What to Test", one text per locale: the localization is
   * updated where the build has one and created where it does not.
   */
  async setWhatToTest(buildId: string, notes: Record<string, string>): Promise<void> {
    const existing = await this.request(`/v1/builds/${buildId}/betaBuildLocalizations?limit=50&fields[betaBuildLocalizations]=locale,whatsNew`)
    const byLocale = new Map<string, string>((existing?.data ?? []).map((row: any) => [String(row.attributes?.locale), String(row.id)]))
    for (const [locale, whatsNew] of Object.entries(notes)) {
      const id = byLocale.get(locale)
      if (id) {
        await this.request(`/v1/betaBuildLocalizations/${id}`, {
          method: 'PATCH',
          body: JSON.stringify({ data: { type: 'betaBuildLocalizations', id, attributes: { whatsNew } } }),
        })
      }
      else {
        await this.request('/v1/betaBuildLocalizations', {
          method: 'POST',
          body: JSON.stringify({
            data: {
              type: 'betaBuildLocalizations',
              attributes: { locale, whatsNew },
              relationships: { build: { data: { type: 'builds', id: buildId } } },
            },
          }),
        })
      }
    }
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

export interface WaitForBuildOptions {
  /** How long to wait for the build to appear. */
  timeoutMs: number
  /** Between looks. Default 30 seconds. */
  intervalMs?: number
  sleep?: (ms: number) => Promise<void>
  now?: () => number
  /** Told about each look, e.g. to log progress. */
  onWait?: (elapsedMs: number) => void
}

export interface TestFlightDeliveryOptions extends WaitForBuildOptions {
  groups?: readonly string[]
  notes?: Record<string, string>
  /** Older processed builds retained besides the newly available build. */
  keepBuilds?: number
}

/**
 * The build once App Store Connect lists it: Xcode Cloud uploads it some
 * minutes after the tag is pushed. Null when it has not appeared in time.
 */
export async function waitForBuild(api: Pick<AppStoreConnect, 'build'>, appId: string, version: string, number: number, options: WaitForBuildOptions): Promise<TestFlightBuild | null> {
  const sleep = options.sleep ?? (ms => new Promise(resolve => setTimeout(resolve, ms)))
  const now = options.now ?? Date.now
  const interval = options.intervalMs ?? 30_000
  const start = now()
  for (;;) {
    const build = await api.build(appId, version, number)
    if (build)
      return build
    const elapsed = now() - start
    if (elapsed + interval > options.timeoutMs)
      return null
    options.onWait?.(elapsed)
    await sleep(interval)
  }
}
