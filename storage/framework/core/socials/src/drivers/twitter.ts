import type {
  AuthoredPostPage,
  ProviderInterface,
  PublishedPost,
  PublishPostInput,
  RemotePostRef,
  SocialDeletionDriver,
  SocialIdentityCredentials,
  SocialPublishingDriver,
  SocialUser,
  TimelineQuery,
  TimelineResult,
  TwitterTokenResponse,
  TwitterUser,
} from '../types'
import { Buffer } from 'node:buffer'
import { createHash, randomBytes } from 'node:crypto'
import { fetcher } from '@stacksjs/api'
import { config } from '@stacksjs/config'
import { AbstractProvider } from '../abstract'
import { ConfigException } from '../exceptions'

export class TwitterProvider extends AbstractProvider implements ProviderInterface {
  protected baseUrl = 'https://twitter.com'
  protected apiUrl = 'https://api.twitter.com'
  private codeVerifier: string | null = null

  private getConfig() {
    const providerConfig = {
      clientId: config.services.twitter?.clientId ?? '',
      clientSecret: config.services.twitter?.clientSecret ?? '',
      redirectUrl: config.services.twitter?.redirectUrl ?? '',
      scopes: config.services.twitter?.scopes ?? ['users.read', 'tweet.read'],
    }
    this.setScopes(providerConfig.scopes)
    return providerConfig
  }

  /**
   * Generate a code verifier for PKCE.
   */
  private generateCodeVerifier(): string {
    return randomBytes(32)
      .toString('base64')
      .replace(/[^a-z0-9]/gi, '')
      .substring(0, 128)
  }

  /**
   * Generate a code challenge from the code verifier.
   */
  private generateCodeChallenge(codeVerifier: string): string {
    return createHash('sha256')
      .update(codeVerifier)
      .digest('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '')
  }

  /**
   * Get the authentication URL for Twitter.
   */
  public async getAuthUrl(): Promise<string> {
    const state = this.getState()
    const { clientId, redirectUrl, scopes } = this.getConfig()
    this.validateConfig()

    // Generate and store PKCE values
    this.codeVerifier = this.generateCodeVerifier()
    const codeChallenge = this.generateCodeChallenge(this.codeVerifier)

    return `${this.baseUrl}/i/oauth2/authorize?${new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUrl,
      scope: scopes.join(' '),
      state,
      response_type: 'code',
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    }).toString()}`
  }

  /**
   * Get the access token from Twitter using the authorization code.
   */
  public async getAccessToken(code: string): Promise<string> {
    const { clientId, clientSecret, redirectUrl } = this.getConfig()
    this.validateConfig()

    if (!this.codeVerifier) {
      throw new Error('Code verifier not found. Please ensure getAuthUrl() is called first.')
    }

    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

    const response = await fetcher
      .withHeaders({
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      })
      .post<TwitterTokenResponse>(`${this.apiUrl}/2/oauth2/token`, {
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUrl,
        code_verifier: this.codeVerifier,
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
export class TwitterApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body: string,
  ) {
    super(message)
    this.name = 'TwitterApiError'
  }

  get isAuthError(): boolean {
    return this.status === 401 || this.status === 403
  }
}

export interface TwitterDriverOptions {
  apiBase?: string
  authorizeBase?: string
}

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

/** base64url with padding stripped — the encoding OAuth2/PKCE expects. */
function base64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export class TwitterPublishingDriver implements SocialPublishingDriver, SocialDeletionDriver {
  readonly provider: 'twitter' = 'twitter'
  characterLimit = 280

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

  async publish(identity: SocialIdentityCredentials, post: PublishPostInput): Promise<PublishedPost> {
    if (!identity.accessToken) throw new Error('Twitter access token is missing for this identity.')
    if (post.text.length > this.characterLimit) {
      throw new Error(`Twitter posts must be ${this.characterLimit} characters or fewer.`)
    }

    // Uploaded files arrive as bytes; a bare URL is fetched first.
    const mediaIds: string[] = []
    const media = post.media?.[0]
    if (media) {
      let bytes = media.bytes
      let mimeType = media.mimeType
      if (!bytes?.length && media.url) {
        const response = await fetch(media.url)
        if (response.ok) {
          bytes = new Uint8Array(await response.arrayBuffer())
          mimeType = mimeType || response.headers.get('content-type') || 'image/jpeg'
        }
      }
      if (bytes?.length) mediaIds.push(await this.uploadMedia(identity.accessToken, bytes, mimeType || 'image/jpeg'))
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
      throw new TwitterApiError(
        `Twitter API failed (${response.status}): ${text || response.statusText}`,
        response.status,
        text,
      )
    }

    return text ? JSON.parse(text) as T : {} as T
  }
}
