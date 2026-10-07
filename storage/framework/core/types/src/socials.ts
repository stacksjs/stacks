/**
 * **Socials Options**
 *
 * Which social accounts this application posts as, and where each one's
 * credentials come from. Because Stacks is fully-typed, you may hover any of
 * the options below and the definitions will be provided. In case you have any
 * questions, feel free to reach out via Discord or GitHub Discussions.
 */
export interface SocialsOptions {
  /**
   * The identity used when a call names none.
   *
   * Must be a key of {@link SocialsOptions.identities}. Left unset, a call has
   * to name its identity, which is the safer default when more than one is
   * configured: posting to the wrong account is not something you can take
   * back.
   */
  default?: string

  /**
   * The accounts this application posts as, keyed by a name you choose.
   *
   * Named rather than one set of credentials per platform, because one
   * application legitimately speaks as more than one account: a framework and
   * a language under the same roof are two identities on the same two
   * networks, and they must not be able to post as each other by accident.
   */
  identities?: Record<string, SocialIdentityOptions>
}

/** One account, and the platforms it posts on. */
export interface SocialIdentityOptions {
  /**
   * The public handle, for display and for logs.
   *
   * Not a credential and not used to authenticate. It is here so an operator
   * reading output can tell which account acted without the log reaching for
   * anything secret.
   */
  handle?: string

  /**
   * The platforms this identity is set up for.
   *
   * Listing a platform says credentials are expected for it, so a missing one
   * is reported as a configuration error rather than a silent no-op.
   */
  platforms?: readonly SocialCredentialPlatform[]

  /**
   * Credentials supplied inline, overriding the environment convention.
   *
   * The convention covers the normal case and keeps secrets out of the
   * repository, so prefer it. This exists for the cases it cannot serve: a
   * value fetched from a secret manager at boot, or a test supplying its own.
   */
  credentials?: Partial<SocialCredentialsByPlatform>
}

/**
 * The platforms whose credential shape is confirmed against their driver.
 *
 * Read off each driver's `publish()` rather than from its documentation: what
 * a driver refuses to post without is the only authority on what a credential
 * has to carry. Every one of these is the full set of fields its driver
 * dereferences.
 *
 * Deliberately not {@link SocialProviderName}, which is the OAuth sign-in
 * layer. Signing a visitor in with Google and posting as an account are
 * different capabilities, and a type that conflates them lets a sign-in
 * provider be passed where a publishing driver is meant.
 */
export type SocialCredentialPlatform =
  | 'bluesky'
  | 'twitter'
  | 'linkedin'
  | 'mastodon'
  | 'instagram'
  | 'threads'

export interface SocialCredentialsByPlatform {
  bluesky: BlueskyCredentialOptions
  twitter: TwitterCredentialOptions
  linkedin: LinkedInCredentialOptions
  mastodon: MastodonCredentialOptions
  instagram: InstagramCredentialOptions
  threads: ThreadsCredentialOptions
}

/**
 * Bluesky authenticates with an app password, not an OAuth token.
 *
 * Generate it in Settings, App Passwords; it is not the account password and
 * can be revoked on its own. The driver mints a session per use from these,
 * so there is nothing short-lived to store or refresh.
 *
 * Environment convention: `SOCIALS_<IDENTITY>_BLUESKY_IDENTIFIER` and
 * `SOCIALS_<IDENTITY>_BLUESKY_PASSWORD`.
 */
export interface BlueskyCredentialOptions {
  /** The handle or email the app password belongs to. */
  identifier?: string
  /** The app password. Never the account password. */
  password?: string
  /** A PDS other than `https://bsky.social`. */
  service?: string
}

/**
 * X authenticates posting with a user-context OAuth 2.0 token (PKCE).
 *
 * Only `clientId` and `clientSecret` are static. The access and refresh
 * tokens are per identity and come out of a consent flow, so unlike Bluesky
 * they cannot simply be pasted into `.env` ahead of time: something has to run
 * the flow and persist the result. Until then an identity can be declared and
 * will report that it is not yet authorized, rather than appearing to work.
 *
 * Environment convention: `SOCIALS_<IDENTITY>_TWITTER_CLIENT_ID`,
 * `_CLIENT_SECRET`, `_ACCESS_TOKEN` and `_REFRESH_TOKEN`.
 */
export interface TwitterCredentialOptions {
  clientId?: string
  clientSecret?: string
  accessToken?: string
  refreshToken?: string
}

/**
 * LinkedIn posts as a member, named by URN.
 *
 * `LinkedInPublishingDriver.publish()` reads `identity.did` as the author
 * URN and refuses without it, so the URN is a credential here rather than
 * something to look up per post. It comes out of the consent flow's
 * `getProfile()` as `urn:li:person:{sub}`.
 *
 * `clientId` and `clientSecret` are only for refreshing: posting itself needs
 * the access token and the URN.
 *
 * Environment convention: `SOCIALS_<IDENTITY>_LINKEDIN_ACCESS_TOKEN`,
 * `_MEMBER_URN`, and optionally `_CLIENT_ID`, `_CLIENT_SECRET`,
 * `_API_VERSION`.
 */
export interface LinkedInCredentialOptions {
  accessToken?: string
  /** `urn:li:person:{sub}` or `urn:li:organization:{id}`. */
  memberUrn?: string
  clientId?: string
  clientSecret?: string
  /**
   * The `LinkedIn-Version` header this identity posts under, as `YYYYMM`.
   *
   * Pinned per identity because LinkedIn dates its API and a tenant can be
   * behind: the driver's own default is one value for every caller. Unverified
   * against a live tenant (stacksjs/stacks#2859).
   */
  apiVersion?: string
}

/**
 * Mastodon is one protocol across many hosts, so the host is a credential.
 *
 * `MastodonPublishingDriver` reads `identity.did` as the instance base URL,
 * because an access token means nothing without the instance that issued it.
 *
 * The token is generated by hand in the instance's Preferences, Development,
 * so there is no consent URL or code exchange to run: this is the one platform
 * here whose credentials can be pasted into `.env` complete.
 *
 * Environment convention: `SOCIALS_<IDENTITY>_MASTODON_ACCESS_TOKEN` and
 * `_INSTANCE_URL`.
 */
export interface MastodonCredentialOptions {
  accessToken?: string
  /** The instance origin, e.g. `https://mastodon.social`. */
  instanceUrl?: string
}

/**
 * Instagram posts to a Business account, named by id.
 *
 * `InstagramPublishingDriver` reads `identity.did` as the account id and
 * refuses without it. Note that Instagram also refuses a text-only post: its
 * `publish()` requires `media[0].url` to be a publicly reachable image, so an
 * identity configured for Instagram alone cannot post what the others can.
 *
 * Environment convention: `SOCIALS_<IDENTITY>_INSTAGRAM_ACCESS_TOKEN` and
 * `_ACCOUNT_ID`.
 */
export interface InstagramCredentialOptions {
  accessToken?: string
  /** The Instagram Business account id, from the Graph API. */
  accountId?: string
  clientId?: string
  clientSecret?: string
}

/**
 * Threads posts as a user, named by id.
 *
 * `ThreadsPublishingDriver` reads `identity.did` as the user id, which the
 * token exchange returns alongside the access token.
 *
 * Environment convention: `SOCIALS_<IDENTITY>_THREADS_ACCESS_TOKEN` and
 * `_USER_ID`.
 */
export interface ThreadsCredentialOptions {
  accessToken?: string
  /** The Threads user id, returned by the token exchange. */
  userId?: string
  clientId?: string
  clientSecret?: string
}

export type SocialsConfig = Partial<SocialsOptions>
