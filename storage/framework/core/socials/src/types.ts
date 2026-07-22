/**
 * Normalized user type that all providers will map their responses to.
 * This ensures a consistent user structure regardless of the provider used.
 */
export interface SocialUser {
  id: string
  nickname: string | null
  name: string
  email: string | null
  /**
   * Whether the provider vouches for `email`. `false` means the provider
   * explicitly reports it unverified — applications must not link such an
   * identity to an existing local account by email (account-takeover
   * vector). `null`/undefined means the provider didn't say.
   */
  emailVerified?: boolean | null
  avatar: string | null
  token: string
  raw?: any
}

/**
 * GitHub-specific user type from their API response
 */
export interface GitHubUser {
  id: number
  login: string
  name: string | null
  avatar_url: string | null
  [key: string]: any
}

/**
 * GitHub-specific email type from their API response
 */
export interface GitHubEmail {
  email: string
  primary: boolean
  verified: boolean
}

/**
 * GitHub-specific OAuth token response
 */
export interface GitHubTokenResponse {
  access_token: string
  error?: string
  error_description?: string
}

export interface ProviderInterface {
  getAuthUrl: () => Promise<string>
  getAccessToken: (code: string) => Promise<string>
  getUserByToken: (token: string) => Promise<SocialUser>
}

export interface TwitterTokenResponse {
  access_token: string
  token_type: string
  expires_in: number
  scope: string
  error?: string
  error_description?: string
}

export interface TwitterUser {
  id: string
  username: string
  name: string
  email?: string
  profile_image_url?: string
}

/**
 * Apple-specific token response from https://appleid.apple.com/auth/token
 */
export interface AppleTokenResponse {
  access_token: string
  token_type: string
  expires_in: number
  refresh_token?: string
  id_token: string
  error?: string
  error_description?: string
}

/**
 * Claims Apple places in the id_token. `email_verified` and
 * `is_private_email` arrive as booleans or the strings 'true'/'false'
 * depending on the API era.
 */
export interface AppleIdTokenClaims {
  iss: string
  aud: string | string[]
  exp: number
  iat: number
  sub: string
  nonce?: string
  email?: string
  email_verified?: boolean | 'true' | 'false'
  is_private_email?: boolean | 'true' | 'false'
  [key: string]: any
}

export type SocialPublishingProvider =
  | 'bluesky'
  | 'twitter'
  | 'mastodon'
  | 'facebook'
  | 'instagram'
  | 'tiktok'
  | 'linkedin'
  | 'threads'

export interface BlueskySessionCredentials {
  identifier: string
  password: string
}

export interface BlueskySession {
  did: string
  handle: string
  displayName?: string
  accessJwt: string
  refreshJwt: string
}

export interface SocialIdentityCredentials {
  handle: string
  did?: string
  accessToken?: string
  refreshToken?: string
}

export interface PublishPostInput {
  text: string
  scheduledAt?: string
  langs?: string[]
  external?: {
    uri: string
    title: string
    description?: string
  }
  /**
   * Reply references for thread chaining (ATProto shape). `root` is the
   * first post of the thread, `parent` the one directly above.
   */
  reply?: {
    root: { uri: string, cid: string }
    parent: { uri: string, cid: string }
  }
  /**
   * Attached media. Instagram requires a public `url`; Bluesky uploads
   * `bytes` (or fetches `url`) as a blob and embeds the images.
   */
  media?: Array<{
    url?: string
    bytes?: Uint8Array
    mimeType?: string
    altText?: string
  }>
  /**
   * Precomputed rich-text facets (ATProto shape). When omitted, drivers
   * that support facets detect links/mentions/hashtags automatically.
   */
  facets?: unknown[]
}

export interface PublishedPost {
  provider: SocialPublishingProvider
  uri: string
  cid?: string
  url?: string
}

export interface TimelineQuery {
  cursor?: string
  limit?: number
}

export interface TimelineResult {
  cursor?: string
  items: Array<{
    uri: string
    authorHandle: string
    authorName?: string
    authorAvatar?: string
    postUrl?: string
    body: string
    postedAt: string
    likeCount: number
    repostCount: number
    replyCount: number
  }>
}

export interface SocialPublishingDriver {
  provider: SocialPublishingProvider
  characterLimit: number
  publish: (identity: SocialIdentityCredentials, post: PublishPostInput) => Promise<PublishedPost>
  timeline: (identity: SocialIdentityCredentials, query?: TimelineQuery) => Promise<TimelineResult>
}
