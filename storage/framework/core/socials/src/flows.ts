import { Buffer } from 'node:buffer'
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

/**
 * Single-use, browser-bound OAuth flow state (login CSRF protection).
 *
 * A social callback that exchanges any `code` it is handed signs the browser
 * into whichever account that code belongs to. An attacker starts a sign-in
 * with their own provider account, stops at the callback, and sends the
 * victim the link: the victim is now signed in as the attacker, and whatever
 * they type lands in the attacker's account. The OAuth `state` parameter
 * exists to stop this, but only when the callback checks it against
 * something the attacker cannot plant in the victim's browser.
 *
 * {@link issueOAuthFlow} mints a random `state` and an independent browser
 * secret. The state goes to the provider; the secret goes to the browser in
 * an HttpOnly cookie; only SHA-256 digests of both are stored. On the
 * callback, {@link consumeOAuthFlow} accepts the flow once, and only when the
 * same browser presents the matching secret before the deadline. A leaked
 * callback URL, a replayed state, or a state from another browser all
 * resolve to `null`.
 *
 * The same store backs other one-use, browser-bound hand-offs (the session
 * handoff in `@stacksjs/auth`), distinguished by `purpose`, so a state minted
 * for one purpose can never be redeemed as another.
 *
 * Storage is the auth-owned `oauth_flows` table (`buddy migrate` creates it
 * with the other auth tables). Tests and unusual deployments can swap it with
 * {@link useOAuthFlowStore}.
 */

/** Hex SHA-256, the only form a state or a browser secret is ever stored in. */
export function oauthFlowDigest(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

const STATE_SHAPE = /^[a-f0-9]{64}$/
const DIGEST_SHAPE = /^[a-f0-9]{64}$/
const PURPOSE_SHAPE = /^[\w.:-]{1,64}$/
/** A flow is a redirect round trip, not a session. One hour is generous. */
const MAX_TTL_MS = 60 * 60_000

/** One stored flow, as the store sees it. Never carries a raw state or secret. */
export interface OAuthFlowRecord {
  stateDigest: string
  purpose: string
  /** SHA-256 of the browser secret (or PKCE-style verifier) that may redeem it. Null = unbound. */
  browserDigest: string | null
  userId: number | null
  nonce: string | null
  data: Record<string, unknown> | null
  expiresAt: Date
}

/**
 * Where flows live. `take` must be atomic: of two concurrent calls for the
 * same digest, at most one may return the record.
 */
export interface OAuthFlowStore {
  insert: (record: OAuthFlowRecord) => Promise<void>
  /** Read the record without removing it, or undefined. */
  find: (stateDigest: string) => Promise<OAuthFlowRecord | undefined>
  /** Remove the record; true only for the caller whose delete removed it. */
  take: (stateDigest: string) => Promise<boolean>
  /** Remove expired records. Best effort. */
  prune: (now: Date) => Promise<void>
}

export interface IssueOAuthFlowOptions {
  /** What this flow is for (`social:google`, `session-handoff`, ...). Checked on consume. */
  purpose: string
  /** The signed-in user starting the flow (connect-an-account flows), or the handoff subject. */
  userId?: number | null
  /** Small JSON-serializable context to get back on consume (redirect target, PKCE verifier, ...). */
  data?: Record<string, unknown>
  /** Lifetime in milliseconds. Capped at one hour. */
  ttlMs: number
  /**
   * Bind the flow to this browser with an HttpOnly cookie (default `true`).
   * `false` returns no cookie and the flow can be redeemed by anyone holding
   * the state, so only turn it off when `challenge` binds it instead.
   */
  bindBrowser?: boolean
  /**
   * Bind to a PKCE-style verifier instead of a cookie: the hex SHA-256 of a
   * secret the redeeming client holds (a native app's sign-in sheet has its
   * own cookie jar). Redeem by passing the verifier as `browserSecret`.
   */
  challenge?: string
  /**
   * Mint (`true`) or record (a string) an OIDC nonce. Returned from issue and
   * consume, so the callback can compare it with the id_token's `nonce`.
   */
  nonce?: boolean | string
  /** Cookie attributes. */
  cookie?: OAuthFlowCookieOptions
}

export interface OAuthFlowCookieOptions {
  /** Default `/`. */
  path?: string
  /**
   * Default `Lax`. A provider that returns with a cross-site POST (Apple's
   * `form_post`) needs `None`, which browsers only accept with `Secure`.
   */
  sameSite?: 'Lax' | 'Strict' | 'None'
  /** Default: true when `config.app.url` is https, or whenever `sameSite` is `None`. */
  secure?: boolean
}

export interface IssuedOAuthFlow {
  /** The raw state for the provider's authorization URL (`withState`). */
  state: string
  /** A `Set-Cookie` header value binding the flow to this browser, or null when unbound. */
  cookie: string | null
  /** The raw browser secret the cookie carries (for callers that transport it differently). */
  secret: string | null
  /** The nonce, when one was requested. */
  nonce?: string
  expiresAt: Date
}

export interface ConsumeOAuthFlowOptions {
  /** Must equal the purpose the flow was issued for. */
  purpose: string
  /**
   * The browser's proof: the cookie secret (see {@link readOAuthFlowCookie})
   * or the verifier behind `challenge`. Required for a bound flow.
   */
  browserSecret?: string | null
}

export interface ConsumedOAuthFlow {
  purpose: string
  userId: number | null
  nonce: string | null
  data: Record<string, unknown> | null
  expiresAt: Date
}

let customStore: OAuthFlowStore | null = null

/**
 * Replace the flow store (pass `null` to restore the database store). Meant
 * for tests and for apps that keep this state somewhere other than SQL.
 */
export function useOAuthFlowStore(store: OAuthFlowStore | null): void {
  customStore = store
}

function activeStore(): OAuthFlowStore {
  return customStore ?? databaseOAuthFlowStore()
}

function randomHex(bytes = 32): string {
  return randomBytes(bytes).toString('hex')
}

function sameDigest(a: string, b: string): boolean {
  if (a.length !== b.length)
    return false
  return timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'))
}

/** The per-flow cookie name, so two sign-ins in two tabs do not overwrite each other. */
export function oauthFlowCookieName(state: string): string {
  return `stacks_oauth_${oauthFlowDigest(state).slice(0, 24)}`
}

async function defaultSecure(): Promise<boolean> {
  try {
    const { config } = await import('@stacksjs/config')
    return String(config.app?.url ?? '').startsWith('https:')
  }
  catch {
    return false
  }
}

function serializeCookie(name: string, value: string, maxAgeSeconds: number, options: Required<OAuthFlowCookieOptions>): string {
  return [
    `${name}=${value}`,
    `Path=${options.path}`,
    'HttpOnly',
    `SameSite=${options.sameSite}`,
    `Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}`,
    ...(options.secure ? ['Secure'] : []),
  ].join('; ')
}

async function resolveCookieOptions(options: OAuthFlowCookieOptions = {}): Promise<Required<OAuthFlowCookieOptions>> {
  const sameSite = options.sameSite ?? 'Lax'
  const secure = sameSite === 'None' ? true : options.secure ?? await defaultSecure()
  return { path: options.path ?? '/', sameSite, secure }
}

/**
 * Start a flow. Returns the state for the provider and the cookie for the
 * browser; send both, or neither.
 */
export async function issueOAuthFlow(options: IssueOAuthFlowOptions): Promise<IssuedOAuthFlow> {
  if (!PURPOSE_SHAPE.test(options.purpose ?? ''))
    throw new TypeError('[socials] issueOAuthFlow needs a purpose of 1-64 word characters, dots, colons or dashes.')
  if (!Number.isFinite(options.ttlMs) || options.ttlMs <= 0)
    throw new TypeError('[socials] issueOAuthFlow needs a positive ttlMs.')
  if (options.challenge !== undefined && !DIGEST_SHAPE.test(options.challenge))
    throw new TypeError('[socials] issueOAuthFlow challenge must be the lowercase hex SHA-256 of the verifier.')
  if (options.userId != null && (!Number.isSafeInteger(options.userId) || options.userId <= 0))
    throw new TypeError('[socials] issueOAuthFlow userId must be a positive integer.')

  const ttlMs = Math.min(options.ttlMs, MAX_TTL_MS)
  const state = randomHex()
  const bindBrowser = options.challenge ? false : options.bindBrowser !== false
  const secret = bindBrowser ? randomHex() : null
  const nonce = options.nonce === true ? randomHex() : typeof options.nonce === 'string' && options.nonce ? options.nonce : undefined
  const now = new Date()
  const expiresAt = new Date(now.getTime() + ttlMs)

  const store = activeStore()
  try {
    await store.prune(now)
  }
  catch {
    // Pruning is housekeeping; a failure must not block a sign-in.
  }

  await store.insert({
    stateDigest: oauthFlowDigest(state),
    purpose: options.purpose,
    browserDigest: options.challenge ?? (secret ? oauthFlowDigest(secret) : null),
    userId: options.userId ?? null,
    nonce: nonce ?? null,
    data: options.data ?? null,
    expiresAt,
  })

  const cookie = secret
    ? serializeCookie(oauthFlowCookieName(state), secret, ttlMs / 1000, await resolveCookieOptions(options.cookie))
    : null

  return { state, cookie, secret, ...(nonce !== undefined && { nonce }), expiresAt }
}

/**
 * Redeem a flow, once. Null when the state is unknown, already used, expired,
 * issued for another purpose, or bound to a different browser.
 *
 * A mismatched purpose or browser does NOT consume the flow, so an attacker
 * who learned a state cannot burn the legitimate browser's sign-in.
 */
export async function consumeOAuthFlow(state: unknown, options: ConsumeOAuthFlowOptions): Promise<ConsumedOAuthFlow | null> {
  if (typeof state !== 'string' || !STATE_SHAPE.test(state))
    return null

  const store = activeStore()
  const stateDigest = oauthFlowDigest(state)
  const record = await store.find(stateDigest)
  if (!record)
    return null

  if (record.expiresAt.getTime() <= Date.now()) {
    await store.take(stateDigest).catch(() => false)
    return null
  }

  if (record.purpose !== options.purpose)
    return null

  if (record.browserDigest !== null) {
    const secret = options.browserSecret
    if (typeof secret !== 'string' || secret.length === 0 || secret.length > 512)
      return null
    if (!sameDigest(oauthFlowDigest(secret), record.browserDigest))
      return null
  }

  // Single use: only the caller whose delete removed the row proceeds.
  if (!await store.take(stateDigest))
    return null

  return {
    purpose: record.purpose,
    userId: record.userId,
    nonce: record.nonce,
    data: record.data,
    expiresAt: record.expiresAt,
  }
}

/** The browser secret for `state` from a `Cookie` request header, or ''. */
export function readOAuthFlowCookie(cookieHeader: string | null | undefined, state: string): string {
  if (!cookieHeader || !state)
    return ''
  const name = oauthFlowCookieName(state)
  for (const part of cookieHeader.split(';')) {
    const trimmed = part.trim()
    if (trimmed.startsWith(`${name}=`))
      return trimmed.slice(name.length + 1)
  }
  return ''
}

/** A `Set-Cookie` value that removes the flow's cookie. Send it on every callback outcome. */
export async function clearOAuthFlowCookie(state: string, options: OAuthFlowCookieOptions = {}): Promise<string> {
  return serializeCookie(oauthFlowCookieName(state), '', 0, await resolveCookieOptions(options))
}

/** An in-memory store, for tests and single-process tools. */
export function memoryOAuthFlowStore(): OAuthFlowStore & { records: Map<string, OAuthFlowRecord> } {
  const records = new Map<string, OAuthFlowRecord>()
  return {
    records,
    async insert(record) {
      records.set(record.stateDigest, { ...record })
    },
    async find(stateDigest) {
      const record = records.get(stateDigest)
      return record ? { ...record } : undefined
    },
    async take(stateDigest) {
      return records.delete(stateDigest)
    },
    async prune(now) {
      for (const [key, record] of records) {
        if (record.expiresAt.getTime() <= now.getTime())
          records.delete(key)
      }
    },
  }
}

const TABLE = 'oauth_flows'

/**
 * The default store: the auth-owned `oauth_flows` table. The database graph
 * is imported on first use, so importing `@stacksjs/socials` for its
 * provider drivers alone stays light.
 */
export function databaseOAuthFlowStore(): OAuthFlowStore {
  const runtime = () => import('@stacksjs/database/runtime')
  return {
    async insert(record) {
      const { db, sqlDateTime } = await runtime()
      await db.insertInto(TABLE).values({
        state_digest: record.stateDigest,
        purpose: record.purpose,
        browser_digest: record.browserDigest,
        user_id: record.userId,
        nonce: record.nonce,
        data: record.data ? JSON.stringify(record.data) : null,
        expires_at: sqlDateTime(record.expiresAt),
        created_at: sqlDateTime(new Date()),
      }).execute()
    },
    async find(stateDigest) {
      const { db, parseSqlDateTime } = await runtime()
      // The primary: a flow written a moment ago must not be missed on a lagging replica.
      const row = await db.primary.selectFrom(TABLE)
        .where('state_digest', '=', stateDigest)
        .selectAll()
        .executeTakeFirst() as Record<string, unknown> | undefined
      if (!row)
        return undefined
      let data: Record<string, unknown> | null = null
      if (typeof row.data === 'string' && row.data) {
        try {
          const parsed = JSON.parse(row.data)
          data = parsed && typeof parsed === 'object' ? parsed : null
        }
        catch {
          data = null
        }
      }
      return {
        stateDigest: String(row.state_digest),
        purpose: String(row.purpose),
        browserDigest: typeof row.browser_digest === 'string' && row.browser_digest ? row.browser_digest : null,
        userId: row.user_id == null ? null : Number(row.user_id),
        nonce: typeof row.nonce === 'string' && row.nonce ? row.nonce : null,
        data,
        // An unreadable deadline is expired, never "forever".
        expiresAt: parseSqlDateTime(row.expires_at) ?? new Date(0),
      }
    },
    async take(stateDigest) {
      const { db, mutationCount } = await runtime()
      const result = await db.deleteFrom(TABLE).where('state_digest', '=', stateDigest).execute()
      return mutationCount(result) === 1
    },
    async prune(now) {
      const { db, sqlDateTime } = await runtime()
      await db.deleteFrom(TABLE).where('expires_at', '<', sqlDateTime(now)).execute()
    },
  }
}
