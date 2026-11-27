import type { SocialApiErrorOptions } from '../errors'
import type {
  AuthoredPostPage,
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
import { fetchPostImage, resolvePostImage, validatePostVideo } from '../media'
import { exceedsLimit, graphemes } from '../text'
import { apiFailure, SocialApiError } from '../errors'

/** The counts on a Mastodon status entity. */
interface MastodonStatusCounts {
  id: string
  favourites_count?: number
  reblogs_count?: number
  replies_count?: number
  quotes_count?: number
}

function isNotFound(error: unknown): boolean {
  return error instanceof MastodonApiError && error.status === 404
}

export class MastodonApiError extends SocialApiError {
  constructor(message: string, status: number, body: string, options: SocialApiErrorOptions = {}) {
    super('mastodon', message, status, body, options)
    this.name = 'MastodonApiError'
  }

  get isAuthError(): boolean {
    return this.status === 401 || this.status === 403
  }
}

export interface MastodonAccount {
  accountId: string
  username: string
  displayName?: string
  url: string
}

export type MastodonVisibility = 'public' | 'unlisted' | 'private' | 'direct'

export interface MastodonPoll {
  options: readonly string[]
  /** How long voting stays open, in seconds after publication. */
  expiresIn: number
  multiple?: boolean
  hideTotals?: boolean
}

export interface MastodonPollLimits {
  maxOptions: number
  maxCharactersPerOption: number
  minExpiration: number
  maxExpiration: number
}

/** What only Mastodon takes, as the third argument to `publish`. */
export interface MastodonPublishOptions {
  /**
   * Sent as `Idempotency-Key`. Mastodon answers a repeated key with the status
   * it already created, so a publish whose answer was lost can be retried
   * without posting twice. Use the same key for the same post to the same
   * account, and a new one when the text changes.
   */
  idempotencyKey?: string
  /** `public` unless given. */
  visibility?: MastodonVisibility
  /** A content warning. The text is hidden behind it. */
  spoilerText?: string
  /** An ISO 639 code, such as `en`. Defaults to the post's first `langs` entry. */
  language?: string
  poll?: MastodonPoll
  /** Instance-local ID of the quoted status. Resolve a permalink with resolvePostId. */
  quotedStatusId?: string
}

/** One instance's posting limits, from `/api/v2/instance`. */
export interface MastodonLimits {
  characters: number
  /** What a link counts as, whatever its real length. */
  charactersPerUrl: number
  mediaAttachments: number
  videoSizeLimit?: number
  supportsMp4?: boolean
  poll?: MastodonPollLimits
  /** The instance advertises the API used to create quote posts. */
  quotePosts?: true
}

/** Mastodon's own defaults, for an instance that does not say. */
export const MASTODON_DEFAULT_LIMITS: MastodonLimits = { characters: 500, charactersPerUrl: 23, mediaAttachments: 4 }

const LIMITS_TTL_MS = 60 * 60 * 1000
/** How soon an instance that could not be asked is asked again. */
const LIMITS_RETRY_MS = 60 * 1000
const VIDEO_PROCESSING_TIMEOUT_MS = 60_000

interface MastodonMediaAttachment {
  id: string
  type?: string
  url?: string | null
}

function pollLimits(polls: Record<string, unknown> | undefined): MastodonPollLimits | null {
  if (!polls) return null
  const maxOptions = Number(polls.max_options)
  const maxCharactersPerOption = Number(polls.max_characters_per_option)
  const minExpiration = Number(polls.min_expiration)
  const maxExpiration = Number(polls.max_expiration)
  if (![maxOptions, maxCharactersPerOption, minExpiration, maxExpiration].every(value => Number.isSafeInteger(value) && value > 0)
    || maxOptions < 2 || maxExpiration < minExpiration) return null
  return { maxOptions, maxCharactersPerOption, minExpiration, maxExpiration }
}

function pollPayload(poll: MastodonPoll, limits: MastodonPollLimits | undefined) {
  if (!limits) throw new Error('The Mastodon instance did not report its poll limits.')
  if (!Array.isArray(poll.options) || poll.options.some(option => typeof option !== 'string' || !option.trim()))
    throw new Error('Each poll option needs text.')
  const options = poll.options.map(option => option.trim())
  if (options.length < 2 || options.length > limits.maxOptions)
    throw new Error(`This Mastodon instance allows between 2 and ${limits.maxOptions} poll options.`)
  if (options.some(option => graphemes(option) > limits.maxCharactersPerOption))
    throw new Error(`Each poll option can have up to ${limits.maxCharactersPerOption} characters.`)
  if (new Set(options).size !== options.length) throw new Error('Poll options must be distinct.')
  if (!Number.isSafeInteger(poll.expiresIn) || poll.expiresIn < limits.minExpiration || poll.expiresIn > limits.maxExpiration)
    throw new Error(`This Mastodon instance allows poll durations between ${limits.minExpiration} and ${limits.maxExpiration} seconds.`)
  return { options, expires_in: poll.expiresIn, multiple: poll.multiple === true, hide_totals: poll.hideTotals === true }
}

function statusAddress(value: string | null | undefined): string | null {
  const url = typeof value === 'string' ? URL.parse(value) : null
  if (!url || url.protocol !== 'https:' || url.username || url.password) return null
  url.hash = ''
  return url.href
}

/** Normalize "mastodon.social" / "https://mastodon.social/" → "https://mastodon.social". */
export function normalizeInstance(value: string): string {
  const trimmed = String(value || '').trim().replace(/\/+$/, '')
  if (!trimmed)
    throw new Error('Mastodon instance URL is required.')

  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  try {
    const url = new URL(withScheme)
    return `${url.protocol}//${url.host}`
  }
  catch {
    throw new Error('Mastodon instance URL is invalid.')
  }
}

/**
 * Publishing driver for Mastodon (and API-compatible instances).
 *
 * Mastodon is token-based rather than OAuth-redirect based: the user creates
 * an access token in their instance's Preferences → Development, so there is
 * no consent URL or code exchange to model.
 *
 * Because every instance is a different host, `identity.did` carries the
 * instance base URL — the same slot LinkedIn uses for the member URN and
 * Instagram for the account id.
 */
export class MastodonPublishingDriver implements SocialPublishingDriver, SocialDeletionDriver, SocialMetricsDriver {
  readonly provider: 'mastodon' = 'mastodon'
  /**
   * Mastodon's default. An instance can raise it, and many do, so `publish`
   * goes by {@link instanceLimits} and this is only the fallback.
   */
  characterLimit = MASTODON_DEFAULT_LIMITS.characters
  /** Downloads an image given by address. Guarded against private addresses; replace it in a test. */
  fetchImage = fetchPostImage

  private readonly limits = new Map<string, { value: MastodonLimits, expires: number }>()

  /**
   * The instance's limits, from `/api/v2/instance`, remembered for an hour.
   * An instance that cannot be reached, or an older one without that
   * endpoint, gets Mastodon's defaults: a publish must not fail because a
   * courtesy lookup did. Those are remembered for a minute only, so the real
   * figure is picked up soon.
   */
  async instanceLimits(identity: SocialIdentityCredentials): Promise<MastodonLimits> {
    const instance = this.instanceOf(identity)
    const cached = this.limits.get(instance)
    if (cached && Date.now() < cached.expires) return cached.value

    try {
      const response = await fetch(`${instance}/api/v2/instance`, { signal: AbortSignal.timeout(5_000) })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const json = await response.json() as {
        configuration?: { statuses?: Record<string, unknown>, polls?: Record<string, unknown>, media_attachments?: Record<string, unknown> }
        api_versions?: { mastodon?: number }
      }
      const statuses = json.configuration?.statuses ?? {}
      const positive = (raw: unknown, fallback: number): number => Number(raw) > 0 ? Math.floor(Number(raw)) : fallback
      const poll = pollLimits(json.configuration?.polls)
      const media = json.configuration?.media_attachments
      const videoSizeLimit = Number(media?.video_size_limit)
      const hasVideoSizeLimit = Number.isSafeInteger(videoSizeLimit) && videoSizeLimit > 0
      const mimeTypes = media?.supported_mime_types
      const quotePosts = Number(json.api_versions?.mastodon) >= 7
      const value: MastodonLimits = {
        ...(poll && { poll }),
        ...(quotePosts && { quotePosts: true }),
        ...(hasVideoSizeLimit && { videoSizeLimit }),
        ...(Array.isArray(mimeTypes) && { supportsMp4: mimeTypes.includes('video/mp4') }),
        characters: positive(statuses.max_characters, MASTODON_DEFAULT_LIMITS.characters),
        charactersPerUrl: positive(statuses.characters_reserved_per_url, MASTODON_DEFAULT_LIMITS.charactersPerUrl),
        mediaAttachments: positive(statuses.max_media_attachments, MASTODON_DEFAULT_LIMITS.mediaAttachments),
      }
      this.limits.set(instance, { value, expires: Date.now() + LIMITS_TTL_MS })
      return value
    }
    catch {
      this.limits.set(instance, { value: MASTODON_DEFAULT_LIMITS, expires: Date.now() + LIMITS_RETRY_MS })
      return MASTODON_DEFAULT_LIMITS
    }
  }

  /** The instance this identity posts to. */
  protected instanceOf(identity: SocialIdentityCredentials): string {
    return normalizeInstance(identity.did || '')
  }

  protected tokenOf(identity: SocialIdentityCredentials): string {
    if (!identity.accessToken)
      throw new Error('Mastodon access token is missing for this identity.')
    return identity.accessToken
  }

  /** Verify a token and return the account it belongs to. */
  async verifyCredentials(identity: SocialIdentityCredentials): Promise<MastodonAccount> {
    const account = await this.request<{ id: string, username: string, display_name?: string, url: string }>(
      `${this.instanceOf(identity)}/api/v1/accounts/verify_credentials`,
      { headers: { authorization: `Bearer ${this.tokenOf(identity)}` } },
    )

    return {
      accountId: account.id,
      username: account.username,
      displayName: account.display_name || undefined,
      url: account.url,
    }
  }

  /** Resolve a local or federated status permalink to the ID on this account's instance. */
  async resolvePostId(identity: SocialIdentityCredentials, permalink: string): Promise<string> {
    const address = statusAddress(permalink)
    if (!address) throw new Error('Enter an HTTPS link to a Mastodon post.')
    const search = new URL('/api/v2/search', this.instanceOf(identity))
    search.search = new URLSearchParams({ q: address, type: 'statuses', resolve: 'true', limit: '1' }).toString()
    const result = await this.request<{ statuses?: Array<{ id: string, url?: string | null, uri?: string }> }>(search.href, {
      headers: { authorization: `Bearer ${this.tokenOf(identity)}` },
      redirect: 'error',
      signal: AbortSignal.timeout(15_000),
    })
    const found = result.statuses?.find(status => statusAddress(status.url) === address || statusAddress(status.uri) === address)
    if (!found || !/^[0-9]{1,32}$/.test(found.id))
      throw new Error('The Mastodon instance could not find the post at this link.')
    return found.id
  }

  /** Upload one image and return its media id for attachment. */
  async uploadMedia(
    identity: SocialIdentityCredentials,
    bytes: Uint8Array,
    mimeType: string,
    altText?: string,
  ): Promise<string> {
    const media = await this.createMediaAttachment(identity, bytes, mimeType, altText)
    return media.id
  }

  private async createMediaAttachment(
    identity: SocialIdentityCredentials,
    bytes: Uint8Array,
    mimeType: string,
    altText?: string,
    signal?: AbortSignal,
  ): Promise<MastodonMediaAttachment> {
    const form = new FormData()
    const filename = mimeType === 'video/mp4' ? 'upload.mp4' : 'upload'
    form.set('file', new Blob([new Uint8Array(bytes)], { type: mimeType || 'image/jpeg' }), filename)
    // Mastodon keeps up to 1,500 characters of description.
    if (altText?.trim()) form.set('description', altText.trim().slice(0, 1500))

    return await this.request<MastodonMediaAttachment>(
      `${this.instanceOf(identity)}/api/v2/media`,
      { method: 'POST', headers: { authorization: `Bearer ${this.tokenOf(identity)}` }, body: form, redirect: 'error', signal },
    )
  }

  private async uploadVideo(identity: SocialIdentityCredentials, video: PostVideo): Promise<string> {
    const uploaded = await this.createMediaAttachment(identity, video.bytes, video.mimeType, video.altText, AbortSignal.timeout(60_000))
    if (typeof uploaded.id !== 'string' || !/^[a-z0-9_-]{1,128}$/i.test(uploaded.id))
      throw new Error('Mastodon did not return a valid video attachment ID.')

    const statusUrl = `${this.instanceOf(identity)}/api/v1/media/${uploaded.id}`
    const headers = { authorization: `Bearer ${this.tokenOf(identity)}` }
    const signal = AbortSignal.timeout(VIDEO_PROCESSING_TIMEOUT_MS)
    let attachment = uploaded
    while (!attachment.url) {
      if (signal.aborted)
        throw new MastodonApiError('Mastodon took too long to process the attachment.', 503, '')
      attachment = await this.request<MastodonMediaAttachment>(statusUrl, { headers, signal, redirect: 'error' })
      if (!attachment.url) await Bun.sleep(1000)
    }
    if (attachment.id !== uploaded.id || typeof attachment.url !== 'string' || (attachment.type !== 'video' && attachment.type !== 'gifv'))
      throw new Error('Mastodon did not return a processed video attachment.')
    return uploaded.id
  }

  /**
   * Post a status, measured against the instance's own limits, with as many
   * images as the instance takes (each with its alt text) or one video, and the
   * Mastodon-only options in {@link MastodonPublishOptions}.
   */
  async publish(
    identity: SocialIdentityCredentials,
    post: PublishPostInput,
    options: MastodonPublishOptions = {},
  ): Promise<PublishedPost> {
    const instance = this.instanceOf(identity)
    const accessToken = this.tokenOf(identity)
    const limits = await this.instanceLimits(identity)
    if (exceedsLimit('mastodon', post.text, limits.characters, { linkLength: limits.charactersPerUrl }))
      throw new Error(`Mastodon posts on this instance must be ${limits.characters} characters or fewer.`)

    if ((options.poll || options.quotedStatusId !== undefined) && post.media?.length)
      throw new Error('Mastodon does not allow images with a poll or a quote.')
    if (post.video) {
      validatePostVideo(post.video, post.media)
      if (options.poll || options.quotedStatusId !== undefined)
        throw new Error('Mastodon does not allow a video with a poll or a quote.')
      if (limits.supportsMp4 === false)
        throw new Error('This Mastodon instance does not accept MP4 video.')
      if (limits.videoSizeLimit && post.video.bytes.length > limits.videoSizeLimit)
        throw new Error(`Video exceeds this Mastodon instance’s ${limits.videoSizeLimit}-byte limit.`)
    }
    if (options.poll && options.quotedStatusId !== undefined)
      throw new Error('Choose a poll or a quoted post on Mastodon.')
    if (options.quotedStatusId !== undefined) {
      if (!limits.quotePosts) throw new Error('This Mastodon instance does not advertise quote posts.')
      if (!/^[0-9]{1,32}$/.test(options.quotedStatusId)) throw new Error('Choose a valid Mastodon status to quote.')
    }
    const poll = options.poll ? pollPayload(options.poll, limits.poll) : undefined

    const mediaIds: string[] = []
    if (post.video) mediaIds.push(await this.uploadVideo(identity, post.video))
    for (const item of (post.media || []).slice(0, limits.mediaAttachments)) {
      const image = await resolvePostImage(item, url => this.fetchImage(url))
      if (image)
        mediaIds.push(await this.uploadMedia(identity, image.bytes, image.mimeType, item.altText))
    }

    const body: Record<string, unknown> = { status: post.text, visibility: options.visibility ?? 'public' }
    if (mediaIds.length) body.media_ids = mediaIds
    if (poll) body.poll = poll
    if (options.quotedStatusId !== undefined) body.quoted_status_id = options.quotedStatusId
    // Mastodon threads via the parent status id, carried in reply.parent.uri.
    if (post.reply?.parent?.uri) body.in_reply_to_id = post.reply.parent.uri
    if (options.spoilerText?.trim()) body.spoiler_text = options.spoilerText.trim()
    const language = options.language ?? post.langs?.[0]
    if (language) body.language = language

    const headers: Record<string, string> = { 'authorization': `Bearer ${accessToken}`, 'content-type': 'application/json' }
    if (options.idempotencyKey) headers['idempotency-key'] = options.idempotencyKey

    const status = await this.request<{ id: string, url?: string, uri?: string }>(
      `${instance}/api/v1/statuses`,
      { method: 'POST', headers, body: JSON.stringify(body) },
    )

    return {
      provider: this.provider,
      // One status id doubles as uri and cid so thread chaining, which needs
      // both, can reply to it.
      uri: status.id,
      cid: status.id,
      url: status.url || status.uri,
    }
  }

  // A home timeline needs `read:statuses`, which posting-only tokens omit.
  async timeline(_identity: SocialIdentityCredentials, _query: TimelineQuery = {}): Promise<TimelineResult> {
    return { items: [] }
  }

  /**
   * One page of the account's own statuses, newest first. Mastodon paginates
   * by `max_id` (statuses older than the last id seen), so the returned cursor
   * is the oldest id on this page. Boosts are excluded: a reblog is not this
   * account's own post to delete.
   */
  async listAuthoredPosts(
    identity: SocialIdentityCredentials,
    query: TimelineQuery = {},
  ): Promise<AuthoredPostPage> {
    const instance = this.instanceOf(identity)
    const { accountId } = await this.verifyCredentials(identity)

    const url = new URL(`${instance}/api/v1/accounts/${encodeURIComponent(accountId)}/statuses`)
    url.searchParams.set('limit', String(Math.min(Math.max(query.limit || 40, 1), 40)))
    url.searchParams.set('exclude_reblogs', 'true')
    if (query.cursor) url.searchParams.set('max_id', query.cursor)

    const statuses = await this.request<Array<{ id: string, content?: string, url?: string, created_at?: string }>>(
      url.toString(),
      { headers: { authorization: `Bearer ${this.tokenOf(identity)}` } },
    )

    const posts = (statuses || []).filter(status => status?.id).map(status => ({
      uri: status.id,
      cid: status.id,
      text: status.content,
      postedAt: status.created_at,
      url: status.url,
    }))

    return {
      cursor: posts.length ? posts[posts.length - 1]?.uri : undefined,
      posts,
    }
  }

  /**
   * Permanently delete one status. Callers that stored the public status URL
   * rather than the id can pass it as `uri` — the trailing segment is the id.
   */
  async deletePost(identity: SocialIdentityCredentials, ref: RemotePostRef): Promise<void> {
    const id = String(ref.cid || lastPathSegment(ref.uri) || '').trim()
    if (!id)
      throw new Error('A status id is required to delete a post.')

    await this.request(
      `${this.instanceOf(identity)}/api/v1/statuses/${encodeURIComponent(id)}`,
      { method: 'DELETE', headers: { authorization: `Bearer ${this.tokenOf(identity)}` } },
    )
  }

  /**
   * Favourites, boosts, replies and (from Mastodon 4.5) quotes for any number
   * of statuses, 40 to a request (`GET /api/v1/statuses?id[]=`, Mastodon
   * 4.3). An instance older than that has no such route, so it is asked one
   * status at a time. A status that is gone is left out. Mastodon counts no
   * views (stacksjs/stacks#3379).
   */
  async metrics(identity: SocialIdentityCredentials, uris: string[]): Promise<PostMetrics[]> {
    const instance = this.instanceOf(identity)
    const headers = { authorization: `Bearer ${this.tokenOf(identity)}` }
    const asked = new Map<string, string>()
    for (const uri of uris) {
      const id = String(lastPathSegment(uri) || '').trim()
      if (id) asked.set(id, uri)
    }

    const ids = [...asked.keys()]
    const statuses: MastodonStatusCounts[] = []
    for (let start = 0; start < ids.length; start += 40) {
      const chunk = ids.slice(start, start + 40)
      try {
        statuses.push(...await this.request<MastodonStatusCounts[]>(`${instance}/api/v1/statuses?${chunk.map(id => `id[]=${encodeURIComponent(id)}`).join('&')}`, { headers }))
      }
      catch (error) {
        if (!isNotFound(error)) throw error
        for (const id of chunk) {
          try {
            statuses.push(await this.request<MastodonStatusCounts>(`${instance}/api/v1/statuses/${encodeURIComponent(id)}`, { headers }))
          }
          catch (missing) {
            if (!isNotFound(missing)) throw missing
          }
        }
      }
    }

    return statuses.flatMap((status) => {
      const uri = asked.get(String(status.id))
      if (uri === undefined) return []
      return [{
        uri,
        likes: status.favourites_count ?? 0,
        reposts: status.reblogs_count ?? 0,
        replies: status.replies_count ?? 0,
        ...(typeof status.quotes_count === 'number' ? { quotes: status.quotes_count } : {}),
      }]
    })
  }

  protected async request<T>(url: string, init: RequestInit): Promise<T> {
    const response = await fetch(url, init)
    const text = await response.text()

    if (!response.ok) {
      throw new MastodonApiError(...apiFailure('Mastodon API', response, text))
    }

    return text ? JSON.parse(text) as T : {} as T
  }
}

/** The status id at the end of a Mastodon status URL. */
function lastPathSegment(value: string): string {
  return String(value || '').replace(/\/+$/, '').split('/').pop() || ''
}
