import type {
  PublishedPost,
  PublishPostInput,
  SocialIdentityCredentials,
  SocialPublishingDriver,
  TimelineQuery,
  TimelineResult,
} from '../types'
import { META_GRAPH_VERSION } from '../meta-graph'

export class InstagramApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body: string,
  ) {
    super(message)
    this.name = 'InstagramApiError'
  }

  get isAuthError(): boolean {
    // 190 is Graph's "access token expired/invalid" subcode surfaced as status.
    return this.status === 401 || this.status === 403 || this.status === 190
  }
}

export interface InstagramDriverOptions {
  /** Facebook Graph API version, e.g. `v21.0`. */
  graphVersion?: string
  authBase?: string
  graphBase?: string
}

export interface InstagramAuthUrlInput {
  clientId: string
  redirectUrl: string
  scopes: string[]
  state: string
}

export interface InstagramTokenExchangeInput {
  clientId: string
  clientSecret: string
  redirectUrl: string
  code: string
}

export interface InstagramAccount {
  /** Instagram Business/Creator account id (the publishing target). */
  igUserId: string
  username?: string
  /** Page access token used for content publishing. */
  pageAccessToken: string
}

/**
 * Publishing driver for Instagram Business/Creator accounts via the Facebook
 * Graph API. Auth is Facebook Login (OAuth 2.0). Publishing is the documented
 * two-step flow: create a media container, then publish it.
 *
 * Instagram does not allow text-only posts — every post requires an image (or
 * video) reachable at a public URL, supplied via `post.media`.
 */
export class InstagramPublishingDriver implements SocialPublishingDriver {
  readonly provider: 'instagram' = 'instagram'
  characterLimit = 2200

  protected graphVersion: string
  protected authBase: string
  protected graphBase: string

  constructor(options: InstagramDriverOptions = {}) {
    this.graphVersion = options.graphVersion || META_GRAPH_VERSION
    this.authBase = options.authBase || 'https://www.facebook.com'
    this.graphBase = options.graphBase || 'https://graph.facebook.com'
  }

  /** Build the Facebook Login consent URL. */
  getAuthUrl(input: InstagramAuthUrlInput): string {
    const query = new URLSearchParams({
      client_id: input.clientId,
      redirect_uri: input.redirectUrl,
      scope: input.scopes.join(','),
      state: input.state,
      response_type: 'code',
    })

    return `${this.authBase}/${this.graphVersion}/dialog/oauth?${query.toString()}`
  }

  /** Exchange an authorization code for a user access token. */
  async exchangeCode(input: InstagramTokenExchangeInput): Promise<{ accessToken: string, expiresIn?: number }> {
    // POST, so the CLIENT SECRET is not in a URL either. It is a long-lived
    // app credential and the same logging argument applies to it even more
    // than to a user token. Meta's token endpoint accepts both forms: probed
    // live, a bad client id answers `code 101 Missing or invalid client id`
    // identically whether the parameters arrive as a query or as a body.
    const payload = await this.graph<{ access_token: string, expires_in?: number }>(
      '/oauth/access_token',
      {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: input.clientId,
          client_secret: input.clientSecret,
          redirect_uri: input.redirectUrl,
          code: input.code,
        }).toString(),
      },
    )

    if (!payload.access_token) {
      throw new InstagramApiError('Facebook did not return an access token.', 400, JSON.stringify(payload))
    }

    return { accessToken: payload.access_token, expiresIn: payload.expires_in }
  }

  /**
   * Find the Instagram Business account linked to one of the user's Pages.
   * Returns the IG account id plus the Page access token used to publish.
   */
  async resolveAccount(accessToken: string): Promise<InstagramAccount> {
    const query = new URLSearchParams({
      fields: 'name,access_token,instagram_business_account{id,username}',
    })

    const payload = await this.graph<{
      data?: Array<{
        access_token?: string
        instagram_business_account?: { id: string, username?: string }
      }>
    }>(`/me/accounts?${query.toString()}`, { method: 'GET' }, accessToken)

    const page = (payload.data || []).find(entry => entry.instagram_business_account?.id)
    const account = page?.instagram_business_account
    if (!account?.id || !page?.access_token) {
      throw new InstagramApiError(
        'No Instagram Business account is linked to your Facebook Pages.',
        400,
        JSON.stringify(payload),
      )
    }

    return {
      igUserId: account.id,
      username: account.username,
      pageAccessToken: page.access_token,
    }
  }

  async publish(identity: SocialIdentityCredentials, post: PublishPostInput): Promise<PublishedPost> {
    if (!identity.accessToken) throw new Error('Instagram access token is missing for this identity.')

    // `did` carries the Instagram Business account id for Instagram identities.
    const igUserId = identity.did
    if (!igUserId) throw new Error('Instagram account id is required to publish.')

    const media = post.media?.[0]
    if (!media?.url) throw new Error('Instagram requires an image to post.')

    if (post.text.length > this.characterLimit) {
      throw new Error(`Instagram captions must be ${this.characterLimit} characters or fewer.`)
    }

    // 1) Create the media container.
    const container = await this.graph<{ id: string }>(
      `/${igUserId}/media`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          image_url: media.url,
          caption: post.text,
        }).toString(),
      },
      identity.accessToken,
    )

    if (!container.id) {
      throw new InstagramApiError('Instagram did not return a media container id.', 400, JSON.stringify(container))
    }

    // 2) Publish the container.
    const published = await this.graph<{ id: string }>(
      `/${igUserId}/media_publish`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          creation_id: container.id,
        }).toString(),
      },
      identity.accessToken,
    )

    const permalink = await this.graph<{ permalink?: string }>(
      `/${published.id}?fields=permalink`,
      { method: 'GET' },
      identity.accessToken,
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

  /**
   * One request to the Graph API, with the credential in a header.
   *
   * `token` is deliberately a parameter of this helper rather than something a
   * caller puts in the path or the body. A URL is the one part of a request
   * that is logged by default everywhere it passes - this process, any forward
   * proxy, Meta's own edge - so a long-lived publishing token in a query
   * string is a credential sitting in files nobody treats as secret
   * (stacksjs/stacks#2882). Verified against the live API: a bad token in this
   * header answers `code 190 Cannot parse access token`, byte for byte what
   * the query form answers, while sending none answers `code 2500`.
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
      throw new InstagramApiError(`Instagram API failed (${response.status}): ${message}`, response.status, text)
    }

    return json as T
  }
}
