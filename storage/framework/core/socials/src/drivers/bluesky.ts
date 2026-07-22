import type {
  BlueskySession,
  BlueskySessionCredentials,
  PublishedPost,
  PublishPostInput,
  SocialIdentityCredentials,
  SocialPublishingDriver,
  TimelineQuery,
  TimelineResult,
} from '../types'

export class BlueskyApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body: string,
  ) {
    super(message)
    this.name = 'BlueskyApiError'
  }

  get isAuthError(): boolean {
    return this.status === 400 || this.status === 401 || this.status === 403
  }
}

export interface BlueskyDriverOptions {
  service?: string
}

interface CreateSessionResponse {
  did: string
  handle: string
  accessJwt: string
  refreshJwt: string
}

interface CreateRecordResponse {
  uri: string
  cid?: string
}

interface FacetCandidate {
  byteStart: number
  byteEnd: number
  type: 'link' | 'tag' | 'mention'
  value: string
}

const utf8 = new TextEncoder()

function byteLength(value: string): number {
  return utf8.encode(value).length
}

/**
 * Find link/hashtag/mention spans in post text with UTF-8 byte offsets
 * (ATProto facet ranges are byte-indexed, not character-indexed).
 * Mentions still need their DID resolved before they become facets.
 */
export function detectFacetCandidates(text: string): FacetCandidate[] {
  const candidates: FacetCandidate[] = []

  const linkPattern = /https?:\/\/[^\s<>"']+/g
  for (const match of text.matchAll(linkPattern)) {
    const value = match[0].replace(/[),.;!?]+$/, '')
    candidates.push({
      byteStart: byteLength(text.slice(0, match.index)),
      byteEnd: byteLength(text.slice(0, match.index)) + byteLength(value),
      type: 'link',
      value,
    })
  }

  const insideLink = (start: number, end: number): boolean =>
    candidates.some(candidate => candidate.type === 'link' && start < candidate.byteEnd && end > candidate.byteStart)

  const tagPattern = /(^|\s)(#[A-Za-z0-9_]+)/g
  for (const match of text.matchAll(tagPattern)) {
    const tag = match[2]
    if (/^#\d+$/.test(tag)) continue
    const charStart = (match.index ?? 0) + match[1].length
    const byteStart = byteLength(text.slice(0, charStart))
    const byteEnd = byteStart + byteLength(tag)
    if (insideLink(byteStart, byteEnd)) continue
    candidates.push({ byteStart, byteEnd, type: 'tag', value: tag.slice(1) })
  }

  // Handles are domain-shaped (user.bsky.social), so require a dot.
  const mentionPattern = /(^|\s)(@[a-z0-9][a-z0-9.-]*\.[a-z]{2,})/gi
  for (const match of text.matchAll(mentionPattern)) {
    const handle = match[2]
    const charStart = (match.index ?? 0) + match[1].length
    const byteStart = byteLength(text.slice(0, charStart))
    const byteEnd = byteStart + byteLength(handle)
    if (insideLink(byteStart, byteEnd)) continue
    candidates.push({ byteStart, byteEnd, type: 'mention', value: handle.slice(1).replace(/\.+$/, '') })
  }

  return candidates.sort((a, b) => a.byteStart - b.byteStart)
}

export class BlueskyPublishingDriver implements SocialPublishingDriver {
  readonly provider: 'bluesky' = 'bluesky'
  characterLimit = 300

  protected service: string

  constructor(options: BlueskyDriverOptions = {}) {
    this.service = options.service || 'https://bsky.social'
  }

  async createSession(credentials: BlueskySessionCredentials): Promise<BlueskySession> {
    const identifier = credentials.identifier.trim()
    const password = credentials.password.trim()

    if (!identifier) throw new Error('Bluesky identifier is required.')
    if (!password) throw new Error('Bluesky app password is required.')

    const session = await this.post<CreateSessionResponse>('/xrpc/com.atproto.server.createSession', {
      identifier,
      password,
    })

    const profile = await this.getProfile({
      did: session.did,
      handle: session.handle,
      accessToken: session.accessJwt,
      refreshToken: session.refreshJwt,
    }).catch(() => undefined)

    return {
      did: session.did,
      handle: session.handle,
      displayName: profile?.displayName,
      accessJwt: session.accessJwt,
      refreshJwt: session.refreshJwt,
    }
  }

  async refreshSession(refreshToken: string): Promise<BlueskySession> {
    if (!refreshToken) throw new Error('Bluesky refresh token is required.')

    const session = await this.post<CreateSessionResponse>(
      '/xrpc/com.atproto.server.refreshSession',
      undefined,
      { authorization: `Bearer ${refreshToken}` },
    )

    return {
      did: session.did,
      handle: session.handle,
      accessJwt: session.accessJwt,
      refreshJwt: session.refreshJwt,
    }
  }

  async publish(identity: SocialIdentityCredentials, post: PublishPostInput): Promise<PublishedPost> {
    const repo = identity.did || identity.handle
    if (!identity.accessToken) throw new Error('Bluesky access token is missing for this identity.')
    if (!repo) throw new Error('Bluesky identity DID or handle is required.')
    if (post.text.length > this.characterLimit) {
      throw new Error(`Bluesky posts must be ${this.characterLimit} characters or fewer.`)
    }

    const record: Record<string, unknown> = {
      $type: 'app.bsky.feed.post',
      text: post.text,
      createdAt: post.scheduledAt || new Date().toISOString(),
    }

    if (post.langs?.length) record.langs = post.langs
    if (post.reply) record.reply = post.reply

    const facets = post.facets ?? await this.buildFacets(post.text)
    if (facets.length) record.facets = facets

    if (post.external) {
      record.embed = {
        $type: 'app.bsky.embed.external',
        external: {
          uri: post.external.uri,
          title: post.external.title,
          description: post.external.description || '',
        },
      }
    }

    // Bluesky records hold a single embed; attached images win over a link
    // card (the link is still clickable via its facet).
    const imageMedia = (post.media || []).filter(item => item.bytes?.length).slice(0, 4)
    if (imageMedia.length) {
      const images = []
      for (const item of imageMedia) {
        const blob = await this.uploadBlob(identity, item.bytes!, item.mimeType || 'image/jpeg')
        images.push({ image: blob, alt: item.altText || '' })
      }
      record.embed = { $type: 'app.bsky.embed.images', images }
    }

    const payload = await this.post<CreateRecordResponse>(
      '/xrpc/com.atproto.repo.createRecord',
      {
        repo,
        collection: 'app.bsky.feed.post',
        record,
      },
      {
        authorization: `Bearer ${identity.accessToken}`,
      },
    )

    return {
      provider: this.provider,
      uri: payload.uri,
      cid: payload.cid,
      url: this.toPostUrl(identity.handle, payload.uri),
    }
  }

  /**
   * Engagement counts for up to 25 of the account's posts per call
   * (app.bsky.feed.getPosts). Deleted posts are simply absent from the
   * response.
   */
  async postMetrics(
    identity: SocialIdentityCredentials,
    uris: string[],
  ): Promise<Array<{ uri: string, likeCount: number, repostCount: number, replyCount: number }>> {
    if (!identity.accessToken) throw new Error('Bluesky access token is missing for this identity.')
    if (uris.length === 0) return []

    const url = new URL(`${this.service}/xrpc/app.bsky.feed.getPosts`)
    for (const uri of uris.slice(0, 25)) url.searchParams.append('uris', uri)

    const payload = await this.request<{ posts?: Array<{ uri: string, likeCount?: number, repostCount?: number, replyCount?: number }> }>(url, {
      headers: { authorization: `Bearer ${identity.accessToken}` },
    })

    return (payload.posts || []).map(post => ({
      uri: post.uri,
      likeCount: post.likeCount || 0,
      repostCount: post.repostCount || 0,
      replyCount: post.replyCount || 0,
    }))
  }

  async timeline(identity: SocialIdentityCredentials, query: TimelineQuery = {}): Promise<TimelineResult> {
    if (!identity.accessToken) throw new Error('Bluesky access token is missing for this identity.')

    const url = new URL(`${this.service}/xrpc/app.bsky.feed.getTimeline`)
    url.searchParams.set('limit', String(Math.min(Math.max(query.limit || 30, 1), 100)))
    if (query.cursor) url.searchParams.set('cursor', query.cursor)

    const payload = await this.request<{
      cursor?: string
      feed?: Array<{
        post?: {
          uri: string
          author?: { handle: string, displayName?: string, avatar?: string }
          record?: { text?: string, createdAt?: string }
          likeCount?: number
          repostCount?: number
          replyCount?: number
        }
      }>
    }>(url, {
      headers: {
        authorization: `Bearer ${identity.accessToken}`,
      },
    })

    return {
      cursor: payload.cursor,
      items: (payload.feed || []).flatMap((entry) => {
        const item = entry.post
        if (!item?.uri || !item.author?.handle) return []

        return [{
          uri: item.uri,
          authorHandle: item.author.handle,
          authorName: item.author.displayName,
          authorAvatar: item.author.avatar,
          postUrl: this.toPostUrl(item.author.handle, item.uri),
          body: item.record?.text || '',
          postedAt: item.record?.createdAt || new Date().toISOString(),
          likeCount: item.likeCount || 0,
          repostCount: item.repostCount || 0,
          replyCount: item.replyCount || 0,
        }]
      }),
    }
  }

  async getProfile(identity: SocialIdentityCredentials): Promise<{ did: string, handle: string, displayName?: string }> {
    if (!identity.accessToken) throw new Error('Bluesky access token is missing for this identity.')

    const actor = identity.did || identity.handle
    if (!actor) throw new Error('Bluesky identity DID or handle is required.')

    const url = new URL(`${this.service}/xrpc/app.bsky.actor.getProfile`)
    url.searchParams.set('actor', actor)

    return await this.request<{ did: string, handle: string, displayName?: string }>(url, {
      headers: {
        authorization: `Bearer ${identity.accessToken}`,
      },
    })
  }

  /**
   * Resolve link/tag/mention candidates into ATProto facets. Mentions that
   * fail handle→DID resolution are dropped rather than failing the post.
   */
  protected async buildFacets(text: string): Promise<Array<Record<string, unknown>>> {
    const facets: Array<Record<string, unknown>> = []
    for (const candidate of detectFacetCandidates(text)) {
      let feature: Record<string, unknown> | null = null
      if (candidate.type === 'link')
        feature = { $type: 'app.bsky.richtext.facet#link', uri: candidate.value }
      else if (candidate.type === 'tag')
        feature = { $type: 'app.bsky.richtext.facet#tag', tag: candidate.value }
      else if (candidate.type === 'mention') {
        const did = await this.resolveHandle(candidate.value)
        if (did) feature = { $type: 'app.bsky.richtext.facet#mention', did }
      }
      if (feature) {
        facets.push({
          index: { byteStart: candidate.byteStart, byteEnd: candidate.byteEnd },
          features: [feature],
        })
      }
    }
    return facets
  }

  /** Handle → DID, or null when the handle doesn't resolve. */
  protected async resolveHandle(handle: string): Promise<string | null> {
    try {
      const url = new URL(`${this.service}/xrpc/com.atproto.identity.resolveHandle`)
      url.searchParams.set('handle', handle)
      const payload = await this.request<{ did?: string }>(url, {})
      return payload.did || null
    }
    catch {
      return null
    }
  }

  /** Upload raw image bytes and return the blob ref for embeds. */
  async uploadBlob(identity: SocialIdentityCredentials, bytes: Uint8Array, mimeType: string): Promise<unknown> {
    if (!identity.accessToken) throw new Error('Bluesky access token is missing for this identity.')
    if (bytes.length > 1_000_000)
      throw new Error('Bluesky images must be 1MB or smaller.')

    const payload = await this.request<{ blob: unknown }>(
      new URL(`${this.service}/xrpc/com.atproto.repo.uploadBlob`),
      {
        method: 'POST',
        headers: {
          'content-type': mimeType,
          'authorization': `Bearer ${identity.accessToken}`,
        },
        body: bytes,
      },
    )

    return payload.blob
  }

  protected async post<T>(path: string, body?: unknown, headers: Record<string, string> = {}): Promise<T> {
    return await this.request<T>(new URL(`${this.service}${path}`), {
      method: 'POST',
      headers: {
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        ...headers,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
  }

  protected async request<T>(url: URL, init: RequestInit): Promise<T> {
    const response = await fetch(url, init)
    const text = await response.text()

    if (!response.ok) {
      throw new BlueskyApiError(
        `Bluesky API failed (${response.status}): ${text || response.statusText}`,
        response.status,
        text,
      )
    }

    return text ? JSON.parse(text) as T : {} as T
  }

  protected toPostUrl(handle: string, uri: string): string {
    const postId = uri.split('/').pop()
    return `https://bsky.app/profile/${handle}/post/${postId}`
  }
}
