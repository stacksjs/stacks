import type { SocialApiErrorOptions } from '../errors'
import type {
  AuthoredPostPage,
  PostMetrics,
  ProviderInterface,
  PublishedPost,
  PublishPostInput,
  RemotePostRef,
  SocialDeletionDriver,
  SocialIdentityCredentials,
  SocialMetricsDriver,
  SocialPublishingDriver,
  SocialUser,
  TimelineQuery,
  TimelineResult,
  TwitterTokenResponse,
  TwitterUser,
} from '../types'
import { Buffer } from 'node:buffer'
import { fetcher } from '@stacksjs/api'
import { config } from '@stacksjs/config'
import { AbstractProvider } from '../abstract'
import { ConfigException } from '../exceptions'
import { fetchPostImage, rejectPostVideo, resolvePostImage } from '../media'
import { exceedsLimit } from '../text'
import { apiFailure, SocialApiError } from '../errors'

export class TwitterProvider extends AbstractProvider implements ProviderInterface {
  protected baseUrl = 'https://twitter.com'
  protected apiUrl = 'https://api.twitter.com'
  // X requires PKCE on every authorization. The verifier lives in the base
  // class so a callback on a fresh instance can restore it with
  // withCodeVerifier(getPkceVerifier()) instead of failing the exchange.
  protected override _usesPKCE = true

  private getConfig() {
    const providerConfig = {
      clientId: this.clientId || (config.services.twitter?.clientId ?? ''),
      clientSecret: this.clientSecret || (config.services.twitter?.clientSecret ?? ''),
      redirectUrl: this.redirectUrl || (config.services.twitter?.redirectUrl ?? ''),
      scopes: config.services.twitter?.scopes ?? ['users.read', 'tweet.read'],
    }
    this.setScopes(providerConfig.scopes)
    return providerConfig
  }

  /**
   * Get the authentication URL for Twitter.
   */
  public async getAuthUrl(): Promise<string> {
    const state = this.resolveState()
    const { clientId, redirectUrl, scopes } = this.getConfig()
    this.validateConfig()

    return `${this.baseUrl}/i/oauth2/authorize?${new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUrl,
      scope: scopes.join(' '),
      response_type: 'code',
      ...this.parameters,
      ...await this.pkceFields(),
      state,
    }).toString()}`
  }

  /**
   * Get the access token from Twitter using the authorization code.
   */
  public async getAccessToken(code: string): Promise<string> {
    const { clientId, clientSecret, redirectUrl } = this.getConfig()
    this.validateConfig()

    // Throws when no verifier is known: restore it with withCodeVerifier().
    const pkce = this.pkceTokenFields()
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

    const response = await fetcher
      .asForm()
      .withHeaders({
        'Authorization': `Basic ${basicAuth}`,
      })
      .post<TwitterTokenResponse>(`${this.apiUrl}/2/oauth2/token`, {
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUrl,
        ...pkce,
      })

    if (response.data.error) {
      throw new Error(`Twitter OAuth error: ${response.data.error_description}`)
    }

    return response.data.access_token
  }

  /**
   * Get the user details from Twitter using the access token.
   * Maps the Twitter-specific user data to our normalized SocialUser type.
   */
  public async getUserByToken(token: string): Promise<SocialUser> {
    const response = await fetcher
      .withHeaders({
        Authorization: `Bearer ${token}`,
      })
      .get<TwitterUser>(`${this.apiUrl}/2/users/me?user.fields=profile_image_url`)

    return {
      id: response.data.id,
      nickname: response.data.username,
      name: response.data.name,
      email: response.data.email ?? null,
      avatar: response.data.profile_image_url ?? null,
      token,
      raw: response.data,
    }
  }

  /**
   * Validate the provider configuration.
   */
  protected validateConfig(): void {
    const { clientId, clientSecret, redirectUrl } = this.getConfig()

    if (!clientId)
      throw new ConfigException('Twitter client ID not provided')

    if (!clientSecret)
      throw new ConfigException('Twitter client secret not provided')

    if (!redirectUrl)
      throw new ConfigException('Twitter redirect URL not provided')
  }

  protected getTokenUrl(): string {
    return `${this.apiUrl}/2/oauth2/token`
  }
}

/**
 * Publishing driver for X/Twitter.
 *
 * Separate from `TwitterProvider` above, which only signs users in. Auth here
 * is OAuth 2.0 with PKCE (X's user-context flow); posting is `POST /2/tweets`,
 * images upload first via `POST /2/media/upload` and attach by media id, and
 * threads chain through `reply.in_reply_to_tweet_id`.
 *
 * Posting on X requires a paid API tier, so this is exercised against mocked
 * endpoints; the request shapes follow X's documented v2 API.
 */
export class TwitterApiError extends SocialApiError {
  constructor(message: string, status: number, body: string, options: SocialApiErrorOptions = {}) {
    super('twitter', message, status, body, options)
    this.name = 'TwitterApiError'
  }

  get isAuthError(): boolean {
    return this.kind === 'expired'
  }
}

export interface TwitterDriverOptions {
  apiBase?: string
  authorizeBase?: string
}

/** X attaches up to four images to a post. */
export const X_MAX_IMAGES = 4
/** X's limit for an image description. */
export const X_MAX_ALT_TEXT = 1000

export interface TwitterAuthUrlInput {
  clientId: string
  redirectUrl: string
  scopes: string[]
  state: string
}

export interface TwitterTokenExchangeInput {
  clientId: string
  clientSecret?: string
  redirectUrl: string
  code: string
  codeVerifier: string
}

export interface TwitterRefreshInput {
  clientId: string
  clientSecret?: string
  refreshToken: string
}

export interface TwitterToken {
  accessToken: string
  refreshToken?: string
  expiresIn?: number
  scope?: string
}

export interface TwitterProfile {
  id: string
  username: string
  name?: string
}

export interface TwitterDirectMessageEvent {
  id: string
  dm_conversation_id: string
  sender_id?: string
  participant_ids?: string[]
  created_at?: string
  text?: string
  attachments?: { media_keys?: string[], card_ids?: string[] }
}

export interface TwitterDirectMessagePage {
  events: TwitterDirectMessageEvent[]
  users: Array<TwitterProfile & { profile_image_url?: string }>
  cursor?: string
}

function directMessageConversationId(id: string): string {
  if (!/^\d{1,19}(?:-\d{1,19})?$/.test(id)) throw new Error('An X direct-message conversation id is required.')
  return id
}

/** base64url with padding stripped — the encoding OAuth2/PKCE expects. */
function base64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export class TwitterPublishingDriver implements SocialPublishingDriver, SocialDeletionDriver, SocialMetricsDriver {
  readonly provider: 'twitter' = 'twitter'
  characterLimit = 280
  /** Images attached per post. X's own ceiling; an app may lower it. */
  maxImages = X_MAX_IMAGES
  /** Downloads an image given by address. Guarded against private addresses; replace it in a test. */
  fetchImage = fetchPostImage

  protected apiBase: string
  protected authorizeBase: string

  constructor(options: TwitterDriverOptions = {}) {
    this.apiBase = options.apiBase || 'https://api.twitter.com'
    this.authorizeBase = options.authorizeBase || 'https://twitter.com'
  }

  /**
   * Build the OAuth 2.0 consent URL with a PKCE challenge, returning both the
   * URL and the `code_verifier` the caller must stash for the token exchange.
   */
  async createAuthorization(input: TwitterAuthUrlInput): Promise<{ url: string, codeVerifier: string }> {
    const codeVerifier = base64Url(crypto.getRandomValues(new Uint8Array(32)))
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier))
    const codeChallenge = base64Url(new Uint8Array(digest))

    const query = new URLSearchParams({
      response_type: 'code',
      client_id: input.clientId,
      redirect_uri: input.redirectUrl,
      scope: input.scopes.join(' '),
      state: input.state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    })

    return { url: `${this.authorizeBase}/i/oauth2/authorize?${query.toString()}`, codeVerifier }
  }

  /** Exchange an authorization code (+ PKCE verifier) for user tokens. */
  async exchangeCode(input: TwitterTokenExchangeInput): Promise<TwitterToken> {
    return this.tokenRequest(new URLSearchParams({
      grant_type: 'authorization_code',
      code: input.code,
      redirect_uri: input.redirectUrl,
      code_verifier: input.codeVerifier,
      client_id: input.clientId,
    }), input.clientId, input.clientSecret)
  }

  /** Mint a fresh access token from a stored refresh token. */
  async refreshAccessToken(input: TwitterRefreshInput): Promise<TwitterToken> {
    return this.tokenRequest(new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: input.refreshToken,
      client_id: input.clientId,
    }), input.clientId, input.clientSecret)
  }

  /** Resolve the authenticated account (id + handle). */
  async getProfile(accessToken: string): Promise<TwitterProfile> {
    const payload = await this.request<{ data?: { id: string, username: string, name?: string } }>(
      `${this.apiBase}/2/users/me?user.fields=username,name`,
      { headers: { authorization: `Bearer ${accessToken}` } },
    )
    if (!payload.data?.id || !payload.data.username) {
      throw new TwitterApiError('Twitter did not return the authenticated user.', 400, JSON.stringify(payload))
    }
    return { id: payload.data.id, username: payload.data.username, name: payload.data.name }
  }

  /** Upload one image and return its media id for attachment. */
  async uploadMedia(accessToken: string, bytes: Uint8Array, mimeType: string): Promise<string> {
    const form = new FormData()
    form.set('media', new Blob([new Uint8Array(bytes)], { type: mimeType || 'image/jpeg' }))
    form.set('media_category', 'tweet_image')

    const payload = await this.request<{ data?: { id?: string }, media_id_string?: string, id?: string }>(
      `${this.apiBase}/2/media/upload`,
      { method: 'POST', headers: { authorization: `Bearer ${accessToken}` }, body: form },
    )

    const mediaId = payload.data?.id || payload.media_id_string || payload.id
    if (!mediaId) {
      throw new TwitterApiError('Twitter did not return a media id.', 400, JSON.stringify(payload))
    }
    return mediaId
  }

  /**
   * Describe an uploaded image (`POST /2/media/metadata`). Best effort: a post
   * without its alt text is still better than no post, so a refusal returns
   * false rather than throwing.
   */
  async describeMedia(accessToken: string, mediaId: string, altText: string): Promise<boolean> {
    try {
      await this.request(`${this.apiBase}/2/media/metadata`, {
        method: 'POST',
        headers: { 'authorization': `Bearer ${accessToken}`, 'content-type': 'application/json' },
        body: JSON.stringify({ id: mediaId, metadata: { alt_text: { text: altText.slice(0, X_MAX_ALT_TEXT) } } }),
      })
      return true
    }
    catch {
      return false
    }
  }

  /**
   * Post a tweet with up to four images, each with its alt text.
   *
   * The length is X's weighted count (CJK and emoji count two, a link 23),
   * not UTF-16 units. An image given by address is downloaded through the
   * outbound guard, and one that cannot be read fails the post rather than
   * going out without it.
   */
  async publish(identity: SocialIdentityCredentials, post: PublishPostInput): Promise<PublishedPost> {
    rejectPostVideo(post, 'X')
    if (!identity.accessToken) throw new Error('Twitter access token is missing for this identity.')
    if (exceedsLimit('twitter', post.text, this.characterLimit)) {
      throw new Error(`Twitter posts must be ${this.characterLimit} characters or fewer.`)
    }

    const mediaIds: string[] = []
    const warnings: string[] = []
    for (const item of (post.media ?? []).slice(0, this.maxImages)) {
      const image = await resolvePostImage(item, url => this.fetchImage(url))
      if (!image) continue
      const mediaId = await this.uploadMedia(identity.accessToken, image.bytes, image.mimeType)
      const altText = item.altText?.trim()
      if (altText && !await this.describeMedia(identity.accessToken, mediaId, altText))
        warnings.push(`X did not take the description for image ${mediaIds.length + 1}.`)
      mediaIds.push(mediaId)
    }

    const body: Record<string, unknown> = { text: post.text }
    if (mediaIds.length) body.media = { media_ids: mediaIds }
    if (post.reply?.parent?.uri) body.reply = { in_reply_to_tweet_id: post.reply.parent.uri }

    const payload = await this.request<{ data?: { id?: string } }>(
      `${this.apiBase}/2/tweets`,
      {
        method: 'POST',
        headers: { 'authorization': `Bearer ${identity.accessToken}`, 'content-type': 'application/json' },
        body: JSON.stringify(body),
      },
    )

    const id = payload.data?.id
    if (!id) throw new TwitterApiError('Twitter did not return a tweet id.', 400, JSON.stringify(payload))

    return {
      provider: this.provider,
      // The tweet id doubles as uri and cid so thread chaining, which needs a
      // cid, can reply-chain subsequent segments.
      uri: id,
      cid: id,
      url: identity.handle
        ? `https://x.com/${identity.handle}/status/${id}`
        : `https://x.com/i/web/status/${id}`,
      ...(warnings.length ? { warnings } : {}),
    }
  }

  // X's home timeline needs elevated access this driver does not assume.
  async timeline(_identity: SocialIdentityCredentials, _query: TimelineQuery = {}): Promise<TimelineResult> {
    return { items: [] }
  }

  /**
   * One page of the account's own tweets, newest first. X caps
   * `GET /2/users/:id/tweets` at 3,200 tweets of history — anything older
   * cannot be enumerated, and therefore cannot be bulk-deleted, through the API.
   */
  async listAuthoredPosts(
    identity: SocialIdentityCredentials,
    query: TimelineQuery = {},
  ): Promise<AuthoredPostPage> {
    if (!identity.accessToken) throw new Error('Twitter access token is missing for this identity.')
    const userId = identity.did
    if (!userId) throw new Error('Twitter user id is required to list posts.')

    const url = new URL(`${this.apiBase}/2/users/${encodeURIComponent(userId)}/tweets`)
    url.searchParams.set('max_results', String(Math.min(Math.max(query.limit || 100, 5), 100)))
    url.searchParams.set('tweet.fields', 'created_at')
    if (query.cursor) url.searchParams.set('pagination_token', query.cursor)

    const payload = await this.request<{
      data?: Array<{ id: string, text?: string, created_at?: string }>
      meta?: { next_token?: string }
    }>(url.toString(), { headers: { authorization: `Bearer ${identity.accessToken}` } })

    return {
      cursor: payload.meta?.next_token,
      posts: (payload.data || []).filter(tweet => tweet?.id).map(tweet => ({
        uri: tweet.id,
        cid: tweet.id,
        text: tweet.text,
        postedAt: tweet.created_at,
        url: `https://x.com/i/web/status/${tweet.id}`,
      })),
    }
  }

  /**
   * One page of the user's message creation events. Reads are billable. Only
   * the sender is expanded, so each event can add at most one billable user.
   */
  async listDirectMessageEvents(
    identity: SocialIdentityCredentials,
    query: TimelineQuery & { conversationId?: string } = {},
  ): Promise<TwitterDirectMessagePage> {
    if (!identity.accessToken) throw new Error('Twitter access token is missing for this identity.')
    const endpoint = query.conversationId === undefined
      ? '/2/dm_events'
      : `/2/dm_conversations/${directMessageConversationId(query.conversationId)}/dm_events`
    const url = new URL(`${this.apiBase}${endpoint}`)
    const requested = query.limit ?? 50
    const limit = Number.isFinite(requested) ? Math.max(1, Math.min(100, Math.trunc(requested))) : 50
    url.searchParams.set('max_results', String(limit))
    url.searchParams.set('event_types', 'MessageCreate')
    url.searchParams.set('dm_event.fields', 'attachments,created_at,dm_conversation_id,text')
    url.searchParams.set('expansions', 'sender_id')
    url.searchParams.set('user.fields', 'profile_image_url')
    if (query.cursor) url.searchParams.set('pagination_token', query.cursor)

    const payload = await this.request<{
      data?: TwitterDirectMessageEvent[]
      includes?: { users?: TwitterDirectMessagePage['users'] }
      meta?: { next_token?: string }
      errors?: unknown[]
    }>(url.toString(), { headers: { authorization: `Bearer ${identity.accessToken}` } })

    if (!payload.data?.length && payload.errors?.length)
      throw new TwitterApiError('X did not return the requested direct messages.', 502, JSON.stringify(payload))

    return { events: payload.data ?? [], users: payload.includes?.users ?? [], cursor: payload.meta?.next_token }
  }

  /** Send one text reply to an existing conversation using the user's token. */
  async sendDirectMessage(
    identity: SocialIdentityCredentials,
    conversationId: string,
    text: string,
  ): Promise<{ conversationId: string, eventId: string }> {
    if (!identity.accessToken) throw new Error('Twitter access token is missing for this identity.')
    if (!text.trim()) throw new Error('Write a message before sending.')
    const id = directMessageConversationId(conversationId)
    const payload = await this.request<{ data?: { dm_conversation_id?: string, dm_event_id?: string } }>(
      `${this.apiBase}/2/dm_conversations/${id}/messages`,
      {
        method: 'POST',
        headers: { 'authorization': `Bearer ${identity.accessToken}`, 'content-type': 'application/json' },
        body: JSON.stringify({ text }),
      },
    )
    const eventId = payload.data?.dm_event_id
    if (payload.data?.dm_conversation_id !== id || !eventId || !/^\d{1,19}$/.test(eventId))
      throw new TwitterApiError('X did not confirm the reply. Refresh the conversation before sending again.', 502, JSON.stringify(payload))

    return { conversationId: id, eventId }
  }

  /** Read public engagement for published post IDs, up to 100 per request. */
  async metrics(identity: SocialIdentityCredentials, uris: string[]): Promise<PostMetrics[]> {
    const ids = [...new Set(uris.filter(id => /^[0-9]{1,19}$/.test(id)))]
    if (!ids.length) return []
    if (!identity.accessToken) throw new Error('Twitter access token is missing for this identity.')

    const results: PostMetrics[] = []
    const headers = { authorization: `Bearer ${identity.accessToken}` }
    for (let offset = 0; offset < ids.length; offset += 100) {
      const chunk = ids.slice(offset, offset + 100)
      const query = new URLSearchParams({ 'ids': chunk.join(','), 'tweet.fields': 'public_metrics' })
      const payload = await this.request<{ data?: Array<{ id: string, public_metrics?: Record<string, number> }> }>(
        `${this.apiBase}/2/tweets?${query}`,
        { headers },
      )
      const requested = new Set(chunk)
      for (const post of payload.data ?? []) {
        const counts = post.public_metrics
        if (!counts || !requested.delete(post.id)) continue
        const fields = {
          likes: counts.like_count,
          replies: counts.reply_count,
          reposts: counts.repost_count ?? counts.retweet_count,
          quotes: counts.quote_count,
          views: counts.impression_count,
          saves: counts.bookmark_count,
        }
        const reported = Object.entries(fields).filter(([, value]) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0)
        if (reported.length) results.push({ uri: post.id, ...Object.fromEntries(reported) })
      }
    }
    return results
  }

  /** Permanently delete one tweet. */
  async deletePost(identity: SocialIdentityCredentials, ref: RemotePostRef): Promise<void> {
    if (!identity.accessToken) throw new Error('Twitter access token is missing for this identity.')
    const id = String(ref.uri || '').trim()
    if (!id) throw new Error('A tweet id is required to delete a post.')

    const payload = await this.request<{ data?: { deleted?: boolean } }>(
      `${this.apiBase}/2/tweets/${encodeURIComponent(id)}`,
      { method: 'DELETE', headers: { authorization: `Bearer ${identity.accessToken}` } },
    )

    // X answers 200 with `deleted: false` when the tweet is not the caller's.
    if (payload.data && payload.data.deleted === false) {
      throw new TwitterApiError(`X refused to delete tweet ${id}.`, 400, JSON.stringify(payload))
    }
  }

  protected async tokenRequest(body: URLSearchParams, clientId: string, clientSecret?: string): Promise<TwitterToken> {
    const headers: Record<string, string> = { 'content-type': 'application/x-www-form-urlencoded' }
    // Confidential clients authenticate the token endpoint with HTTP Basic;
    // public (PKCE-only) clients send just the client_id in the body.
    if (clientSecret) headers.authorization = `Basic ${btoa(`${clientId}:${clientSecret}`)}`

    const payload = await this.request<{
      access_token?: string
      refresh_token?: string
      expires_in?: number
      scope?: string
    }>(`${this.apiBase}/2/oauth2/token`, { method: 'POST', headers, body: body.toString() })

    if (!payload.access_token) {
      throw new TwitterApiError('Twitter did not return an access token.', 400, JSON.stringify(payload))
    }

    return {
      accessToken: payload.access_token,
      refreshToken: payload.refresh_token,
      expiresIn: payload.expires_in,
      scope: payload.scope,
    }
  }

  protected async request<T>(url: string, init: RequestInit): Promise<T> {
    const response = await fetch(url, init)
    const text = await response.text()

    if (!response.ok) {
      throw new TwitterApiError(...apiFailure('Twitter API', response, text))
    }

    return text ? JSON.parse(text) as T : {} as T
  }
}
