import type { ProviderInterface, SocialUser } from './types'
import { Buffer } from 'node:buffer'

export interface ProviderConfig {
  clientId: string
  clientSecret: string
  redirectUrl: string
  guzzle?: Record<string, any>
}

export abstract class AbstractProvider implements ProviderInterface {
  protected clientId: string
  protected clientSecret: string
  protected redirectUrl: string
  protected parameters: Record<string, any> = {}
  protected _scopes: string[] = []
  protected scopeSeparator: string = ','
  protected _stateless: boolean = false
  protected _usesPKCE: boolean = false
  protected _codeVerifier: string | null = null
  protected _state: string | null = null
  protected user: SocialUser | null = null

  constructor(config: ProviderConfig) {
    this.clientId = config.clientId
    this.clientSecret = config.clientSecret
    this.redirectUrl = config.redirectUrl
  }

  /**
   * Get the authentication URL for the provider.
   */
  abstract getAuthUrl(): Promise<string>

  /**
   * Get the token URL for the provider.
   */
  protected abstract getTokenUrl(): string

  /**
   * Get the access token from the provider.
   */
  abstract getAccessToken(code: string): Promise<string>

  /**
   * Get the raw user for the given access token.
   */
  abstract getUserByToken(token: string): Promise<SocialUser>

  /**
   * Get the GET parameters for the code request.
   */
  protected async getCodeFields(state: string | null = null): Promise<Record<string, any>> {
    const fields: Record<string, any> = {
      client_id: this.clientId,
      redirect_uri: this.redirectUrl,
      scope: this.formatScopes(this.getScopes(), this.scopeSeparator),
      response_type: 'code',
    }

    if (this.usesState()) {
      fields.state = state
    }

    return { ...fields, ...await this.pkceFields(), ...this.parameters }
  }

  /**
   * Format the given scopes.
   */
  protected formatScopes(scopes: string[], scopeSeparator: string): string {
    return scopes.join(scopeSeparator)
  }

  /**
   * Get a Social User instance from a known access token.
   */
  public async userFromToken(token: string): Promise<SocialUser> {
    const user = await this.getUserByToken(token)
    return { ...user, token }
  }

  /**
   * Merge the scopes of the requested access.
   */
  public scopes(scopes: string | string[]): this {
    const scopeArray = Array.isArray(scopes) ? scopes : [scopes]
    this._scopes = [...new Set([...this._scopes, ...scopeArray])]
    return this
  }

  /**
   * Set the scopes of the requested access.
   */
  public setScopes(scopes: string | string[]): this {
    const scopeArray = Array.isArray(scopes) ? scopes : [scopes]
    this._scopes = [...new Set(scopeArray)]
    return this
  }

  /**
   * Get the current scopes.
   */
  public getScopes(): string[] {
    return this._scopes
  }

  /**
   * Set the redirect URL.
   *
   * Rejects relative-path-only and non-HTTP(S) URLs — accepting `javascript:`
   * or `data:` schemes here would let an attacker who controls the
   * `redirect_uri` query param turn the OAuth callback into an XSS sink.
   */
  public setRedirectUrl(url: string): this {
    if (typeof url !== 'string' || url.length === 0) {
      throw new Error('[socials] setRedirectUrl requires a non-empty string')
    }
    let parsed: URL
    try {
      parsed = new URL(url)
    }
    catch {
      throw new Error(`[socials] setRedirectUrl: invalid URL: ${url}`)
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      throw new Error(`[socials] setRedirectUrl protocol must be http(s)://, got ${parsed.protocol}`)
    }
    this.redirectUrl = url
    return this
  }

  /**
   * Supply the OAuth `state` to embed in the next getAuthUrl() call
   * instead of letting the provider mint one internally. Without this,
   * the state a driver generates is unrecoverable by the caller, so
   * there is nothing to persist (session/cookie) and compare against on
   * the callback — the CSRF check `validateState()` exists for becomes
   * impossible to perform.
   */
  public withState(state: string): this {
    if (typeof state !== 'string' || state.length === 0)
      throw new Error('[socials] withState requires a non-empty string')
    this._state = state
    return this
  }

  /**
   * The state for the next auth URL: caller-supplied via withState(),
   * otherwise a fresh random one.
   */
  protected resolveState(): string {
    return this._state ?? this.getState()
  }

  /**
   * Determine if the provider is operating with state.
   */
  protected usesState(): boolean {
    return !this._stateless
  }

  /**
   * Constant-time check that the OAuth `state` returned from the
   * provider matches the value the application stashed in the session
   * before redirecting. Used to defend against CSRF on the callback —
   * without this, a malicious site can trigger a callback that
   * authenticates the victim into the attacker's account.
   *
   * Returns `true` when the strings match exactly. The comparison is
   * timing-safe so observed response time can't leak prefix matches.
   *
   * @example
   * ```ts
   * const provider = new GithubProvider(…)
   * if (!provider.validateState(req.session.oauthState, req.query.state)) {
   *   throw new HttpError(400, 'Invalid OAuth state')
   * }
   * ```
   */
  public validateState(expected: string | null | undefined, actual: string | null | undefined): boolean {
    if (typeof expected !== 'string' || typeof actual !== 'string') return false
    if (expected.length === 0 || actual.length === 0) return false
    if (expected.length !== actual.length) return false
    // Constant-time compare via crypto.timingSafeEqual on byte buffers.
    // Falling back to a manual XOR compare keeps the behavior under
    // environments without node:crypto (e.g. browser bundles that
    // accidentally include this file).
    try {
      // eslint-disable-next-line ts/no-require-imports
      const { timingSafeEqual } = require('node:crypto') as typeof import('node:crypto')
      return timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(actual, 'utf8'))
    }
    catch {
      let diff = 0
      for (let i = 0; i < expected.length; i++) {
        diff |= expected.charCodeAt(i) ^ actual.charCodeAt(i)
      }
      return diff === 0
    }
  }

  /**
   * Determine if the provider is operating as stateless.
   */
  protected isStateless(): boolean {
    return this._stateless
  }

  /**
   * Indicates that the provider should operate as stateless.
   */
  public stateless(): this {
    this._stateless = true
    return this
  }

  /**
   * Get the string used for session state.
   *
   * 32 random bytes (256 bits) of entropy. Worth doubling from the
   * previous 20 bytes (160 bits) — state is the OAuth-flow CSRF token
   * and is the only thing standing between us and a full callback
   * hijack, so the cost of an extra 24 hex chars per auth attempt is
   * trivial vs the upside.
   */
  protected getState(): string {
    const bytes = new Uint8Array(32)
    crypto.getRandomValues(bytes)
    return Array.from(bytes)
      .map(byte => byte.toString(16).padStart(2, '0'))
      .join('')
  }

  /**
   * Determine if the provider uses PKCE.
   */
  protected usesPKCE(): boolean {
    return this._usesPKCE
  }

  /**
   * Enables PKCE for the provider.
   */
  public enablePKCE(): this {
    this._usesPKCE = true
    return this
  }

  /**
   * The PKCE verifier for the authorization request being built, generated
   * once and kept.
   *
   * It used to return 48 fresh random bytes on every call and assign them to
   * nothing, so the value that was hashed into the challenge no longer
   * existed by the time the exchange needed it (stacksjs/stacks#2908). A
   * verifier nobody can produce again is not a verifier.
   *
   * 32 bytes as base64url is 43 characters, the RFC 7636 minimum and the
   * same entropy the previous 96 hex characters carried.
   */
  protected getCodeVerifier(): string {
    if (this._codeVerifier === null) {
      const bytes = new Uint8Array(32)
      crypto.getRandomValues(bytes)
      this._codeVerifier = Buffer.from(bytes).toString('base64url')
    }

    return this._codeVerifier
  }

  /**
   * The verifier to stash beside `state` before redirecting.
   *
   * PKCE spans two requests, and the instance that built the authorization
   * URL is gone by the time the callback arrives. Put this wherever `state`
   * goes - session, cache, signed cookie - and give it back with
   * {@link withCodeVerifier} before exchanging the code.
   *
   * Null when PKCE is off, or on before an authorization URL has been built.
   */
  public getPkceVerifier(): string | null {
    return this._codeVerifier
  }

  /**
   * Restore the verifier that belongs to an authorization in flight, so the
   * token request can prove it started this flow.
   */
  public withCodeVerifier(verifier: string): this {
    if (!verifier)
      throw new Error('A PKCE code verifier must be a non-empty string')

    this._usesPKCE = true
    this._codeVerifier = verifier
    return this
  }

  /**
   * The PKCE parameters for an authorization request, or nothing when PKCE
   * is off.
   *
   * Drivers build their own authorization URLs, so this is what they merge
   * in. Returning a whole object rather than a challenge string keeps the
   * challenge and its method from being added one without the other.
   */
  protected async pkceFields(): Promise<Record<string, string>> {
    if (!this.usesPKCE())
      return {}

    return {
      code_challenge: await this.getCodeChallenge(),
      code_challenge_method: this.getCodeChallengeMethod(),
    }
  }

  /**
   * The PKCE parameter for a token request, or nothing when PKCE is off.
   *
   * Throws rather than silently omitting `code_verifier` when PKCE is on and
   * no verifier is known: a token request missing it either fails at a
   * provider that enforces PKCE, or succeeds at one that does not and leaves
   * the developer believing the code was protected.
   */
  protected pkceTokenFields(): Record<string, string> {
    if (!this.usesPKCE())
      return {}

    if (this._codeVerifier === null)
      throw new Error('PKCE is enabled but no code verifier is known for this exchange. Pass the one from getPkceVerifier() back with withCodeVerifier().')

    return { code_verifier: this._codeVerifier }
  }

  /**
   * The S256 challenge for the current verifier.
   *
   * Uses Buffer's native base64url encoding instead of building it from
   * `btoa(String.fromCharCode(...bytes))`. The latter coerces every
   * byte through `String.fromCharCode`, which is fine for hashes but
   * produces incorrect output for any input containing bytes >= 0x80
   * because `String.fromCharCode` returns a UTF-16 code unit, not a
   * raw byte. SHA-256 hashes routinely include such bytes.
   *
   * `@stacksjs/auth` has an RFC 7636 validated pair of these, and this
   * deliberately does not import it: auth pulls in the database and ORM
   * graph, which is a heavy dependency for a package that needs four lines
   * of hashing.
   */
  protected async getCodeChallenge(): Promise<string> {
    const encoder = new TextEncoder()
    const data = encoder.encode(this.getCodeVerifier())
    const hash = await crypto.subtle.digest('SHA-256', data)
    return Buffer.from(new Uint8Array(hash)).toString('base64url')
  }

  /**
   * Returns the hash method used to calculate the PKCE code challenge.
   */
  protected getCodeChallengeMethod(): string {
    return 'S256'
  }

  /**
   * Set the custom parameters of the request.
   */
  public with(parameters: Record<string, any>): this {
    this.parameters = parameters
    return this
  }

  /**
   * Build the authentication URL for the provider from the given base URL.
   */
  protected async buildAuthUrlFromBase(url: string, state: string | null): Promise<string> {
    const query = new URLSearchParams(await this.getCodeFields(state))
    return `${url}?${query.toString()}`
  }
}
