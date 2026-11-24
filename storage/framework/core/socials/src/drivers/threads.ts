import type {
  PublishedPost,
  PublishPostInput,
  SocialIdentityCredentials,
  SocialPublishingDriver,
  TimelineQuery,
  TimelineResult,
} from '../types'
import { exceedsLimit } from '../text'

/** Items Threads takes in one carousel. */
export const THREADS_MAX_IMAGES = 20
/** Threads' limit for an image description. */
export const THREADS_MAX_ALT_TEXT = 1000

export interface ThreadsLongLivedToken {
  accessToken: string
  expiresIn?: number
}

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
  /** Images attached per post. Threads' own ceiling; an app may lower it. */
  maxImages = THREADS_MAX_IMAGES

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
    })

    const payload = await this.graph<{ id?: string, username?: string }>(
      `/me?${query.toString()}`,
      { method: 'GET' },
      accessToken,
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

  /**
   * Exchange a short-lived token (about an hour, what {@link exchangeCode}
   * returns) for a long-lived one of about sixty days. Needs the app secret.
   */
  async exchangeLongLivedToken(clientSecret: string, shortLivedToken: string): Promise<ThreadsLongLivedToken> {
    return this.tokenRequest('/access_token', new URLSearchParams({
      grant_type: 'th_exchange_token',
      client_secret: clientSecret,
      access_token: shortLivedToken,
    }))
  }

  /**
   * Refresh a long-lived token for another sixty days. Threads requires it
   * to be at least a day old and not yet expired.
   */
  async refreshLongLivedToken(accessToken: string): Promise<ThreadsLongLivedToken> {
    return this.tokenRequest('/refresh_access_token', new URLSearchParams({
      grant_type: 'th_refresh_token',
      access_token: accessToken,
    }))
  }

  /**
   * Publish one post: text, one image, or a carousel of two or more, each
   * image with its alt text.
   *
   * A post that continues a thread is sent with `reply_to_id`, and the post
   * id comes back as both `uri` and `cid`, which is what chaining the next
   * segment needs; without them every segment went out as a separate post.
   * The length is counted in graphemes, as Threads counts it.
   *
   * Threads fetches each image from its address, so an image with only bytes
   * is refused rather than dropped from the post.
   */
  async publish(identity: SocialIdentityCredentials, post: PublishPostInput): Promise<PublishedPost> {
    if (!identity.accessToken) throw new Error('Threads access token is missing for this identity.')

    // `did` carries the Threads user id for Threads identities.
    const threadsUserId = identity.did
    if (!threadsUserId) throw new Error('Threads account id is required to publish.')

    if (exceedsLimit('threads', post.text, this.characterLimit)) {
      throw new Error(`Threads posts must be ${this.characterLimit} characters or fewer.`)
    }

    const images = (post.media ?? []).slice(0, this.maxImages)
    if (images.some(image => !image.url))
      throw new ThreadsApiError('Threads fetches images from a public address, and this image has none.', 422, '')

    const accessToken = identity.accessToken
    const create = async (fields: Record<string, string>): Promise<string> => {
      const container = await this.graph<{ id?: string }>(
        `/${threadsUserId}/threads`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams(fields).toString(),
        },
        accessToken,
      )
      if (!container.id)
        throw new ThreadsApiError('Threads did not return a media container id.', 400, JSON.stringify(container))
      return container.id
    }

    const parent = post.reply?.parent?.uri
    const postFields: Record<string, string> = { text: post.text, ...(parent ? { reply_to_id: parent } : {}) }
    const imageFields = (image: { url?: string, altText?: string }): Record<string, string> => ({
      media_type: 'IMAGE',
      image_url: image.url!,
      ...(image.altText?.trim() ? { alt_text: image.altText.trim().slice(0, THREADS_MAX_ALT_TEXT) } : {}),
    })

    // 1) Create the container: one per carousel item, then one that holds them.
    let creationId: string
    if (images.length > 1) {
      const children: string[] = []
      for (const image of images) children.push(await create({ ...imageFields(image), is_carousel_item: 'true' }))
      creationId = await create({ media_type: 'CAROUSEL', children: children.join(','), ...postFields })
    }
    else if (images.length === 1) {
      creationId = await create({ ...imageFields(images[0]!), ...postFields })
    }
    else {
      creationId = await create({ media_type: 'TEXT', ...postFields })
    }

    // 2) Publish the container.
    const published = await this.graph<{ id?: string }>(
      `/${threadsUserId}/threads_publish`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ creation_id: creationId }).toString(),
      },
      accessToken,
    )

    if (!published.id) {
      throw new ThreadsApiError('Threads did not return a published post id.', 400, JSON.stringify(published))
    }

    const permalink = await this.graph<{ permalink?: string }>(
      `/${published.id}?fields=permalink`,
      { method: 'GET' },
      accessToken,
    ).catch(() => undefined)

    return {
      provider: this.provider,
      // The post id doubles as uri and cid so a thread can chain replies to it.
      uri: published.id,
      cid: published.id,
      url: permalink?.permalink,
    }
  }

  // The Content Publishing scope does not grant a readable home timeline.
  async timeline(_identity: SocialIdentityCredentials, _query: TimelineQuery = {}): Promise<TimelineResult> {
    return { items: [] }
  }

  /**
   * The two long-lived token endpoints. They are unversioned, so they do not
   * go through {@link graph}. The token goes in a POST body, never the URL,
   * for the reason {@link graph} gives. Probed live: a bad token in the body
   * answers `Cannot parse access token`, as the documented query form does,
   * while a body with none answers `Invalid OAuth 2.0 Access Token`.
   */
  protected async tokenRequest(path: string, body: URLSearchParams): Promise<ThreadsLongLivedToken> {
    const response = await fetch(`${this.graphBase}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
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
      const message = json?.error?.message || json?.error_message || text || response.statusText
      throw new ThreadsApiError(`Threads token request failed (${response.status}): ${message}`, response.status, text)
    }

    return { accessToken: json.access_token, expiresIn: json.expires_in }
  }

  /**
   * One request to the Threads API, with the credential in a header.
   *
   * `token` is a parameter of this helper rather than something a caller puts
   * in the path or the body. A URL is the one part of a request that is logged
   * by default everywhere it passes, so a long-lived publishing token in a
   * query string is a credential sitting in files nobody treats as secret
   * (stacksjs/stacks#2882). Verified against the live API: a bad token in this
   * header answers `Cannot parse access token`, the same as the query form,
   * while sending none answers `Invalid OAuth 2.0 Access Token`.
   */
  protected async graph<T>(path: string, init: RequestInit, token?: string): Promise<T> {
    const headers = new Headers(init.headers)
    if (token) headers.set('authorization', `Bearer ${token}`)

    const response = await fetch(`${this.graphBase}/${this.graphVersion}${path}`, { ...init, headers })
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
