import type { ProviderInterface, SocialUser } from './types'

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
  protected getCodeFields(state: string | null = null): Record<string, any> {
    const fields: Record<string, any> = {
      client_id: this.clientId,
      redirect_uri: this.redirectUrl,
      scope: this.formatScopes(this.getScopes(), this.scopeSeparator),
      response_type: 'code',
    }

    if (this.usesState()) {
      fields.state = state
    }

    if (this.usesPKCE()) {
      fields.code_challenge = this.getCodeChallenge()
      fields.code_challenge_method = this.getCodeChallengeMethod()
    }

    return { ...fields, ...this.parameters }
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
   * Determine if the provider is operating with state.
   */
  protected usesState(): boolean {
    return !this._stateless
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
   * Generates a random string for the PKCE code verifier.
   */
  protected getCodeVerifier(): string {
    const bytes = new Uint8Array(48) // 96 chars = 48 bytes
    crypto.getRandomValues(bytes)
    return Array.from(bytes)
      .map(byte => byte.toString(16).padStart(2, '0'))
      .join('')
  }

  /**
   * Generates the PKCE code challenge based on the code verifier.
   *
   * Uses Buffer's native base64url encoding instead of building it from
   * `btoa(String.fromCharCode(...bytes))`. The latter coerces every
   * byte through `String.fromCharCode`, which is fine for hashes but
   * produces incorrect output for any input containing bytes ≥ 0x80
   * because `String.fromCharCode` returns a UTF-16 code unit, not a
   * raw byte. SHA-256 hashes routinely include such bytes — the old
   * code happened to work because the manual replace() handled the
   * artifacts, but the new path is provably correct end-to-end.
   */
  protected async getCodeChallenge(): Promise<string> {
    const encoder = new TextEncoder()
    const data = encoder.encode(this.getCodeVerifier())
    const hash = await crypto.subtle.digest('SHA-256', data)
    // Buffer is available in Bun and Node; base64url encoding produces
    // the URL-safe variant directly without manual character substitution.
    const { Buffer } = await import('node:buffer')
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
  protected buildAuthUrlFromBase(url: string, state: string | null): string {
    const query = new URLSearchParams(this.getCodeFields(state))
    return `${url}?${query.toString()}`
  }
}
