import type { SocialApiErrorOptions } from '../errors'
import type {
  PostMetrics,
  PublishedPost,
  PublishPostInput,
  SocialIdentityCredentials,
  SocialMetricsDriver,
  SocialPublishingDriver,
  TimelineQuery,
  TimelineResult,
} from '../types'
import { isMissingGraphObject, META_GRAPH_VERSION } from '../meta-graph'
import { exceedsLimit } from '../text'
import { apiFailure, SocialApiError } from '../errors'

/** Items Instagram takes in one carousel. */
export const INSTAGRAM_MAX_IMAGES = 10

/** Instagram's limit on an image's alt text. */
export const INSTAGRAM_MAX_ALT_TEXT = 1000

/** Pages of the user's Facebook Pages read when looking for the Instagram account. */
const MAX_ACCOUNT_PAGES = 20

export interface InstagramLongLivedToken {
  accessToken: string
  expiresIn?: number
}

/** The feed-post insights Instagram reports, by the name it gives each, and the field each fills. */
const INSTAGRAM_METRIC_FIELDS: Record<string, 'likes' | 'replies' | 'shares' | 'saves' | 'reach' | 'views'> = {
  likes: 'likes',
  comments: 'replies',
  shares: 'shares',
  saved: 'saves',
  reach: 'reach',
  views: 'views',
}

export class InstagramApiError extends SocialApiError {
  constructor(message: string, status: number, body: string, options: SocialApiErrorOptions = {}) {
    super('instagram', message, status, body, options)
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

export interface InstagramPageAccount extends InstagramAccount {
  pageId: string
  pageName?: string
}

/**
 * Publishing driver for Instagram Business/Creator accounts via the Facebook
 * Graph API. Auth is Facebook Login (OAuth 2.0). Publishing is the documented
 * two-step flow: create a media container, then publish it.
 *
 * Instagram does not allow text-only posts — every post requires an image (or
 * video) reachable at a public URL, supplied via `post.media`.
 */
export class InstagramPublishingDriver implements SocialPublishingDriver, SocialMetricsDriver {
  readonly provider: 'instagram' = 'instagram'
  characterLimit = 2200
  /** Images attached per post. Instagram's own ceiling; an app may lower it. */
  maxImages = INSTAGRAM_MAX_IMAGES
  /**
   * How long to wait for Instagram to finish a media container before giving
   * up on the post. Meta suggests checking for up to five minutes.
   */
  containerTimeoutMs = 300_000

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
    for await (const page of this.pageAccounts(accessToken)) {
      return { igUserId: page.igUserId, username: page.username, pageAccessToken: page.pageAccessToken }
    }
    throw new InstagramApiError('No Instagram Business account is linked to your Facebook Pages.', 400, '')
  }

  /** List the linked professional accounts together with their Facebook Pages. */
  async listAccounts(accessToken: string): Promise<InstagramPageAccount[]> {
    const accounts = new Map<string, InstagramPageAccount>()
    for await (const account of this.pageAccounts(accessToken)) {
      if (account.pageId && !accounts.has(account.pageId))
        accounts.set(account.pageId, { ...account, pageId: account.pageId })
    }
    return [...accounts.values()]
  }

  private async *pageAccounts(accessToken: string): AsyncGenerator<InstagramAccount & { pageId?: string, pageName?: string }> {
    const query = new URLSearchParams({
      fields: 'id,name,access_token,instagram_business_account{id,username}',
    })

    type AccountsPage = {
      data?: Array<{
        id?: string
        name?: string
        access_token?: string
        instagram_business_account?: { id: string, username?: string }
      }>
      paging?: { next?: string }
    }

    let next: string | undefined = `/me/accounts?${query.toString()}`
    for (let index = 0; next && index < MAX_ACCOUNT_PAGES; index++) {
      const payload: AccountsPage = await this.graph<AccountsPage>(next, { method: 'GET' }, accessToken)
      for (const page of payload.data ?? []) {
        const instagram = page.instagram_business_account
        if (instagram?.id && page.access_token) {
          yield {
            pageId: page.id,
            pageName: page.name,
            igUserId: instagram.id,
            username: instagram.username,
            pageAccessToken: page.access_token,
          }
        }
      }
      next = payload.paging?.next
    }
  }

  /**
   * Exchange a short-lived user token for a long-lived one of about sixty
   * days. A Page token minted from a long-lived user token does not expire on
   * its own, so this, before {@link resolveAccount}, is what keeps an
   * Instagram connection alive: there is no refresh grant.
   *
   * POST, so neither the client secret nor the token is in a URL.
   */
  async exchangeLongLivedUserToken(clientId: string, clientSecret: string, shortLivedToken: string): Promise<InstagramLongLivedToken> {
    const payload = await this.graph<{ access_token?: string, expires_in?: number }>(
      '/oauth/access_token',
      {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'fb_exchange_token',
          client_id: clientId,
          client_secret: clientSecret,
          fb_exchange_token: shortLivedToken,
        }).toString(),
      },
    )

    if (!payload.access_token) {
      throw new InstagramApiError('Facebook did not return a long-lived token.', 400, JSON.stringify(payload))
    }

    return { accessToken: payload.access_token, expiresIn: payload.expires_in }
  }

  /**
   * Publish a post: one image, or a carousel of two or more. Instagram has no
   * text-only posts, and fetches each image from its address, so an image
   * with only bytes is refused rather than left out.
   */
  async publish(identity: SocialIdentityCredentials, post: PublishPostInput): Promise<PublishedPost> {
    if (!identity.accessToken) throw new Error('Instagram access token is missing for this identity.')

    // `did` carries the Instagram Business account id for Instagram identities.
    const igUserId = identity.did
    if (!igUserId) throw new Error('Instagram account id is required to publish.')

    const images = (post.media ?? []).slice(0, this.maxImages)
    if (!images.length) throw new Error('Instagram requires an image to post.')
    if (images.some(image => !image.url))
      throw new InstagramApiError('Instagram fetches images from a public address, and this image has none.', 422, '')
    // JPEG is the only image format Instagram publishes. An image we know is
    // something else is refused here; one whose type we do not know is
    // checked by Instagram, and its error arrives through the container.
    if (images.some(image => image.mimeType && !/^image\/jpe?g$/i.test(image.mimeType)))
      throw new InstagramApiError('Instagram only publishes JPEG images, and this image is not one.', 422, '')

    if (exceedsLimit('instagram', post.text, this.characterLimit)) {
      throw new Error(`Instagram captions must be ${this.characterLimit} characters or fewer.`)
    }

    const accessToken = identity.accessToken
    const create = async (fields: Record<string, string>): Promise<string> => {
      const container = await this.graph<{ id?: string }>(
        `/${igUserId}/media`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams(fields).toString(),
        },
        accessToken,
      )
      if (!container.id)
        throw new InstagramApiError('Instagram did not return a media container id.', 400, JSON.stringify(container))
      return container.id
    }

    // Alt text goes on each image, single or carousel item; the carousel
    // container itself takes none.
    const imageFields = (image: { url?: string, altText?: string }): Record<string, string> => ({
      image_url: image.url!,
      ...(image.altText?.trim() ? { alt_text: image.altText.trim().slice(0, INSTAGRAM_MAX_ALT_TEXT) } : {}),
    })

    // 1) Create the container: one per carousel item, then one that holds them.
    let creationId: string
    if (images.length > 1) {
      const children: string[] = []
      for (const image of images) children.push(await create({ ...imageFields(image), is_carousel_item: 'true' }))
      creationId = await create({ media_type: 'CAROUSEL', children: children.join(','), caption: post.text })
    }
    else {
      creationId = await create({ ...imageFields(images[0]!), caption: post.text })
    }

    // 2) Wait until Instagram has fetched and processed it. Publishing a
    // container that is still in progress fails the post (stacksjs/stacks#3377).
    await this.waitForContainer(creationId, accessToken)

    // 3) Publish the container.
    const published = await this.graph<{ id?: string }>(
      `/${igUserId}/media_publish`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ creation_id: creationId }).toString(),
      },
      accessToken,
    )

    if (!published.id) {
      throw new InstagramApiError('Instagram did not return a published post id.', 400, JSON.stringify(published))
    }

    const permalink = await this.graph<{ permalink?: string }>(
      `/${published.id}?fields=permalink`,
      { method: 'GET' },
      accessToken,
    ).catch(() => undefined)

    return {
      provider: this.provider,
      uri: published.id,
      url: permalink?.permalink,
    }
  }

  /**
   * Wait for a media container to be `FINISHED`. Checked at once, then after
   * a growing pause (1, 2, 4 ... seconds, at most a minute apart) until
   * {@link containerTimeoutMs}. `ERROR` and `EXPIRED` fail at once, with
   * Instagram's own reason.
   */
  protected async waitForContainer(containerId: string, accessToken: string): Promise<void> {
    let waited = 0
    let pause = 1000
    for (;;) {
      const container = await this.graph<{ status_code?: string, status?: string }>(
        `/${containerId}?fields=status_code,status`,
        { method: 'GET' },
        accessToken,
      )
      const code = container.status_code
      // FINISHED is the one to publish; PUBLISHED means it already went out.
      if (code === 'FINISHED' || code === 'PUBLISHED' || code === undefined)
        return
      if (code === 'ERROR' || code === 'EXPIRED') {
        throw new InstagramApiError(
          `Instagram could not prepare this post (${code}${container.status ? `: ${container.status}` : ''}).`,
          422,
          JSON.stringify(container),
        )
      }
      if (waited >= this.containerTimeoutMs) {
        throw new InstagramApiError(
          `Instagram was still processing this post after ${Math.round(waited / 1000)} seconds, so it was not published.`,
          504,
          JSON.stringify(container),
        )
      }
      const next = Math.min(pause, 60_000, Math.max(this.containerTimeoutMs - waited, 0))
      await this.sleep(next)
      waited += next
      pause *= 2
    }
  }

  /** The pause between container checks; tests replace it. */
  protected sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  // The Content Publishing scope does not grant a readable home timeline.
  async timeline(_identity: SocialIdentityCredentials, _query: TimelineQuery = {}): Promise<TimelineResult> {
    return { items: [] }
  }

  /**
   * Likes, comments, shares, saves, reach and views for each post, one
   * insights request apiece: Instagram has no batch form
   * (`GET /{media-id}/insights`, the instagram_manage_insights permission).
   * `impressions` is gone for posts made since July 2024, and Meta marks
   * views as still in development. A metric with no data yet comes back as
   * nothing rather than zero, and is left absent. A post that is gone is
   * left out; a missing permission is an error (stacksjs/stacks#3379).
   */
  async metrics(identity: SocialIdentityCredentials, uris: string[]): Promise<PostMetrics[]> {
    const token = identity.accessToken
    if (!token) throw new Error('Instagram access token is missing for this identity.')

    const metrics: PostMetrics[] = []
    for (const uri of uris) {
      const id = String(uri || '').trim()
      if (!id) continue
      let payload: { data?: Array<{ name?: string, values?: Array<{ value?: unknown }> }> }
      try {
        payload = await this.graph(`/${encodeURIComponent(id)}/insights?metric=${Object.keys(INSTAGRAM_METRIC_FIELDS).join(',')}`, { method: 'GET' }, token)
      }
      catch (error) {
        if (error instanceof InstagramApiError && isMissingGraphObject(error)) continue
        throw error
      }

      const counts: PostMetrics = { uri }
      for (const entry of payload.data || []) {
        const field = INSTAGRAM_METRIC_FIELDS[String(entry.name)]
        const value = Number(entry.values?.[0]?.value)
        if (field && Number.isFinite(value)) counts[field] = value
      }
      metrics.push(counts)
    }
    return metrics
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
  /**
   * A Graph API path, or a `paging.next` address Meta handed back. An
   * absolute address is only followed on the Graph host itself: the token
   * goes with the request, and it must not go anywhere else.
   */
  protected graphUrl(path: string): string {
    if (!/^https?:\/\//i.test(path))
      return `${this.graphBase}/${this.graphVersion}${path}`
    const url = new URL(path)
    if (url.origin !== new URL(this.graphBase).origin || url.username || url.password)
      throw new InstagramApiError('Instagram returned a paging address on another host, so it was not followed.', 502, '')
    url.searchParams.delete('access_token')
    return url.href
  }

  protected async graph<T>(path: string, init: RequestInit, token?: string): Promise<T> {
    const headers = new Headers(init.headers)
    if (token) headers.set('authorization', `Bearer ${token}`)

    const response = await fetch(this.graphUrl(path), { ...init, headers })
    const text = await response.text()
    let json: any = {}
    try {
      json = text ? JSON.parse(text) : {}
    }
    catch {
      json = {}
    }

    if (!response.ok || json?.error) {
      throw new InstagramApiError(...apiFailure('Instagram API', response, text))
    }

    return json as T
  }
}
