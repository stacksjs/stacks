/**
 * The browser cookie that carries a personal access token.
 *
 * One name, in one place. Before stacksjs/stacks#2236 there were two: the
 * writer (`authCookie()`) defaulted to `stacks_auth` while every reader looked
 * for `config.auth.defaultTokenName` (`auth-token`), so a cookie the framework
 * set was never one the framework read.
 */
export interface AuthCookieConfig {
  /**
   * Cookie name. Must be a valid RFC 6265 token: no spaces, no separators.
   * @default 'auth-token'
   */
  name?: string
  /** Path the cookie is sent for. @default '/' */
  path?: string
  /** Domain, for sharing one session across subdomains. */
  domain?: string
  /** Lifetime in seconds. Defaults to `tokenExpiry`, so cookie and token die together. */
  maxAge?: number
  /**
   * Send only over HTTPS. Defaults to true outside local development, where
   * the dev server is plain HTTP and a Secure cookie would never be stored.
   */
  secure?: boolean
  /** @default 'Lax' — a link from an email arrives signed in; a cross-site POST does not. */
  sameSite?: 'Strict' | 'Lax' | 'None'
}

export interface AuthOptions {
  /**
   * Top-level feature gate. When `false`, the auth feature is inert at boot
   * (no token/password-reset/email-verification flows wired up). Missing or
   * `true` means auth is on.
   */
  enabled?: boolean
  /** Optional deploy-target gate, e.g. `['production']`. */
  env?: string[]
  /**
   * The default authentication guard to use
   */
  default: string

  /**
   * The authentication guards available
   */
  guards: {
    [key: string]: {
      /**
       * The authentication driver to use
       */
      driver: 'session' | 'token'

      /**
       * The authentication provider to use
       */
      provider: string
    }
  }

  /**
   * The authentication providers available
   */
  providers: {
    [key: string]: {
      /**
       * The database driver to use
       */
      driver: 'database'

      /**
       * The database table to use
       */
      table: string
    }
  }

  /**
   * The username field used for authentication
   */
  username: string

  /**
   * The password field used for authentication
   */
  password: string

  /**
   * The access-token expiry time in milliseconds. Defaults to 1 hour —
   * the matching refresh token below covers the longer-lived window.
   */
  tokenExpiry: number

  /**
   * The refresh-token expiry time in milliseconds. Defaults to 30 days.
   * Refresh tokens are single-use and rotate on every refresh exchange.
   */
  refreshTokenExpiry?: number

  /**
   * The token rotation time in hours
   */
  tokenRotation: number

  /**
   * The token abilities that are granted by default
   */
  defaultAbilities: string[]

  /**
   * The label written to a personal access token's `name` column.
   *
   * Per-token and human-readable — it is what a "your active sessions" list
   * shows, and `createTokenForUser(user, { name: 'iPhone' })` overrides it.
   *
   * It is NOT the auth cookie's name, although four separate readers used to
   * treat it as one (stacksjs/stacks#2236). That overload could not hold: one
   * key cannot be both a per-row label and a single wire identifier, and an
   * app setting `defaultTokenName: 'Web Session'` to tidy its sessions UI
   * silently renamed the cookie those readers looked for — to a string with a
   * space in it, which RFC 6265 does not permit in a cookie name. Use
   * {@link AuthCookieConfig.name}.
   */
  defaultTokenName: string

  /**
   * The browser cookie that carries a personal access token.
   *
   * Used by `authCookie()` / `authCookieName()` in `@stacksjs/auth` and by
   * every framework reader that resolves a signed-in user from a request.
   */
  cookie: AuthCookieConfig

  /**
   * Password reset configuration
   */
  passwordReset: {
    /**
     * Token expiration time in minutes
     * @default 60
     */
    expire: number

    /**
     * Throttle time in seconds between password reset requests
     * @default 60
     */
    throttle: number

    /**
     * Reset-link URL template. Supports `{token}` and `{email}`
     * placeholders. Absolute templates (`https://…`) are used as-is;
     * path templates are prefixed with the app URL. Lets apps whose
     * reset page lives on a custom route reuse `passwordResets().sendEmail()`
     * instead of hand-rolling the send.
     * @default '/password/reset/{token}?email={email}'
     */
    url?: string
  }

  /**
   * Email verification configuration
   */
  emailVerification?: {
    /**
     * Token expiration time in minutes
     * @default 60
     */
    expire?: number

    /**
     * Verification-link URL template. Supports `{id}` and `{token}`
     * placeholders. Absolute templates (`https://…`) are used as-is;
     * path templates are prefixed with the app URL. Lets apps whose
     * verify page lives on a custom route reuse `sendVerificationEmail()`
     * instead of hand-rolling the send.
     * @default '/verify-email/{id}/{token}'
     */
    url?: string
  }

  /**
   * Session-auth hardening options (stacksjs/stacks#1985).
   */
  session?: {
    /**
     * Reject a session request whose IP / User-Agent no longer matches the
     * fingerprint captured at login (basic hijack detection). Off by default
     * because a changing client IP (mobile networks, VPNs) would otherwise
     * log the real user out. `true` enforces both fields; the object form
     * enforces each independently — enforcing only `userAgent` (stable)
     * avoids most false positives.
     * @default false
     */
    enforceFingerprint?: boolean | { ip?: boolean, userAgent?: boolean }
  }

  /**
   * Registration hardening options (stacksjs/stacks#1985).
   */
  registration?: {
    /**
     * When true, a duplicate-email registration returns a generic error
     * instead of "Email already exists", so the endpoint no longer confirms
     * whether an address is registered. Off by default (the specific message
     * is friendlier). Reduces the disclosure; a fully non-enumerable flow
     * (always respond success + notify the existing account out-of-band) is
     * a larger, separate opt-in.
     * @default false
     */
    preventEnumeration?: boolean
  }

  /**
   * Social sign-in policy (stacksjs/stacks#2276).
   */
  socials?: {
    /**
     * What happens when a provider identity has no link row yet:
     *
     * - `'link'` — a verified-email match links to the existing user, no
     *   match creates a new user. An UNVERIFIED provider email never links
     *   to an existing account regardless of this setting (account-takeover
     *   guard).
     * - `'create'` — never match by email; a first-time identity always
     *   becomes a new user.
     * - `'refuse'` — only identities linked beforehand may sign in.
     * @default 'link'
     */
    matching?: 'link' | 'create' | 'refuse'
  }
}

export type AuthConfig = Partial<AuthOptions>

export interface AuthInstance {
  guard: string
  provider: string
  user?: any
  token?: string
}

export type GuardType = 'session' | 'token'
export type ProviderType = 'database'

export interface AuthDriver {
  attempt: (credentials: any) => Promise<boolean>
  validate: (token: string) => Promise<boolean>
  login: (credentials: any) => Promise<{ token: string } | null>
  logout: () => Promise<void>
  user: () => Promise<any>
  token: () => string | null
}

export interface Authenticatable {
  getAuthIdentifier: () => any
  getAuthPassword: () => string
  getRememberToken: () => string
  setRememberToken: (token: string) => void
}
