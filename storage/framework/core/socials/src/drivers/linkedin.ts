import type {
  AuthoredPostPage,
  PublishedPost,
  PublishPostInput,
  RemotePostRef,
  SocialDeletionDriver,
  SocialIdentityCredentials,
  SocialPublishingDriver,
  TimelineQuery,
  TimelineResult,
} from '../types'

export class LinkedInApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body: string,
  ) {
    super(message)
    this.name = 'LinkedInApiError'
  }

  get isAuthError(): boolean {
    return this.status === 401 || this.status === 403
  }
}

export interface LinkedInDriverOptions {
  /** Monthly REST API version header, e.g. `202405`. */
  apiVersion?: string
  authBase?: string
  apiBase?: string
}

export interface LinkedInAuthUrlInput {
  clientId: string
  redirectUrl: string
  scopes: string[]
  state: string
}

export interface LinkedInTokenExchangeInput {
  clientId: string
  clientSecret: string
  redirectUrl: string
  code: string
}

export interface LinkedInTokenResponse {
  accessToken: string
  expiresIn?: number
  scope?: string
}

export interface LinkedInProfile {
  /** OpenID subject — the member id used to build `urn:li:person:{sub}`. */
  sub: string
  name?: string
  picture?: string
}

/**
 * Publishing driver for LinkedIn member shares.
 *
 * Auth is OAuth 2.0 (authorization code). Posting uses the versioned REST
 * `/rest/posts` endpoint with the `w_member_social` scope. Unlike Bluesky,
 * LinkedIn has no app-password, so a token is always obtained via OAuth (or
 * pasted in from a prior OAuth grant).
 */
export class LinkedInPublishingDriver implements SocialPublishingDriver, SocialDeletionDriver {
  readonly provider: 'linkedin' = 'linkedin'
  characterLimit = 3000

  protected apiVersion: string
  protected authBase: string
  protected apiBase: string

  constructor(options: LinkedInDriverOptions = {}) {
    this.apiVersion = options.apiVersion || '202405'
    this.authBase = options.authBase || 'https://www.linkedin.com'
    this.apiBase = options.apiBase || 'https://api.linkedin.com'
  }

  /** Build the consent URL the member is redirected to. */
  getAuthUrl(input: LinkedInAuthUrlInput): string {
    const query = new URLSearchParams({
      response_type: 'code',
      client_id: input.clientId,
      redirect_uri: input.redirectUrl,
      scope: input.scopes.join(' '),
      state: input.state,
    })

    return `${this.authBase}/oauth/v2/authorization?${query.toString()}`
  }

  /** Exchange an authorization code for a member access token. */
  async exchangeCode(input: LinkedInTokenExchangeInput): Promise<LinkedInTokenResponse> {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code: input.code,
      redirect_uri: input.redirectUrl,
      client_id: input.clientId,
      client_secret: input.clientSecret,
    })

    const payload = await this.request<{ access_token: string, expires_in?: number, scope?: string }>(
      `${this.authBase}/oauth/v2/accessToken`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      },
    )

    if (!payload.access_token) {
      throw new LinkedInApiError('LinkedIn did not return an access token.', 400, JSON.stringify(payload))
    }

    return {
      accessToken: payload.access_token,
      expiresIn: payload.expires_in,
      scope: payload.scope,
    }
  }

  /** Resolve the member profile (OpenID Connect `userinfo`). */
  async getProfile(accessToken: string): Promise<LinkedInProfile> {
    if (!accessToken) throw new Error('LinkedIn access token is required.')

    const payload = await this.request<{ sub: string, name?: string, picture?: string }>(
      `${this.apiBase}/v2/userinfo`,
      { headers: { authorization: `Bearer ${accessToken}` } },
    )

    if (!payload.sub) {
      throw new LinkedInApiError('LinkedIn profile is missing a subject id.', 400, JSON.stringify(payload))
    }

    return { sub: payload.sub, name: payload.name, picture: payload.picture }
  }

  async publish(identity: SocialIdentityCredentials, post: PublishPostInput): Promise<PublishedPost> {
    if (!identity.accessToken) throw new Error('LinkedIn access token is missing for this identity.')

    // `did` carries the member URN (urn:li:person:{sub}) for LinkedIn identities.
    const author = identity.did
    if (!author) throw new Error('LinkedIn member URN is required to publish.')

    if (post.text.length > this.characterLimit) {
      throw new Error(`LinkedIn posts must be ${this.characterLimit} characters or fewer.`)
    }

    const record: Record<string, unknown> = {
      author,
      commentary: escapeLinkedInText(post.text),
      visibility: 'PUBLIC',
      distribution: {
        feedDistribution: 'MAIN_FEED',
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      lifecycleState: 'PUBLISHED',
      isReshareDisabledByAuthor: false,
    }

    if (post.external) {
      record.content = {
        article: {
          source: post.external.uri,
          title: post.external.title,
          description: post.external.description || '',
        },
      }
    }

    const response = await fetch(`${this.apiBase}/rest/posts`, {
      method: 'POST',
      headers: {
        'authorization': `Bearer ${identity.accessToken}`,
        'content-type': 'application/json',
        'linkedin-version': this.apiVersion,
        'x-restli-protocol-version': '2.0.0',
      },
      body: JSON.stringify(record),
    })

    const text = await response.text()
    if (!response.ok) {
      throw new LinkedInApiError(
        `LinkedIn API failed (${response.status}): ${text || response.statusText}`,
        response.status,
        text,
      )
    }

    // The created post URN comes back in a response header, not the body.
    const uri = response.headers.get('x-restli-id')
      || response.headers.get('x-linkedin-id')
      || ''

    return {
      provider: this.provider,
      uri,
      url: uri ? `https://www.linkedin.com/feed/update/${uri}` : undefined,
    }
  }

  // LinkedIn does not expose a personal home timeline under `w_member_social`.
  async timeline(_identity: SocialIdentityCredentials, _query: TimelineQuery = {}): Promise<TimelineResult> {
    return { items: [] }
  }

  /**
   * One page of the member's own posts via the Posts API author finder.
   *
   * LinkedIn gates this finder behind `r_member_social`, which is granted only
   * to approved partners — publishing needs just `w_member_social`. A rejection
   * is therefore the norm rather than a bug, so it is translated into a message
   * that names the missing permission instead of surfacing a bare 403.
   */
  async listAuthoredPosts(
    identity: SocialIdentityCredentials,
    query: TimelineQuery = {},
  ): Promise<AuthoredPostPage> {
    if (!identity.accessToken) throw new Error('LinkedIn access token is missing for this identity.')
    // `did` carries the member URN (urn:li:person:{sub}) for LinkedIn.
    const author = identity.did
    if (!author) throw new Error('LinkedIn member URN is required to list posts.')

    const count = Math.min(Math.max(query.limit || 50, 1), 100)
    const start = Number(query.cursor || 0) || 0
    const url = new URL(`${this.apiBase}/rest/posts`)
    url.searchParams.set('q', 'author')
    url.searchParams.set('author', author)
    url.searchParams.set('count', String(count))
    url.searchParams.set('start', String(start))

    let payload: { elements?: Array<{ id?: string, commentary?: string, createdAt?: number }> }
    try {
      payload = await this.request(url.toString(), {
        headers: {
          'authorization': `Bearer ${identity.accessToken}`,
          'linkedin-version': this.apiVersion,
          'x-restli-protocol-version': '2.0.0',
        },
      })
    }
    catch (error) {
      if (error instanceof LinkedInApiError && (error.status === 401 || error.status === 403)) {
        throw new LinkedInApiError(
          'LinkedIn will not list this account\'s posts - the Posts author finder needs the r_member_social permission, which this app does not hold.',
          error.status,
          error.body,
        )
      }
      throw error
    }

    const posts = (payload.elements || []).filter(element => element?.id).map(element => ({
      uri: String(element.id),
      text: element.commentary,
      postedAt: element.createdAt ? new Date(element.createdAt).toISOString() : undefined,
      url: `https://www.linkedin.com/feed/update/${element.id}`,
    }))

    return {
      // Offset paging: a short page means the history ended.
      cursor: posts.length === count ? String(start + count) : undefined,
      posts,
    }
  }

  /**
   * Permanently delete one member share by its post URN. Deleting needs only
   * `w_member_social`, the same scope publishing uses.
   */
  async deletePost(identity: SocialIdentityCredentials, ref: RemotePostRef): Promise<void> {
    if (!identity.accessToken) throw new Error('LinkedIn access token is missing for this identity.')
    const urn = String(ref.uri || '').trim()
    if (!urn) throw new Error('A LinkedIn post URN is required to delete a post.')

    const response = await fetch(`${this.apiBase}/rest/posts/${encodeURIComponent(urn)}`, {
      method: 'DELETE',
      headers: {
        'authorization': `Bearer ${identity.accessToken}`,
        'linkedin-version': this.apiVersion,
        'x-restli-protocol-version': '2.0.0',
      },
    })

    // 404 means it is already gone — the desired end state either way.
    if (!response.ok && response.status !== 404) {
      const text = await response.text().catch(() => '')
      throw new LinkedInApiError(
        `LinkedIn API failed (${response.status}): ${text || response.statusText}`,
        response.status,
        text,
      )
    }
  }

  protected async request<T>(url: string, init: RequestInit): Promise<T> {
    const response = await fetch(url, init)
    const text = await response.text()

    if (!response.ok) {
      throw new LinkedInApiError(
        `LinkedIn API failed (${response.status}): ${text || response.statusText}`,
        response.status,
        text,
      )
    }

    return text ? JSON.parse(text) as T : {} as T
  }
}

/**
 * Escape the reserved characters of LinkedIn's "little text" commentary format
 * so the literal text renders as typed. Without this, characters like `(` `)`
 * `@` `#` cause the share to be rejected with a 400.
 */
export function escapeLinkedInText(text: string): string {
  return text.replace(/[\\|{}@[\]()<>#*_~]/g, '\\$&')
}
