import type { ProviderInterface, SocialUser } from '../types'
import type { ProviderConfig } from '../abstract'
import { Buffer } from 'node:buffer'
import { AbstractProvider } from '../abstract'
import { ConfigException } from '../exceptions'

export interface StacksIssuerConfig extends ProviderConfig {
  /** The other application's provider issuer, e.g. `https://hq.example/api/platform/oauth`. */
  issuer: string
  scopes?: string[]
  /**
   * RFC 8707 resource indicator(s). Required whenever the issuer binds the
   * requested scopes to a resource, which a Stacks provider does for every
   * scope that names `resources`.
   */
  resource?: string | string[]
  /** Endpoint overrides; default to the Stacks provider's `{issuer}/authorize|token|revoke`. */
  authorizeUrl?: string
  tokenUrl?: string
  revokeUrl?: string
  /** The issuing application's userinfo endpoint (`oauthUserInfoResponse` in @stacksjs/auth). */
  userInfoUrl: string
}

export interface StacksIssuerTokens {
  accessToken: string
  refreshToken: string | null
  /** Seconds until the access token expires, when the issuer says. */
  expiresIn: number | null
  scopes: string[]
}

export class StacksIssuerError extends Error {
  constructor(public readonly code: string, public readonly status: number) {
    super(`Stacks issuer refused the request: ${code}`)
    this.name = 'StacksIssuerError'
  }
}

/**
 * Sign in with another Stacks application that runs `oauthProvider`: one
 * Stacks app as the identity of record, others as relying parties. Always
 * Authorization Code with S256 PKCE and client_secret_basic, the profile the
 * provider supports. The provider has no id_token; the person comes from the
 * issuer's userinfo endpoint, keyed by its pairwise `sub`.
 *
 * Keep the refresh token from {@link getTokens} when the relying party reads
 * the profile again later (continuous profile sync); `getAccessToken` alone
 * drops it.
 */
export class StacksIssuerProvider extends AbstractProvider implements ProviderInterface {
  protected scopeSeparator = ' '
  private readonly settings: StacksIssuerConfig

  constructor(config: StacksIssuerConfig) {
    super(config)
    this.settings = config
    this._scopes = config.scopes?.length ? [...config.scopes] : []
    this._usesPKCE = true
  }

  private endpoint(kind: 'authorize' | 'token' | 'revoke'): string {
    const explicit = kind === 'authorize' ? this.settings.authorizeUrl : kind === 'token' ? this.settings.tokenUrl : this.settings.revokeUrl
    return explicit || `${this.settings.issuer.replace(/\/+$/, '')}/${kind}`
  }

  private resources(): string[] {
    const value = this.settings.resource
    return value == null ? [] : Array.isArray(value) ? value : [value]
  }

  protected validateConfig(): void {
    if (!this.settings.issuer) throw new ConfigException('Stacks issuer not provided')
    if (!this.clientId) throw new ConfigException('Stacks issuer client ID not provided')
    if (!this.clientSecret) throw new ConfigException('Stacks issuer client secret not provided')
    if (!this.redirectUrl) throw new ConfigException('Stacks issuer redirect URL not provided')
    if (!this.settings.userInfoUrl) throw new ConfigException('Stacks issuer userinfo URL not provided')
  }

  protected getTokenUrl(): string {
    return this.endpoint('token')
  }

  public async getAuthUrl(): Promise<string> {
    this.validateConfig()
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUrl,
      response_type: 'code',
      scope: this.formatScopes(this.getScopes(), this.scopeSeparator),
      state: this.resolveState(),
      ...await this.pkceFields(),
    })
    for (const resource of this.resources()) params.append('resource', resource)
    for (const [key, value] of Object.entries(this.parameters)) params.set(key, String(value))
    return `${this.endpoint('authorize')}?${params.toString()}`
  }

  private async post(url: string, form: URLSearchParams): Promise<any> {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${encodeURIComponent(this.clientId)}:${encodeURIComponent(this.clientSecret)}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: form.toString(),
    })
    const body = await response.json().catch(() => ({})) as Record<string, unknown>
    if (!response.ok) throw new StacksIssuerError(typeof body.error === 'string' ? body.error : 'server_error', response.status)
    return body
  }

  private tokens(body: Record<string, unknown>): StacksIssuerTokens {
    if (typeof body.access_token !== 'string' || !body.access_token)
      throw new StacksIssuerError('invalid_token_response', 502)
    return {
      accessToken: body.access_token,
      refreshToken: typeof body.refresh_token === 'string' ? body.refresh_token : null,
      expiresIn: typeof body.expires_in === 'number' ? body.expires_in : null,
      scopes: typeof body.scope === 'string' ? body.scope.split(' ').filter(Boolean) : [],
    }
  }

  /** The whole token answer, refresh token included. */
  public async getTokens(code: string): Promise<StacksIssuerTokens> {
    this.validateConfig()
    const form = new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: this.redirectUrl, ...this.pkceTokenFields() })
    for (const resource of this.resources()) form.append('resource', resource)
    return this.tokens(await this.post(this.endpoint('token'), form))
  }

  public async getAccessToken(code: string): Promise<string> {
    return (await this.getTokens(code)).accessToken
  }

  /** Rotate a refresh token. The issuer rotates it, so store the new one. */
  public async refreshTokens(refreshToken: string): Promise<StacksIssuerTokens> {
    this.validateConfig()
    const form = new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken })
    for (const resource of this.resources()) form.append('resource', resource)
    return this.tokens(await this.post(this.endpoint('token'), form))
  }

  /** RFC 7009: ends the grant from the relying party's side (unlinking). */
  public async revokeToken(token: string, hint: 'refresh_token' | 'access_token' = 'refresh_token'): Promise<void> {
    this.validateConfig()
    await this.post(this.endpoint('revoke'), new URLSearchParams({ token, token_type_hint: hint }))
  }

  /** The claims the person released to this client, by the issuer's own names. */
  public async getClaims(token: string): Promise<Record<string, unknown>> {
    this.validateConfig()
    const response = await fetch(this.settings.userInfoUrl, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } })
    const body = await response.json().catch(() => ({})) as Record<string, unknown>
    if (!response.ok) throw new StacksIssuerError(typeof body.error === 'string' ? body.error : 'invalid_token', response.status)
    if (typeof body.sub !== 'string' || !body.sub) throw new StacksIssuerError('invalid_userinfo', 502)
    return body
  }

  public async getUserByToken(token: string): Promise<SocialUser> {
    const claims = await this.getClaims(token)
    const email = typeof claims.email === 'string' ? claims.email : null
    return {
      id: String(claims.sub),
      nickname: typeof claims.preferred_username === 'string' ? claims.preferred_username : null,
      name: typeof claims.name === 'string' && claims.name ? claims.name : (email ?? ''),
      email,
      emailVerified: typeof claims.email_verified === 'boolean' ? claims.email_verified : null,
      avatar: typeof claims.picture === 'string' ? claims.picture : null,
      token,
      raw: claims,
    }
  }
}
