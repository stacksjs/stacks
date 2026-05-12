/**
 * Normalized user type that all providers will map their responses to.
 * This ensures a consistent user structure regardless of the provider used.
 */
export interface SocialUser {
  id: string
  nickname: string | null
  name: string
  email: string | null
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

export type SocialPublishingProvider =
  | 'bluesky'
  | 'twitter'
  | 'mastodon'
  | 'facebook'
  | 'instagram'
  | 'tiktok'
  | 'linkedin'

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
