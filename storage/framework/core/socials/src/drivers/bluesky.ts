import type { SocialApiErrorOptions } from '../errors'
import type {
  AuthoredPostPage,
  BlueskySession,
  BlueskySessionCredentials,
  PostMetrics,
  PostVideo,
  PublishedPost,
  PublishPostInput,
  RemotePostRef,
  SocialDeletionDriver,
  SocialIdentityCredentials,
  SocialMetricsDriver,
  SocialPublishingDriver,
  TimelineQuery,
  TimelineResult,
} from '../types'
import { fetchPublicUrl } from '@stacksjs/security'
import { validatePostVideo } from '../media'
import { exceedsLimit } from '../text'
import { apiFailure, SocialApiError } from '../errors'

/** The ATProto collection every Bluesky post record lives in. */
const POST_COLLECTION = 'app.bsky.feed.post'

/**
 * Split `at://<repo>/<collection>/<rkey>` into its parts. Deletes are keyed by
 * repo + collection + rkey, not by the AT-URI itself.
 */
export function parseAtUri(uri: string): { repo: string, collection: string, rkey: string } {
  const match = /^at:\/\/([^/]+)\/([^/]+)\/([^/]+)$/.exec(String(uri || '').trim())
  if (!match) throw new Error(`"${uri}" is not a Bluesky post URI.`)
  return { repo: match[1] as string, collection: match[2] as string, rkey: match[3] as string }
}

export class BlueskyApiError extends SocialApiError {
  constructor(message: string, status: number, body: string, options: SocialApiErrorOptions = {}) {
    super('bluesky', message, status, body, options)
    this.name = 'BlueskyApiError'
  }

  /**
   * Whether the session is no longer good. A 400 counts only when Bluesky
   * names the token: counting every 400 made a post rejected as invalid look
   * like an expired session, so an app refreshed it and could mark a healthy
   * account as signed out.
   */
  get isAuthError(): boolean {
    if (this.status === 401 || this.status === 403) return true
    if (this.status !== 400) return false
    try {
      return BLUESKY_SESSION_ERRORS.includes(String(JSON.parse(this.body)?.error))
    }
    catch {
      return false
    }
  }
}

/** The XRPC error names that mean the access token itself is the problem. */
const BLUESKY_SESSION_ERRORS = ['ExpiredToken', 'InvalidToken']

/** Bluesky refuses a blob over this size. */
export const BLUESKY_MAX_BLOB_BYTES = 1_000_000

/** The maximum MP4 blob size in the app.bsky.embed.video lexicon. */
export const BLUESKY_MAX_VIDEO_BYTES = 300_000_000
const BLUESKY_VIDEO_SERVICE = 'https://video.bsky.app'
const VIDEO_PROCESSING_TIMEOUT_MS = 90_000

interface BlueskyDidDocument {
  id?: unknown
  alsoKnownAs?: unknown[]
  service?: Array<{ id?: unknown, type?: unknown, serviceEndpoint?: unknown }>
}

interface BlueskyVideoJob {
  jobId?: string
  did?: string
  state?: string
  blob?: { $type?: string, ref?: { $link?: string }, mimeType?: string, size?: number }
  error?: string
  message?: string
  failureCode?: string
}

function pdsEndpoint(document: BlueskyDidDocument | undefined, did: string): string | undefined {
  if (document?.id !== did) return undefined
  const pds = document.service?.find(entry =>
    (entry?.id === '#atproto_pds' || entry?.id === `${did}#atproto_pds`) && entry.type === 'AtprotoPersonalDataServer')
  const endpoint = typeof pds?.serviceEndpoint === 'string' ? URL.parse(pds.serviceEndpoint) : null
  if (!endpoint || endpoint.protocol !== 'https:' || endpoint.username || endpoint.password || endpoint.search || endpoint.hash) return undefined
  return endpoint.href.replace(/\/+$/, '')
}

/** Bluesky holds up to four images in one post. */
export const BLUESKY_MAX_IMAGES = 4

/** Bluesky keeps up to three languages on a post. */
export const BLUESKY_MAX_LANGS = 3

/** Whether `error` means the Bluesky session has to be refreshed or the account reconnected. */
export function isBlueskySessionError(error: unknown): boolean {
  return error instanceof BlueskyApiError && error.isAuthError
}

export interface BlueskyDriverOptions {
  service?: string
  /** An application can apply its outbound policy to all XRPC requests. */
  fetcher?: (url: URL, init: RequestInit) => Promise<Response>
}

interface CreateSessionResponse {
  did: string
  handle: string
  accessJwt: string
  refreshJwt: string
}

interface CreateRecordResponse {
  uri: string
  cid?: string
}

interface FacetCandidate {
  byteStart: number
  byteEnd: number
  type: 'link' | 'tag' | 'mention'
  value: string
}

const utf8 = new TextEncoder()

function byteLength(value: string): number {
  return utf8.encode(value).length
}

/**
 * Find link/hashtag/mention spans in post text with UTF-8 byte offsets
 * (ATProto facet ranges are byte-indexed, not character-indexed).
 * Mentions still need their DID resolved before they become facets.
 */
export function detectFacetCandidates(text: string): FacetCandidate[] {
  const candidates: FacetCandidate[] = []

  const linkPattern = /https?:\/\/[^\s<>"']+/g
  for (const match of text.matchAll(linkPattern)) {
    const value = match[0].replace(/[),.;!?]+$/, '')
    candidates.push({
      byteStart: byteLength(text.slice(0, match.index)),
      byteEnd: byteLength(text.slice(0, match.index)) + byteLength(value),
      type: 'link',
      value,
    })
  }

  const insideLink = (start: number, end: number): boolean =>
    candidates.some(candidate => candidate.type === 'link' && start < candidate.byteEnd && end > candidate.byteStart)

  // A tag as Bluesky's own client reads one (stacksjs/stacks#3376): `#` or the
  // full-width `＃`, then letters from any script, ending before whitespace
  // and trailing punctuation, with at least one character that is not a
  // digit, and at most 64 characters. This was `[A-Za-z0-9_]`, so `#café`
  // stopped at the `é` and `#日本` was no tag at all.
  const tagPattern = /(^|\s)([#＃])([^\s\u00AD\u2060\u200A-\u200D\u20E2]+)/gu
  for (const match of text.matchAll(tagPattern)) {
    const prefix = match[1]
    const sign = match[2]
    const raw = match[3]
    if (prefix === undefined || sign === undefined || raw === undefined) continue
    const value = raw.replace(/\p{P}+$/u, '')
    if (!value || !/[^\d\p{P}]/u.test(value) || [...value].length > 64) continue
    const charStart = (match.index ?? 0) + prefix.length
    const byteStart = byteLength(text.slice(0, charStart))
    const byteEnd = byteStart + byteLength(sign + value)
    if (insideLink(byteStart, byteEnd)) continue
    candidates.push({ byteStart, byteEnd, type: 'tag', value })
  }

  // Handles are domain-shaped (user.bsky.social), so require a dot.
  const mentionPattern = /(^|\s)(@[a-z0-9][a-z0-9.-]*\.[a-z]{2,})/gi
  for (const match of text.matchAll(mentionPattern)) {
    const prefix = match[1]
    const handle = match[2]
    if (prefix === undefined || handle === undefined) continue
    const charStart = (match.index ?? 0) + prefix.length
    const byteStart = byteLength(text.slice(0, charStart))
    const byteEnd = byteStart + byteLength(handle)
    if (insideLink(byteStart, byteEnd)) continue
    candidates.push({ byteStart, byteEnd, type: 'mention', value: handle.slice(1).replace(/\.+$/, '') })
  }

  return candidates.sort((a, b) => a.byteStart - b.byteStart)
}

/**
 * Where an account lives: the PDS named in its DID document
 * (stacksjs/stacks#3376).
 *
 * `identifier` is a handle or a DID. A handle is resolved to its DID through
 * `entryway`'s `resolveHandle`, which answers for any handle. A `did:plc`
 * document comes from the PLC directory, and a `did:web` one from
 * `https://<host>/.well-known/did.json` through the outbound guard. Only an
 * https endpoint is taken: the account's token goes there. Anything that does
 * not resolve answers `undefined`, never an error.
 */
export async function resolveBlueskyService(
  identifier: string,
  options: { entryway?: string, directory?: string, fetchJson?: (url: string) => Promise<unknown> } = {},
): Promise<string | undefined> {
  const entryway = (options.entryway ?? 'https://bsky.social').replace(/\/+$/, '')
  const directory = (options.directory ?? 'https://plc.directory').replace(/\/+$/, '')
  const fetchJson = options.fetchJson ?? (async (url: string) => {
    // A did:web host is whatever the DID says, so it goes through the guard;
    // the entryway and the PLC directory are fixed, known hosts.
    const known = url.startsWith(`${entryway}/`) || url.startsWith(`${directory}/`)
    const response = known
      ? await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(10_000) })
      : await fetchPublicUrl(url, {}, { maxRedirects: 0, timeoutMs: 10_000, maxBytes: 256 * 1024 })
    if (!response.ok) throw new Error(`${response.status}`)
    return await response.json()
  })

  try {
    let did = identifier.trim()
    const handle = did.startsWith('did:') ? undefined : did.replace(/^@/, '').toLowerCase()
    if (handle !== undefined) {
      const resolved = await fetchJson(`${entryway}/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(handle)}`) as { did?: unknown }
      if (typeof resolved?.did !== 'string') return undefined
      did = resolved.did
    }

    let documentUrl: string
    // Checked rather than encoded: the directory reads the DID's colons as they are.
    if (/^did:plc:[a-z0-9]+$/i.test(did))
      documentUrl = `${directory}/${did}`
    else if (/^did:web:[a-z0-9.-]+$/i.test(did))
      documentUrl = `https://${did.slice('did:web:'.length)}/.well-known/did.json`
    else
      return undefined

    const document = await fetchJson(documentUrl) as BlueskyDidDocument
    const claimedHandle = document?.alsoKnownAs?.find(alias => typeof alias === 'string' && alias.startsWith('at://'))
    if (handle !== undefined && claimedHandle !== `at://${handle}`) return undefined
    return pdsEndpoint(document, did)
  }
  catch {
    return undefined
  }
}

export interface BlueskyPostReference {
  uri: string
  cid: string
}

const BLUESKY_DID = /^did:[a-z]+:[A-Za-z0-9._:%-]+$/
const RECORD_KEY = /^[A-Za-z0-9._:~-]{1,512}$/
const CID = /^[A-Za-z0-9]{1,256}$/

function postParts(address: string): { repo: string, rkey: string } {
  let repo: string | undefined
  let rkey: string | undefined
  if (address.startsWith('at://')) {
    const parsed = parseAtUri(address)
    if (parsed.collection === POST_COLLECTION) ({ repo, rkey } = parsed)
  }
  else {
    const url = URL.parse(address)
    if (url?.origin === 'https://bsky.app' && !url.username && !url.password) {
      const [, actor, key] = /^\/profile\/([^/]+)\/post\/([^/]+)\/?$/.exec(url.pathname) ?? []
      try {
        if (actor && key) {
          repo = decodeURIComponent(actor)
          rkey = decodeURIComponent(key)
        }
      }
      catch {}
    }
  }
  if (!repo || (!BLUESKY_DID.test(repo) && !/^(?:[A-Za-z0-9-]+\.)+[A-Za-z]+$/.test(repo))
    || !rkey || !RECORD_KEY.test(rkey) || rkey === '.' || rkey === '..')
    throw new Error('Choose a valid Bluesky post link.')
  return { repo, rkey }
}

function selfLabelValues(labels: readonly string[]) {
  if (!Array.isArray(labels) || labels.some(label => typeof label !== 'string' || label.length > 128 || !/^!?[a-z]+(?:-[a-z]+)*$/.test(label)))
    throw new Error('Bluesky content labels must be lowercase label names.')
  const values = [...new Set(labels)].map(val => ({ val }))
  if (values.length > 10) throw new Error('Bluesky supports up to 10 self-labels per post.')
  return values
}

/** What only Bluesky takes, as the third argument to `publish`. */
export interface BlueskyPublishOptions {
  /**
   * The post's record key, from {@link blueskyRecordKey}. Bluesky refuses a
   * second record under a key it already has, so a publish whose answer was
   * lost can be retried with the same key without posting twice: the retry
   * answers with the post that went out. Keep one key per post, and make a
   * new one when the text changes, as with Mastodon's `idempotencyKey`.
   */
  rkey?: string
  /** A quoted post's AT URI and CID. Resolve a permalink with resolveQuote. */
  quote?: BlueskyPostReference
  /** Content labels the author wants attached to the record. */
  selfLabels?: readonly string[]
}

const TID_ALPHABET = '234567abcdefghijklmnopqrstuvwxyz'

/**
 * A new record key in Bluesky's TID form: 13 base32 characters encoding the
 * time in microseconds and a random clock id, so keys sort by when they were
 * made. `now` and `clockId` are for tests.
 */
export function blueskyRecordKey(now: number = Date.now(), clockId: number = Math.floor(Math.random() * 1024)): string {
  let value = ((BigInt(Math.floor(now)) * 1000n) << 10n) | BigInt(clockId & 1023)
  let key = ''
  for (let i = 0; i < 13; i++) {
    key = TID_ALPHABET[Number(value & 31n)] + key
    value >>= 5n
  }
  return key
}

export class BlueskyPublishingDriver implements SocialPublishingDriver, SocialDeletionDriver, SocialMetricsDriver {
  readonly provider: 'bluesky' = 'bluesky'
  characterLimit = 300

  protected service: string

  /** Whether the PDS was configured, in which case nothing else is tried. */
  protected configuredService: boolean
  private readonly fetcher?: BlueskyDriverOptions['fetcher']

  constructor(options: BlueskyDriverOptions = {}) {
    this.service = options.service || 'https://bsky.social'
    this.configuredService = Boolean(options.service)
    this.fetcher = options.fetcher
  }

  async createSession(credentials: BlueskySessionCredentials): Promise<BlueskySession> {
    const identifier = credentials.identifier.trim()
    const password = credentials.password.trim()

    if (!identifier) throw new Error('Bluesky identifier is required.')
    if (!password) throw new Error('Bluesky app password is required.')

    const session = await this.signIn(identifier, password)

    const profile = await this.getProfile({
      did: session.did,
      handle: session.handle,
      accessToken: session.accessJwt,
      refreshToken: session.refreshJwt,
    }).catch(() => undefined)

    return {
      did: session.did,
      handle: session.handle,
      displayName: profile?.displayName,
      accessJwt: session.accessJwt,
      refreshJwt: session.refreshJwt,
      service: this.service,
    }
  }

  /**
   * Sign in at the configured PDS, bsky.social unless told otherwise. An
   * account on its own PDS cannot sign in there, so when no PDS was
   * configured and the password is refused, the account's own PDS is looked
   * up and tried once; this driver then talks to it (stacksjs/stacks#3376).
   */
  protected async signIn(identifier: string, password: string): Promise<CreateSessionResponse> {
    const attempt = () => this.post<CreateSessionResponse>('/xrpc/com.atproto.server.createSession', { identifier, password })
    try {
      return await attempt()
    }
    catch (error) {
      const refused = error instanceof BlueskyApiError && (error.status === 400 || error.status === 401)
      if (!refused || this.configuredService)
        throw error
      const home = await resolveBlueskyService(identifier, { entryway: this.service })
      if (!home || home === this.service)
        throw error
      this.service = home
      return await attempt()
    }
  }

  async refreshSession(refreshToken: string): Promise<BlueskySession> {
    if (!refreshToken) throw new Error('Bluesky refresh token is required.')

    const session = await this.post<CreateSessionResponse>(
      '/xrpc/com.atproto.server.refreshSession',
      undefined,
      { authorization: `Bearer ${refreshToken}` },
    )

    return {
      did: session.did,
      handle: session.handle,
      accessJwt: session.accessJwt,
      refreshJwt: session.refreshJwt,
    }
  }

  /** Resolve a quotable post through the account's Bluesky service. */
  async resolveQuote(identity: SocialIdentityCredentials, address: string): Promise<BlueskyPostReference> {
    if (!identity.accessToken) throw new Error('Bluesky access token is missing for this identity.')
    const { repo, rkey } = postParts(address.trim())
    const did = BLUESKY_DID.test(repo) ? repo : await this.resolveHandle(repo)
    if (!did || !BLUESKY_DID.test(did)) throw new Error('Could not resolve the author of this Bluesky post.')
    const uri = `at://${did}/${POST_COLLECTION}/${rkey}`
    const url = new URL(`${this.service}/xrpc/app.bsky.feed.getPosts`)
    url.searchParams.set('uris', uri)
    const data = await this.request<{ posts?: Array<BlueskyPostReference & { viewer?: { embeddingDisabled?: boolean } }> }>(url, {
      headers: { authorization: `Bearer ${identity.accessToken}` },
      redirect: 'error',
      signal: AbortSignal.timeout(15_000),
    })
    const post = data.posts?.find(post => post.uri === uri)
    if (!post || typeof post.cid !== 'string' || !CID.test(post.cid))
      throw new Error('Could not find the Bluesky post at this link.')
    if (post.viewer?.embeddingDisabled) throw new Error('The author has disabled quoting this Bluesky post.')
    return { uri, cid: post.cid }
  }

  async publish(identity: SocialIdentityCredentials, post: PublishPostInput, options: BlueskyPublishOptions = {}): Promise<PublishedPost> {
    const repo = identity.did || identity.handle
    if (!identity.accessToken) throw new Error('Bluesky access token is missing for this identity.')
    if (!repo) throw new Error('Bluesky identity DID or handle is required.')
    // Bluesky counts graphemes: 300 emoji are 300, not 600 UTF-16 units.
    if (exceedsLimit('bluesky', post.text, this.characterLimit)) {
      throw new Error(`Bluesky posts must be ${this.characterLimit} characters or fewer.`)
    }

    if (post.video) {
      validatePostVideo(post.video, post.media)
      if (post.video.bytes.length > BLUESKY_MAX_VIDEO_BYTES)
        throw new Error('Bluesky video must be 300 MB or smaller.')
    }

    const quote = options.quote
    if (quote) {
      const target = postParts(quote.uri)
      if (quote.uri !== `at://${target.repo}/${POST_COLLECTION}/${target.rkey}` || !BLUESKY_DID.test(target.repo)
        || typeof quote.cid !== 'string' || !CID.test(quote.cid))
        throw new Error('Resolve the Bluesky post before quoting it.')
    }
    const labels = options.selfLabels === undefined ? [] : selfLabelValues(options.selfLabels)

    const record: Record<string, unknown> = {
      $type: 'app.bsky.feed.post',
      text: post.text,
      createdAt: post.scheduledAt || new Date().toISOString(),
    }

    if (post.langs?.length) record.langs = post.langs.slice(0, BLUESKY_MAX_LANGS)
    if (post.reply) record.reply = post.reply
    if (labels.length) record.labels = { $type: 'com.atproto.label.defs#selfLabels', values: labels }

    const facets = post.facets ?? await this.buildFacets(post.text)
    if (facets.length) record.facets = facets

    const warnings: string[] = []
    // A record holds one embed. Attached images win over a link card: they are
    // what the author attached on purpose, and the link stays clickable
    // through its facet.
    const imageMedia = (post.media || []).filter(item => item.bytes?.length).slice(0, BLUESKY_MAX_IMAGES)
    if (post.video) {
      record.embed = {
        $type: 'app.bsky.embed.video',
        video: await this.uploadVideo(identity, post.video),
        ...(post.video.altText && { alt: post.video.altText }),
        ...(post.video.aspectRatio && { aspectRatio: post.video.aspectRatio }),
      }
      if (post.external)
        warnings.push('A Bluesky post holds one attachment, so the video went out and the link card did not. The link in the text still works.')
    }
    else if (imageMedia.length) {
      const images = []
      for (const item of imageMedia) {
        const blob = await this.uploadBlob(identity, item.bytes!, item.mimeType || 'image/jpeg')
        images.push({ image: blob, alt: item.altText || '' })
      }
      record.embed = { $type: 'app.bsky.embed.images', images }
      if (post.external)
        warnings.push('A Bluesky post holds one attachment, so the images went out and the link card did not. The link in the text still works.')
    }
    else if (post.external) {
      const external: Record<string, unknown> = {
        uri: post.external.uri,
        title: post.external.title,
        description: post.external.description || '',
      }
      // Without its thumbnail uploaded and attached, a card is a grey box. A
      // picture that is too large or refused leaves the card without one
      // rather than failing the post.
      const thumb = post.external.thumb
      if (thumb?.bytes?.length) {
        if (thumb.bytes.length > BLUESKY_MAX_BLOB_BYTES) {
          warnings.push('The link card\'s picture is larger than Bluesky takes, so the card went out without it.')
        }
        else {
          try {
            external.thumb = await this.uploadBlob(identity, thumb.bytes, thumb.mimeType)
          }
          catch {
            warnings.push('Bluesky did not take the link card\'s picture, so the card went out without it.')
          }
        }
      }
      record.embed = { $type: 'app.bsky.embed.external', external }
    }

    if (quote) {
      const embedded = { $type: 'app.bsky.embed.record', record: { uri: quote.uri, cid: quote.cid } }
      record.embed = record.embed ? { $type: 'app.bsky.embed.recordWithMedia', record: embedded, media: record.embed } : embedded
    }

    const payload = await this.createPostRecord(identity, repo, record, options.rkey)

    return {
      provider: this.provider,
      uri: payload.uri,
      cid: payload.cid,
      url: this.toPostUrl(identity.handle, payload.uri),
      ...(warnings.length ? { warnings } : {}),
    }
  }

  /**
   * Likes, reposts, replies and quotes for any number of posts, 25 to a
   * request (app.bsky.feed.getPosts). A deleted post is left out. Bluesky
   * reports no views (stacksjs/stacks#3379).
   */
  async metrics(identity: SocialIdentityCredentials, uris: string[]): Promise<PostMetrics[]> {
    if (!identity.accessToken) throw new Error('Bluesky access token is missing for this identity.')
    const metrics: PostMetrics[] = []
    for (let start = 0; start < uris.length; start += 25) {
      const url = new URL(`${this.service}/xrpc/app.bsky.feed.getPosts`)
      for (const uri of uris.slice(start, start + 25)) url.searchParams.append('uris', uri)
      const payload = await this.request<{ posts?: Array<{ uri: string, likeCount?: number, repostCount?: number, replyCount?: number, quoteCount?: number }> }>(url, {
        headers: { authorization: `Bearer ${identity.accessToken}` },
      })
      for (const post of payload.posts || []) {
        metrics.push({
          uri: post.uri,
          likes: post.likeCount ?? 0,
          reposts: post.repostCount ?? 0,
          replies: post.replyCount ?? 0,
          quotes: post.quoteCount ?? 0,
        })
      }
    }
    return metrics
  }

  /**
   * Engagement counts for up to 25 of the account's posts per call
   * (app.bsky.feed.getPosts). Deleted posts are simply absent from the
   * response. {@link metrics} takes any number and has the shape every
   * driver shares.
   */
  async postMetrics(
    identity: SocialIdentityCredentials,
    uris: string[],
  ): Promise<Array<{ uri: string, likeCount: number, repostCount: number, replyCount: number }>> {
    if (!identity.accessToken) throw new Error('Bluesky access token is missing for this identity.')
    if (uris.length === 0) return []

    const url = new URL(`${this.service}/xrpc/app.bsky.feed.getPosts`)
    for (const uri of uris.slice(0, 25)) url.searchParams.append('uris', uri)

    const payload = await this.request<{ posts?: Array<{ uri: string, likeCount?: number, repostCount?: number, replyCount?: number }> }>(url, {
      headers: { authorization: `Bearer ${identity.accessToken}` },
    })

    return (payload.posts || []).map(post => ({
      uri: post.uri,
      likeCount: post.likeCount || 0,
      repostCount: post.repostCount || 0,
      replyCount: post.replyCount || 0,
    }))
  }

  async timeline(identity: SocialIdentityCredentials, query: TimelineQuery = {}): Promise<TimelineResult> {
    if (!identity.accessToken) throw new Error('Bluesky access token is missing for this identity.')

    const url = new URL(`${this.service}/xrpc/app.bsky.feed.getTimeline`)
    url.searchParams.set('limit', String(Math.min(Math.max(query.limit || 30, 1), 100)))
    if (query.cursor) url.searchParams.set('cursor', query.cursor)

    const payload = await this.request<{
      cursor?: string
      feed?: Array<{
        post?: {
          uri: string
          author?: { handle: string, displayName?: string, avatar?: string }
          record?: { text?: string, createdAt?: string }
          likeCount?: number
          repostCount?: number
          replyCount?: number
        }
      }>
    }>(url, {
      headers: {
        authorization: `Bearer ${identity.accessToken}`,
      },
    })

    return {
      cursor: payload.cursor,
      items: (payload.feed || []).flatMap((entry) => {
        const item = entry.post
        if (!item?.uri || !item.author?.handle) return []

        return [{
          uri: item.uri,
          authorHandle: item.author.handle,
          authorName: item.author.displayName,
          authorAvatar: item.author.avatar,
          postUrl: this.toPostUrl(item.author.handle, item.uri),
          body: item.record?.text || '',
          postedAt: item.record?.createdAt || new Date().toISOString(),
          likeCount: item.likeCount || 0,
          repostCount: item.repostCount || 0,
          replyCount: item.replyCount || 0,
        }]
      }),
    }
  }

  async getProfile(identity: SocialIdentityCredentials): Promise<{ did: string, handle: string, displayName?: string }> {
    if (!identity.accessToken) throw new Error('Bluesky access token is missing for this identity.')

    const actor = identity.did || identity.handle
    if (!actor) throw new Error('Bluesky identity DID or handle is required.')

    const url = new URL(`${this.service}/xrpc/app.bsky.actor.getProfile`)
    url.searchParams.set('actor', actor)

    return await this.request<{ did: string, handle: string, displayName?: string }>(url, {
      headers: {
        authorization: `Bearer ${identity.accessToken}`,
      },
    })
  }

  /**
   * Resolve link/tag/mention candidates into ATProto facets. Mentions that
   * fail handle→DID resolution are dropped rather than failing the post.
   */
  protected async buildFacets(text: string): Promise<Array<Record<string, unknown>>> {
    const facets: Array<Record<string, unknown>> = []
    for (const candidate of detectFacetCandidates(text)) {
      let feature: Record<string, unknown> | null = null
      if (candidate.type === 'link')
        feature = { $type: 'app.bsky.richtext.facet#link', uri: candidate.value }
      else if (candidate.type === 'tag')
        feature = { $type: 'app.bsky.richtext.facet#tag', tag: candidate.value }
      else if (candidate.type === 'mention') {
        const did = await this.resolveHandle(candidate.value)
        if (did) feature = { $type: 'app.bsky.richtext.facet#mention', did }
      }
      if (feature) {
        facets.push({
          index: { byteStart: candidate.byteStart, byteEnd: candidate.byteEnd },
          features: [feature],
        })
      }
    }
    return facets
  }

  /** Handle → DID, or null when the handle doesn't resolve. */
  protected async resolveHandle(handle: string): Promise<string | null> {
    try {
      const url = new URL(`${this.service}/xrpc/com.atproto.identity.resolveHandle`)
      url.searchParams.set('handle', handle)
      const payload = await this.request<{ did?: string }>(url, {})
      return payload.did || null
    }
    catch {
      return null
    }
  }

  /** Prepare the video on Bluesky's video service before publishing the post. */
  private async uploadVideo(identity: SocialIdentityCredentials, video: PostVideo): Promise<NonNullable<BlueskyVideoJob['blob']>> {
    const headers = { authorization: `Bearer ${identity.accessToken}` }
    const session = await this.request<{ did: string, didDoc?: BlueskyDidDocument }>(
      new URL(`${this.service}/xrpc/com.atproto.server.getSession`),
      { headers, signal: AbortSignal.timeout(15_000) },
    )
    if (!BLUESKY_DID.test(session.did) || (identity.did && session.did !== identity.did))
      throw new Error('Bluesky could not verify the account for this video.')

    // bsky.social may be the sign-in entryway rather than this account's PDS.
    // Only its host is used as the audience. No credential is sent to a URL
    // taken from a DID document.
    const pds = pdsEndpoint(session.didDoc, session.did) ?? await resolveBlueskyService(session.did)
    if (!pds)
      throw new Error('Bluesky could not find the account’s data server for this video.')
    const tokenUrl = new URL(`${this.service}/xrpc/com.atproto.server.getServiceAuth`)
    tokenUrl.searchParams.set('aud', `did:web:${new URL(pds).host.replace(':', '%3A')}`)
    tokenUrl.searchParams.set('lxm', 'com.atproto.repo.uploadBlob')
    tokenUrl.searchParams.set('exp', String(Math.floor(Date.now() / 1000) + 30 * 60))
    const { token } = await this.request<{ token?: string }>(tokenUrl, { headers, signal: AbortSignal.timeout(15_000) })
    if (typeof token !== 'string' || !token)
      throw new Error('Bluesky did not authorize the video upload.')

    const url = new URL('/xrpc/app.bsky.video.uploadVideo', BLUESKY_VIDEO_SERVICE)
    url.searchParams.set('did', session.did)
    url.searchParams.set('name', 'upload.mp4')
    const response = await (this.fetcher ?? fetch)(url, {
      method: 'POST',
      headers: {
        'authorization': `Bearer ${token}`,
        'content-type': video.mimeType,
        'content-length': String(video.bytes.length),
      },
      body: new Uint8Array(video.bytes),
      redirect: 'error',
      signal: AbortSignal.timeout(120_000),
    })
    const responseBody = await response.text()
    // The service has returned both the bare job and the lexicon envelope.
    let payload: (BlueskyVideoJob & { jobStatus?: BlueskyVideoJob }) | undefined
    try { payload = JSON.parse(responseBody) }
    catch { /* Treat non-JSON service errors as HTTP failures. */ }
    let job = payload?.jobStatus ?? payload ?? {}
    if (job.error === 'unconfirmed_email')
      throw new Error('Verify your Bluesky account email before uploading video.')
    if (!response.ok && !(response.status === 409 && job.error === 'already_exists'))
      throw new SocialApiError('bluesky', ...apiFailure('Bluesky video service', response, responseBody))
    if (job.did !== session.did || typeof job.jobId !== 'string' || !job.jobId || job.jobId.length > 200)
      throw new Error('Bluesky did not return a video processing job for this account.')

    const statusUrl = new URL('/xrpc/app.bsky.video.getJobStatus', BLUESKY_VIDEO_SERVICE)
    statusUrl.searchParams.set('jobId', job.jobId)
    const signal = AbortSignal.timeout(VIDEO_PROCESSING_TIMEOUT_MS)
    for (;;) {
      const blob = job.blob
      if (blob) {
        if (blob.$type !== 'blob' || blob.mimeType !== video.mimeType || typeof blob.ref?.$link !== 'string'
          || !CID.test(blob.ref.$link) || typeof blob.size !== 'number' || !Number.isSafeInteger(blob.size)
          || blob.size <= 0 || blob.size > BLUESKY_MAX_VIDEO_BYTES)
          throw new Error('Bluesky did not return a valid processed video attachment.')
        return blob
      }
      if (job.state === 'JOB_STATE_FAILED')
        throw new SocialApiError('bluesky', job.message || 'Bluesky could not process the video.', 422, JSON.stringify({ message: job.message, error: job.failureCode }))
      if (signal.aborted)
        throw new BlueskyApiError('Bluesky took too long to process the attachment.', 503, '')

      const status = await this.request<{ jobStatus?: BlueskyVideoJob }>(statusUrl, { signal })
      if (status.jobStatus?.jobId !== job.jobId || status.jobStatus?.did !== session.did)
        throw new Error('Bluesky returned a different video processing job.')
      job = status.jobStatus
      if (!job.blob && job.state !== 'JOB_STATE_FAILED') await Bun.sleep(1000)
    }
  }

  /** Upload raw image bytes and return the blob ref for embeds. */
  async uploadBlob(identity: SocialIdentityCredentials, bytes: Uint8Array, mimeType: string): Promise<unknown> {
    if (!identity.accessToken) throw new Error('Bluesky access token is missing for this identity.')
    if (bytes.length > BLUESKY_MAX_BLOB_BYTES)
      throw new Error('Bluesky images must be 1MB or smaller.')

    const payload = await this.request<{ blob: unknown }>(
      new URL(`${this.service}/xrpc/com.atproto.repo.uploadBlob`),
      {
        method: 'POST',
        headers: {
          'content-type': mimeType,
          'authorization': `Bearer ${identity.accessToken}`,
        },
        // Copy into a fresh ArrayBuffer-backed array: the parameter is typed
        // Uint8Array<ArrayBufferLike>, which the fetch body type (ArrayBuffer-
        // backed views only) rejects; `new Uint8Array(bytes)` is Uint8Array<
        // ArrayBuffer>. content-type is carried by the explicit header above.
        body: new Uint8Array(bytes),
      },
    )

    return payload.blob
  }

  /**
   * One page of the account's own `app.bsky.feed.post` records, newest first.
   * `listRecords` reads the repo directly, so it returns everything the
   * account ever posted rather than only what this app published.
   */
  async listAuthoredPosts(
    identity: SocialIdentityCredentials,
    query: TimelineQuery = {},
  ): Promise<AuthoredPostPage> {
    const repo = identity.did || identity.handle
    if (!identity.accessToken) throw new Error('Bluesky access token is missing for this identity.')
    if (!repo) throw new Error('Bluesky identity DID or handle is required.')

    const url = new URL(`${this.service}/xrpc/com.atproto.repo.listRecords`)
    url.searchParams.set('repo', repo)
    url.searchParams.set('collection', POST_COLLECTION)
    url.searchParams.set('limit', String(Math.min(Math.max(query.limit || 100, 1), 100)))
    if (query.cursor) url.searchParams.set('cursor', query.cursor)

    const payload = await this.request<{
      cursor?: string
      records?: Array<{ uri: string, cid?: string, value?: { text?: string, createdAt?: string } }>
    }>(url, { headers: { authorization: `Bearer ${identity.accessToken}` } })

    return {
      cursor: payload.cursor,
      posts: (payload.records || []).filter(record => record?.uri).map(record => ({
        uri: record.uri,
        cid: record.cid,
        text: record.value?.text,
        postedAt: record.value?.createdAt,
        url: identity.handle ? this.toPostUrl(identity.handle, record.uri) : undefined,
      })),
    }
  }

  /** Permanently delete one post record from the account's repo. */
  /**
   * Create the post record. With a record key, a refusal is checked against
   * what is already stored under that key: when the post is there, an earlier
   * attempt went through and its answer was lost, so this answers with it
   * rather than failing the retry (stacksjs/stacks#3376).
   */
  protected async createPostRecord(
    identity: SocialIdentityCredentials,
    repo: string,
    record: Record<string, unknown>,
    rkey?: string,
  ): Promise<CreateRecordResponse> {
    const authorization = `Bearer ${identity.accessToken}`
    try {
      return await this.post<CreateRecordResponse>(
        '/xrpc/com.atproto.repo.createRecord',
        { repo, collection: POST_COLLECTION, ...(rkey ? { rkey } : {}), record },
        { authorization },
      )
    }
    catch (error) {
      if (!rkey || !(error instanceof BlueskyApiError) || error.status >= 500)
        throw error
      const url = new URL(`${this.service}/xrpc/com.atproto.repo.getRecord`)
      url.searchParams.set('repo', repo)
      url.searchParams.set('collection', POST_COLLECTION)
      url.searchParams.set('rkey', rkey)
      const existing = await this.request<{ uri?: string, cid?: string, value?: { text?: unknown } }>(url, { headers: { authorization } }).catch(() => undefined)
      if (existing?.uri && existing.cid && existing.value?.text === record.text)
        return { uri: existing.uri, cid: existing.cid }
      throw error
    }
  }

  async deletePost(identity: SocialIdentityCredentials, ref: RemotePostRef): Promise<void> {
    if (!identity.accessToken) throw new Error('Bluesky access token is missing for this identity.')
    const { repo, collection, rkey } = parseAtUri(ref.uri)

    await this.post(
      '/xrpc/com.atproto.repo.deleteRecord',
      { repo, collection, rkey },
      { authorization: `Bearer ${identity.accessToken}` },
    )
  }

  protected async post<T>(path: string, body?: unknown, headers: Record<string, string> = {}): Promise<T> {
    return await this.request<T>(new URL(`${this.service}${path}`), {
      method: 'POST',
      headers: {
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        ...headers,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
  }

  protected async request<T>(url: URL, init: RequestInit): Promise<T> {
    const response = await (this.fetcher ?? fetch)(url, { ...init, redirect: 'error' })
    const text = await response.text()

    if (!response.ok) {
      throw new BlueskyApiError(...apiFailure('Bluesky API', response, text))
    }

    return text ? JSON.parse(text) as T : {} as T
  }

  protected toPostUrl(handle: string, uri: string): string {
    const postId = uri.split('/').pop()
    return `https://bsky.app/profile/${handle}/post/${postId}`
  }
}
