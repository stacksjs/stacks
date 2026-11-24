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
import { fetchPostImage, resolvePostImage } from '../media'
import { exceedsLimit } from '../text'

/**
 * The `LinkedIn-Version` sent unless a driver is given another.
 *
 * LinkedIn publishes a version every month and retires each one a year
 * later. A retired version is answered with an error, so every LinkedIn call
 * fails at once: the previous default, 202405, had been retired since May
 * 2025. A test fails two months before this one is retired, while there is
 * still time to move.
 */
export const LINKEDIN_API_VERSION = '202611'

/** When LinkedIn retires a `YYYYMM` version: a year on, mid-month. */
export function linkedInVersionSunset(version: string): Date {
  const year = Number(version.slice(0, 4))
  const month = Number(version.slice(4, 6))
  return new Date(Date.UTC(year + 1, month - 1, 15))
}

/**
 * The version to send. One that is configured is honoured unless LinkedIn
 * has already retired it: a stale line left in configuration would otherwise
 * break every LinkedIn call with no hint as to why.
 */
export function resolveLinkedInVersion(wanted: unknown, nowMs: number = Date.now()): string {
  const version = String(wanted ?? '').trim()
  if (!/^\d{6}$/.test(version)) return LINKEDIN_API_VERSION
  return linkedInVersionSunset(version).getTime() > nowMs ? version : LINKEDIN_API_VERSION
}

/** Images LinkedIn takes in one multi-image post. */
export const LINKEDIN_MAX_IMAGES = 20
/** LinkedIn's limit for an image's alt text. */
export const LINKEDIN_MAX_ALT_TEXT = 4086

/**
 * `x-restli-protocol-version`: the Rest.li wire protocol LinkedIn's API speaks.
 *
 * Not its API version. `linkedin-version` is the dated one, it is configurable
 * per driver, and it is the one in question in stacksjs/stacks#2859. This has
 * been 2.0.0 throughout and goes on every request, so it is defined once rather
 * than at each of the three call sites.
 */
const RESTLI_PROTOCOL_VERSION = '2.0.0'

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
  /**
   * Monthly REST API version header, e.g. `202611`. A retired one is
   * replaced by {@link LINKEDIN_API_VERSION}.
   */
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
  /** Present only when the app is enrolled in LinkedIn's refresh-token program. */
  refreshToken?: string
  refreshTokenExpiresIn?: number
}

export interface LinkedInRefreshInput {
  clientId: string
  clientSecret: string
  refreshToken: string
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
  /** Images attached per post. LinkedIn's own ceiling; an app may lower it. */
  maxImages = LINKEDIN_MAX_IMAGES
  /** Downloads an image given by address. Guarded against private addresses; replace it in a test. */
  fetchImage = fetchPostImage

  protected apiVersion: string
  protected authBase: string
  protected apiBase: string

  constructor(options: LinkedInDriverOptions = {}) {
    this.apiVersion = resolveLinkedInVersion(options.apiVersion)
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

    return this.tokenRequest(body, 'LinkedIn did not return an access token.')
  }

  /**
   * Mint a fresh access token from a stored refresh token. LinkedIn issues
   * refresh tokens only to apps in its refresh-token program; without one, an
   * expired connection has to be made again.
   */
  async refreshAccessToken(input: LinkedInRefreshInput): Promise<LinkedInTokenResponse> {
    return this.tokenRequest(new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: input.refreshToken,
      client_id: input.clientId,
      client_secret: input.clientSecret,
    }), 'LinkedIn did not return a refreshed access token.')
  }

  protected async tokenRequest(body: URLSearchParams, missing: string): Promise<LinkedInTokenResponse> {
    const payload = await this.request<{
      access_token?: string
      expires_in?: number
      scope?: string
      refresh_token?: string
      refresh_token_expires_in?: number
    }>(`${this.authBase}/oauth/v2/accessToken`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })

    if (!payload.access_token) {
      throw new LinkedInApiError(missing, 400, JSON.stringify(payload))
    }

    return {
      accessToken: payload.access_token,
      expiresIn: payload.expires_in,
      scope: payload.scope,
      refreshToken: payload.refresh_token,
      refreshTokenExpiresIn: payload.refresh_token_expires_in,
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

  /**
   * Upload one image through the versioned Images API and return its
   * `urn:li:image:...` id: `initializeUpload` for an upload URL, then a PUT
   * of the bytes. `owner` is the author URN (`urn:li:person:{sub}`).
   */
  async uploadImage(accessToken: string, owner: string, bytes: Uint8Array, mimeType?: string): Promise<string> {
    const initialized = await this.request<{ value?: { uploadUrl?: string, image?: string } }>(
      `${this.apiBase}/rest/images?action=initializeUpload`,
      {
        method: 'POST',
        headers: {
          'authorization': `Bearer ${accessToken}`,
          'content-type': 'application/json',
          'linkedin-version': this.apiVersion,
          'x-restli-protocol-version': RESTLI_PROTOCOL_VERSION,
        },
        body: JSON.stringify({ initializeUploadRequest: { owner } }),
      },
    )

    const uploadUrl = initialized.value?.uploadUrl
    const image = initialized.value?.image
    if (!uploadUrl || !image) {
      throw new LinkedInApiError('LinkedIn did not return an image upload URL.', 400, JSON.stringify(initialized))
    }

    const upload = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'authorization': `Bearer ${accessToken}`, 'content-type': mimeType || 'image/jpeg' },
      body: new Uint8Array(bytes),
    })

    if (!upload.ok) {
      const text = await upload.text().catch(() => '')
      throw new LinkedInApiError(`LinkedIn image upload failed (${upload.status}): ${text || upload.statusText}`, upload.status, text)
    }

    return image
  }

  /**
   * Publish a member share: text, with one image (`content.media`), two or
   * more (`content.multiImage`), or an article link card. `content` holds one
   * of these, so images win over a link card, as on Bluesky.
   */
  async publish(identity: SocialIdentityCredentials, post: PublishPostInput): Promise<PublishedPost> {
    if (!identity.accessToken) throw new Error('LinkedIn access token is missing for this identity.')

    // `did` carries the member URN (urn:li:person:{sub}) for LinkedIn identities.
    const author = identity.did
    if (!author) throw new Error('LinkedIn member URN is required to publish.')

    if (exceedsLimit('linkedin', post.text, this.characterLimit)) {
      throw new Error(`LinkedIn posts must be ${this.characterLimit} characters or fewer.`)
    }

    const images: Array<{ id: string, altText?: string }> = []
    for (const item of (post.media ?? []).slice(0, this.maxImages)) {
      const image = await resolvePostImage(item, url => this.fetchImage(url))
      if (!image) continue
      const id = await this.uploadImage(identity.accessToken, author, image.bytes, image.mimeType)
      const altText = item.altText?.trim()
      images.push({ id, ...(altText ? { altText: altText.slice(0, LINKEDIN_MAX_ALT_TEXT) } : {}) })
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

    if (images.length === 1) {
      record.content = { media: images[0] }
    }
    else if (images.length > 1) {
      record.content = { multiImage: { images } }
    }
    else if (post.external) {
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
        'x-restli-protocol-version': RESTLI_PROTOCOL_VERSION,
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
          'x-restli-protocol-version': RESTLI_PROTOCOL_VERSION,
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
        'x-restli-protocol-version': RESTLI_PROTOCOL_VERSION,
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
 * `@` cause the share to be rejected with a 400.
 *
 * A hashtag is the exception: `#word` is itself an element of the format, so
 * escaping its `#` turned every hashtag into plain text. A `#` that does not
 * start a word (as in "issue # 4", "#1" or "C#") is still escaped.
 */
export function escapeLinkedInText(text: string): string {
  return text.replace(/[\\|{}@[\]()<>#*_~]/g, (char, offset: number) => {
    if (char === '#' && startsHashtag(text, offset)) return char
    return `\\${char}`
  })
}

function startsHashtag(text: string, offset: number): boolean {
  const before = offset === 0 ? '' : text[offset - 1]!
  if (before && /[\p{L}\p{N}_#&/]/u.test(before)) return false
  const word = /^[\p{L}\p{N}_]+/u.exec(text.slice(offset + 1))?.[0]
  // A tag needs a letter: "#1" is a number, not a hashtag.
  return Boolean(word && /\p{L}/u.test(word))
}
