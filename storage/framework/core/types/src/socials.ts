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

/** The platforms whose credential shape is confirmed against their driver. */
export type SocialCredentialPlatform = 'bluesky' | 'twitter'

export interface SocialCredentialsByPlatform {
  bluesky: BlueskyCredentialOptions
  twitter: TwitterCredentialOptions
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

export type SocialsConfig = Partial<SocialsOptions>
