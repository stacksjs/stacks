import type {
  PublishedPost,
  PublishPostInput,
  SocialIdentityCredentials,
  SocialPublishingDriver,
  TimelineQuery,
  TimelineResult,
} from '../types'

export class ThreadsApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body: string,
  ) {
    super(message)
    this.name = 'ThreadsApiError'
  }

  get isAuthError(): boolean {
    // 190 is Graph's "access token expired/invalid" subcode surfaced as status.
    return this.status === 401 || this.status === 403 || this.status === 190
  }
}

export interface ThreadsDriverOptions {
  /** Threads Graph API version, e.g. `v1.0`. */
  graphVersion?: string
  /** OAuth dialog host — `https://threads.net`. */
  authBase?: string
  /** Graph API host — `https://graph.threads.net`. */
  graphBase?: string
}

export interface ThreadsAuthUrlInput {
  clientId: string
  redirectUrl: string
  scopes: string[]
  state: string
}

export interface ThreadsTokenExchangeInput {
  clientId: string
  clientSecret: string
  redirectUrl: string
  code: string
}

export interface ThreadsAccount {
  /** Threads user id (the publishing target). */
  threadsUserId: string
  username?: string
  /** Access token used for content publishing. */
  accessToken: string
}

/**
 * Publishing driver for Threads (Meta) via the Threads Graph API. Auth is the
 * Threads OAuth flow (`threads.net/oauth/authorize`, scopes `threads_basic` +
 * `threads_content_publish`). Publishing is the documented two-step flow:
 * create a media container, then publish it.
 *
 * Unlike Instagram, Threads allows text-only posts — `post.media` is optional
 * and, when present, the container is created as an `IMAGE` instead of `TEXT`.
 */
export class ThreadsPublishingDriver implements SocialPublishingDriver {
  readonly provider: 'threads' = 'threads'
  characterLimit = 500

  protected graphVersion: string
  protected authBase: string
  protected graphBase: string

  constructor(options: ThreadsDriverOptions = {}) {
    this.graphVersion = options.graphVersion || 'v1.0'
    this.authBase = options.authBase || 'https://threads.net'
    this.graphBase = options.graphBase || 'https://graph.threads.net'
  }

  /** Build the Threads OAuth consent URL. */
  getAuthUrl(input: ThreadsAuthUrlInput): string {
    const query = new URLSearchParams({
      client_id: input.clientId,
      redirect_uri: input.redirectUrl,
      scope: input.scopes.join(','),
      response_type: 'code',
      state: input.state,
    })

    return `${this.authBase}/oauth/authorize?${query.toString()}`
  }

  /**
   * Exchange an authorization code for a short-lived user access token. The
   * Threads token endpoint is unversioned and expects a POST form body.
   */
  async exchangeCode(input: ThreadsTokenExchangeInput): Promise<{ accessToken: string, userId?: string, expiresIn?: number }> {
    const response = await fetch(`${this.graphBase}/oauth/access_token`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: input.clientId,
        client_secret: input.clientSecret,
        grant_type: 'authorization_code',
        redirect_uri: input.redirectUrl,
        code: input.code,
      }).toString(),
    })

    const text = await response.text()
    let json: any = {}
    try {
      json = text ? JSON.parse(text) : {}
    }
    catch {
      json = {}
    }

    if (!response.ok || json?.error || !json?.access_token) {
      const message = json?.error_message || json?.error?.message || text || response.statusText
      throw new ThreadsApiError(`Threads token exchange failed (${response.status}): ${message}`, response.status, text)
    }

    return {
      accessToken: json.access_token,
      userId: json.user_id != null ? String(json.user_id) : undefined,
      expiresIn: json.expires_in,
    }
  }

  /** Resolve the Threads account (id + username) for an access token. */
  async resolveAccount(accessToken: string): Promise<ThreadsAccount> {
    const query = new URLSearchParams({
      fields: 'id,username',
      access_token: accessToken,
    })

    const payload = await this.graph<{ id?: string, username?: string }>(
      `/me?${query.toString()}`,
      { method: 'GET' },
    )

    if (!payload.id) {
      throw new ThreadsApiError(
        'Could not resolve the Threads account for this token.',
        400,
        JSON.stringify(payload),
      )
    }

    return {
      threadsUserId: payload.id,
      username: payload.username,
      accessToken,
    }
  }

  async publish(identity: SocialIdentityCredentials, post: PublishPostInput): Promise<PublishedPost> {
    if (!identity.accessToken) throw new Error('Threads access token is missing for this identity.')

    // `did` carries the Threads user id for Threads identities.
    const threadsUserId = identity.did
    if (!threadsUserId) throw new Error('Threads account id is required to publish.')

    if (post.text.length > this.characterLimit) {
      throw new Error(`Threads posts must be ${this.characterLimit} characters or fewer.`)
    }

    // 1) Create the media container. Text-only by default; if an image is
    // attached, create an IMAGE container instead (Threads also supports VIDEO,
    // but we only surface images from the composer today).
    const media = post.media?.[0]
    const containerBody = new URLSearchParams({
      text: post.text,
      access_token: identity.accessToken,
    })
    if (media?.url) {
      containerBody.set('media_type', 'IMAGE')
      containerBody.set('image_url', media.url)
    }
    else {
      containerBody.set('media_type', 'TEXT')
    }

    const container = await this.graph<{ id: string }>(
      `/${threadsUserId}/threads`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: containerBody.toString(),
      },
    )

    if (!container.id) {
      throw new ThreadsApiError('Threads did not return a media container id.', 400, JSON.stringify(container))
    }

    // 2) Publish the container.
    const published = await this.graph<{ id: string }>(
      `/${threadsUserId}/threads_publish`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          creation_id: container.id,
          access_token: identity.accessToken,
        }).toString(),
      },
    )

    if (!published.id) {
      throw new ThreadsApiError('Threads did not return a published post id.', 400, JSON.stringify(published))
    }

    const permalink = await this.graph<{ permalink?: string }>(
      `/${published.id}?fields=permalink&access_token=${encodeURIComponent(identity.accessToken)}`,
      { method: 'GET' },
    ).catch(() => undefined)

    return {
      provider: this.provider,
      uri: published.id,
      url: permalink?.permalink,
    }
  }

  // The Content Publishing scope does not grant a readable home timeline.
  async timeline(_identity: SocialIdentityCredentials, _query: TimelineQuery = {}): Promise<TimelineResult> {
    return { items: [] }
  }

  protected async graph<T>(path: string, init: RequestInit): Promise<T> {
    const response = await fetch(`${this.graphBase}/${this.graphVersion}${path}`, init)
    const text = await response.text()
    let json: any = {}
    try {
      json = text ? JSON.parse(text) : {}
    }
    catch {
      json = {}
    }

    if (!response.ok || json?.error) {
      const message = json?.error?.message || text || response.statusText
      throw new ThreadsApiError(`Threads API failed (${response.status}): ${message}`, response.status, text)
    }

    return json as T
  }
}
