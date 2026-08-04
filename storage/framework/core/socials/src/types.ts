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

/**
 * One post in a timeline, normalized to the same shape by every driver.
 *
 * Named rather than left inline in {@link TimelineResult} so a consumer can
 * type a single item - a mapper, a row renderer, a test fixture - without
 * restating the ten fields or reaching for `TimelineResult['items'][number]`.
 * Apps were redeclaring this verbatim because there was nothing to import.
 */
export interface TimelineItem {
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
}

export interface TimelineResult {
  cursor?: string
  items: TimelineItem[]
}

export interface SocialPublishingDriver {
  provider: SocialPublishingProvider
  characterLimit: number
  publish: (identity: SocialIdentityCredentials, post: PublishPostInput) => Promise<PublishedPost>
  timeline: (identity: SocialIdentityCredentials, query?: TimelineQuery) => Promise<TimelineResult>
}

/**
 * One post the connected account authored, as returned when walking that
 * account's own history. `uri` is whatever the provider's delete endpoint
 * keys on — an AT-URI on Bluesky, a numeric id on X and Mastodon, a URN on
 * LinkedIn — so it can be handed straight back to `deletePost`.
 */
export interface AuthoredPost {
  uri: string
  cid?: string
  text?: string
  postedAt?: string
  url?: string
}

/** A page of authored posts plus the cursor for the next page, if any. */
export interface AuthoredPostPage {
  cursor?: string
  posts: AuthoredPost[]
}

/**
 * The minimum needed to identify one remote post for deletion. `cid` matters
 * where the delete key differs from the stored URI — Mastodon records a public
 * status URL as its URI but deletes by status id.
 */
export interface RemotePostRef {
  uri: string
  cid?: string
}

/**
 * Deletion capability, kept separate from `SocialPublishingDriver` because
 * publishing and deleting are independently available: Instagram and Threads
 * can publish but their APIs cannot delete a feed post at all, and LinkedIn
 * can delete every post it published while needing an extra partner
 * permission before it will enumerate history.
 *
 * A driver implements what it can. Callers should feature-detect rather than
 * assume, which `supportsDeletion`/`supportsEnumeration` make cheap.
 */
export interface SocialDeletionDriver {
  provider: SocialPublishingProvider
  /** Permanently delete one post the connected account authored. */
  deletePost: (identity: SocialIdentityCredentials, ref: RemotePostRef) => Promise<void>
  /**
   * One page of the account's own posts, newest first. Omit the cursor for
   * the first page; a missing cursor in the result means the history ended.
   */
  listAuthoredPosts?: (
    identity: SocialIdentityCredentials,
    query?: TimelineQuery,
  ) => Promise<AuthoredPostPage>
}

/** Whether a driver can delete posts through its provider's API. */
export function supportsDeletion(driver: unknown): driver is SocialDeletionDriver {
  return typeof (driver as SocialDeletionDriver)?.deletePost === 'function'
}

/** Whether a driver can walk the connected account's own post history. */
export function supportsEnumeration(
  driver: unknown,
): driver is Required<Pick<SocialDeletionDriver, 'listAuthoredPosts'>> & SocialDeletionDriver {
  return typeof (driver as SocialDeletionDriver)?.listAuthoredPosts === 'function'
}
