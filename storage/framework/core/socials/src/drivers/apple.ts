import type { ProviderConfig } from '../abstract'
import type { AppleIdTokenClaims, AppleTokenResponse, ProviderInterface, SocialUser } from '../types'
import { Buffer } from 'node:buffer'
import { createPrivateKey, sign } from 'node:crypto'
import { config } from '@stacksjs/config'
import { AbstractProvider } from '../abstract'
import { ConfigException } from '../exceptions'

/**
 * Apple replaces the static client secret with a signed JWT, so its
 * provider config carries the signing inputs instead of clientSecret
 * (which may be left '').
 */
export interface AppleProviderConfig extends ProviderConfig {
  teamId?: string
  keyId?: string
  privateKey?: string
}

/**
 * Sign in with Apple (OAuth2 / OIDC).
 *
 * Apple deviates from the other providers in three ways, all handled
 * here so callers keep the same getAuthUrl/getAccessToken/getUserByToken
 * contract:
 *
 * 1. There is no static client secret. Apple requires a short-lived JWT
 *    signed with an ES256 private key (.p8) issued in the developer
 *    portal, scoped by team ID and key ID. `generateClientSecret()`
 *    builds one per token exchange.
 * 2. There is no userinfo endpoint. Identity comes from the `id_token`
 *    returned by the token endpoint, so `getAccessToken()` returns the
 *    id_token (not the access token — there is nothing to spend it on),
 *    and `getUserByToken()` decodes its claims. The id_token arrives
 *    straight from Apple's token endpoint over TLS, which OIDC Core
 *    3.1.3.7 accepts in place of local signature verification; iss, aud
 *    and exp are still validated.
 * 3. When scopes are requested (they are by default: name + email),
 *    Apple mandates `response_mode=form_post` — the callback arrives as
 *    a cross-site POST, not a GET. Applications must register a POST
 *    callback route and use a cookie jar that survives cross-site POSTs
 *    (SameSite=None) if they carry state in cookies.
 *
 * Note that Apple only transmits the user's name (and only on the very
 * first authorization) as a `user` JSON field in the form_post body —
 * it is never part of the id_token. Reading it is the application's
 * job; `SocialUser.name` from this driver is therefore always ''.
 */
export class AppleProvider extends AbstractProvider implements ProviderInterface {
  protected baseUrl = 'https://appleid.apple.com'
  protected teamId: string = ''
  protected keyId: string = ''
  protected privateKey: string = ''

  constructor(providerConfig: AppleProviderConfig) {
    super(providerConfig)
    this.teamId = providerConfig.teamId ?? ''
    this.keyId = providerConfig.keyId ?? ''
    this.privateKey = providerConfig.privateKey ?? ''
  }

  private getConfig() {
    // Instance values (constructor args or set*() calls) win over the
    // global config — otherwise setRedirectUrl()/setScopes() are
    // silently ignored, which breaks per-request redirect URIs.
    const providerConfig = {
      clientId: this.clientId || (config.services.apple?.clientId ?? ''),
      teamId: this.teamId || (config.services.apple?.teamId ?? ''),
      keyId: this.keyId || (config.services.apple?.keyId ?? ''),
      // .p8 keys pasted into env files often arrive with literal \n —
      // normalize so createPrivateKey can parse the PEM.
      privateKey: (this.privateKey || (config.services.apple?.privateKey ?? '')).replace(/\\n/g, '\n'),
      redirectUrl: this.redirectUrl || (config.services.apple?.redirectUrl ?? ''),
      scopes: this._scopes.length > 0
        ? this._scopes
        : (config.services.apple?.scopes ?? ['name', 'email']),
    }
    this.setScopes(providerConfig.scopes)
    return providerConfig
  }

  /**
   * Get the authentication URL for Apple.
   */
  public async getAuthUrl(): Promise<string> {
    const state = this.resolveState()
    const { clientId, redirectUrl, scopes } = this.getConfig()
    this.validateConfig()

    const fields: Record<string, string> = {
      client_id: clientId,
      redirect_uri: redirectUrl,
      scope: scopes.join(' '),
      state,
      response_type: 'code',
      ...this.parameters,
    }

    // Apple rejects the request outright when scopes are present without
    // form_post (the browser would leak name/email in a URL otherwise).
    if (scopes.length > 0)
      fields.response_mode = 'form_post'

    return `${this.baseUrl}/auth/authorize?${new URLSearchParams(fields).toString()}`
  }

  /**
   * Exchange the authorization code. Returns the id_token — Apple's only
   * identity credential (see class docblock) — for use with
   * getUserByToken().
   */
  public async getAccessToken(code: string): Promise<string> {
    const { clientId, redirectUrl } = this.getConfig()
    this.validateConfig()

    // Apple's token endpoint only accepts application/x-www-form-urlencoded,
    // so this deliberately bypasses the JSON-bodied fetcher.
    const response = await fetch(`${this.baseUrl}/auth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUrl,
        client_id: clientId,
        client_secret: this.generateClientSecret(),
      }),
    })

    const data = await response.json() as AppleTokenResponse

    if (!response.ok || data.error)
      throw new Error(`Apple OAuth error: ${data.error_description ?? data.error ?? `HTTP ${response.status}`}`)

    if (!data.id_token)
      throw new Error('Apple OAuth error: token response contained no id_token')

    return data.id_token
  }

  /**
   * Build the SocialUser from an id_token's claims (Apple has no user
   * API to call). Validates iss/aud/exp before trusting them.
   */
  public async getUserByToken(token: string): Promise<SocialUser> {
    const { clientId } = this.getConfig()
    const claims = this.decodeIdToken(token)

    const issOk = claims.iss === this.baseUrl
    const audOk = Array.isArray(claims.aud) ? claims.aud.includes(clientId) : claims.aud === clientId
    const expOk = typeof claims.exp === 'number' && claims.exp * 1000 > Date.now()
    if (!issOk || !audOk || !expOk)
      throw new Error('Apple OAuth error: id_token claims failed validation (iss/aud/exp)')

    if (!claims.sub)
      throw new Error('Apple OAuth error: id_token has no subject')

    const email = typeof claims.email === 'string' ? claims.email : null

    // email_verified arrives as a boolean or the string "true"/"false"
    // depending on the API era.
    let emailVerified: boolean | null = null
    if (claims.email_verified === true || claims.email_verified === 'true')
      emailVerified = true
    else if (claims.email_verified === false || claims.email_verified === 'false')
      emailVerified = false

    return {
      id: String(claims.sub),
      nickname: null,
      name: '', // only ever sent in the first-auth form_post `user` field
      email,
      emailVerified,
      avatar: null,
      token,
      raw: claims,
    }
  }

  /**
   * Build the short-lived ES256 client-secret JWT Apple requires in
   * place of a static secret (max lifetime 6 months; 1 hour is plenty
   * since one is minted per exchange).
   */
  protected generateClientSecret(): string {
    const { clientId, teamId, keyId, privateKey } = this.getConfig()

    const now = Math.floor(Date.now() / 1000)
    const header = { alg: 'ES256', kid: keyId, typ: 'JWT' }
    const payload = {
      iss: teamId,
      iat: now,
      exp: now + 3600,
      aud: this.baseUrl,
      sub: clientId,
    }

    const input = `${this.base64urlJson(header)}.${this.base64urlJson(payload)}`

    let key: ReturnType<typeof createPrivateKey>
    try {
      key = createPrivateKey(privateKey)
    }
    catch (error) {
      throw new ConfigException(`Apple private key could not be parsed: ${error instanceof Error ? error.message : String(error)}`)
    }

    // JWTs need the raw r||s signature (IEEE P1363), not ASN.1/DER,
    // which is node's default for ECDSA.
    const signature = sign('sha256', Buffer.from(input), { key, dsaEncoding: 'ieee-p1363' })
    return `${input}.${signature.toString('base64url')}`
  }

  /** Decode a JWT payload without verifying it (see class docblock for why that's acceptable here). */
  protected decodeIdToken(idToken: string): AppleIdTokenClaims {
    const parts = idToken.split('.')
    if (parts.length !== 3)
      throw new Error('Apple OAuth error: malformed id_token')
    return JSON.parse(Buffer.from(parts[1] as string, 'base64url').toString('utf8')) as AppleIdTokenClaims
  }

  private base64urlJson(value: unknown): string {
    return Buffer.from(JSON.stringify(value)).toString('base64url')
  }

  /**
   * Validate the provider configuration.
   */
  protected validateConfig(): void {
    const { clientId, teamId, keyId, privateKey, redirectUrl } = this.getConfig()

    if (!clientId)
      throw new ConfigException('Apple client ID (Service ID) not provided')

    if (!teamId)
      throw new ConfigException('Apple team ID not provided')

    if (!keyId)
      throw new ConfigException('Apple key ID not provided')

    if (!privateKey)
      throw new ConfigException('Apple private key not provided')

    if (!redirectUrl)
      throw new ConfigException('Apple redirect URL not provided')
  }

  protected getTokenUrl(): string {
    return `${this.baseUrl}/auth/token`
  }
}
