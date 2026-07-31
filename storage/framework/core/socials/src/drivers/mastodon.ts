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

export class MastodonApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body: string,
  ) {
    super(message)
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
export class MastodonPublishingDriver implements SocialPublishingDriver, SocialDeletionDriver {
  readonly provider: 'mastodon' = 'mastodon'
  // Mastodon's default; instances can raise it, but 500 is the safe floor.
  characterLimit = 500

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

  /** Upload one image and return its media id for attachment. */
  async uploadMedia(
    identity: SocialIdentityCredentials,
    bytes: Uint8Array,
    mimeType: string,
    altText?: string,
  ): Promise<string> {
    const form = new FormData()
    form.set('file', new Blob([new Uint8Array(bytes)], { type: mimeType || 'image/jpeg' }), 'upload')
    if (altText) form.set('description', altText)

    const media = await this.request<{ id: string }>(
      `${this.instanceOf(identity)}/api/v2/media`,
      { method: 'POST', headers: { authorization: `Bearer ${this.tokenOf(identity)}` }, body: form },
    )
    return media.id
  }

  async publish(identity: SocialIdentityCredentials, post: PublishPostInput): Promise<PublishedPost> {
    const instance = this.instanceOf(identity)
    const accessToken = this.tokenOf(identity)
    if (post.text.length > this.characterLimit)
      throw new Error(`Mastodon posts must be ${this.characterLimit} characters or fewer.`)

    const mediaIds: string[] = []
    for (const item of (post.media || []).slice(0, 4)) {
      let bytes = item.bytes
      let mimeType = item.mimeType
      if (!bytes?.length && item.url) {
        const response = await fetch(item.url)
        if (!response.ok) continue
        bytes = new Uint8Array(await response.arrayBuffer())
        mimeType = mimeType || response.headers.get('content-type') || 'image/jpeg'
      }
      if (bytes?.length)
        mediaIds.push(await this.uploadMedia(identity, bytes, mimeType || 'image/jpeg', item.altText))
    }

    const body: Record<string, unknown> = { status: post.text, visibility: 'public' }
    if (mediaIds.length) body.media_ids = mediaIds
    // Mastodon threads via the parent status id, carried in reply.parent.uri.
    if (post.reply?.parent?.uri) body.in_reply_to_id = post.reply.parent.uri

    const status = await this.request<{ id: string, url?: string, uri?: string }>(
      `${instance}/api/v1/statuses`,
      {
        method: 'POST',
        headers: { 'authorization': `Bearer ${accessToken}`, 'content-type': 'application/json' },
        body: JSON.stringify(body),
      },
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

  protected async request<T>(url: string, init: RequestInit): Promise<T> {
    const response = await fetch(url, init)
    const text = await response.text()

    if (!response.ok) {
      throw new MastodonApiError(
        `Mastodon API failed (${response.status}): ${text || response.statusText}`,
        response.status,
        text,
      )
    }

    return text ? JSON.parse(text) as T : {} as T
  }
}

/** The status id at the end of a Mastodon status URL. */
function lastPathSegment(value: string): string {
  return String(value || '').replace(/\/+$/, '').split('/').pop() || ''
}
