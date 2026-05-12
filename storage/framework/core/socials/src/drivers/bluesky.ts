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
          author?: { handle: string, displayName?: string }
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
