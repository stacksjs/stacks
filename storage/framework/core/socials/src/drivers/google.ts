import type { ProviderInterface, SocialUser } from '../types'
import { fetcher } from '@stacksjs/api'
import { config } from '@stacksjs/config'
import { AbstractProvider } from '../abstract'
import { ConfigException } from '../exceptions'
import { verifyIdToken } from '../id-token'

interface GoogleTokenResponse {
  access_token: string
  token_type: string
  expires_in: number
  error?: string
  error_description?: string
}

interface GoogleUser {
  id: string
  email: string
  verified_email: boolean
  name: string
  given_name: string
  family_name: string
  picture: string
  locale: string
}

export class GoogleProvider extends AbstractProvider implements ProviderInterface {
  protected baseUrl = 'https://accounts.google.com'
  protected apiUrl = 'https://www.googleapis.com'
  /**
   * The documented token endpoint. `accounts.google.com/oauth2/v4/token` still
   * answers, but it has not been the documented one for years, and an
   * undocumented endpoint is the kind that goes without notice
   * (stacksjs/stacks#2859). One constant, so the exchange and
   * `getTokenUrl()` cannot disagree.
   */
  protected tokenUrl = 'https://oauth2.googleapis.com/token'
  /** Where an access token is traded for the client it was issued to. */
  protected tokenInfoUrl = 'https://oauth2.googleapis.com/tokeninfo'
  /** Google's published id_token signing keys. */
  protected certsUrl = 'https://www.googleapis.com/oauth2/v3/certs'
  /** Google issues its id_tokens under both spellings. */
  protected issuers = ['https://accounts.google.com', 'accounts.google.com']

  private getConfig() {
    // Instance values (constructor args or set*() calls) win over the
    // global config — otherwise setRedirectUrl()/setScopes() are
    // silently ignored, which breaks per-request redirect URIs.
    const providerConfig = {
      clientId: this.clientId || (config.services.google?.clientId ?? ''),
      clientSecret: this.clientSecret || (config.services.google?.clientSecret ?? ''),
      redirectUrl: this.redirectUrl || (config.services.google?.redirectUrl ?? ''),
      // Minimal default scopes: openid + email is enough to identify a
      // returning user. The previous default also requested
      // userinfo.profile, which grants `name`, `picture`, `locale`, and
      // `gender`. Apps that actually need those should opt in via
      // config.services.google.scopes — silently collecting it on every
      // signin violated GDPR's data-minimization principle.
      scopes: this._scopes.length > 0
        ? this._scopes
        : (config.services.google?.scopes ?? [
            'openid',
            'email',
          ]),
    }

    this.setScopes(providerConfig.scopes)
    return providerConfig
  }

  /**
   * Get the authentication URL for Google.
   */
  public async getAuthUrl(): Promise<string> {
    const state = this.resolveState()
    const { clientId, redirectUrl, scopes } = this.getConfig()
    this.validateConfig()

    return `${this.baseUrl}/o/oauth2/v2/auth?${new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUrl,
      scope: scopes.join(' '),
      state,
      response_type: 'code',
      access_type: 'offline',
      prompt: 'consent',
      ...this.parameters,
    }).toString()}`
  }

  /**
   * Get the access token from Google using the authorization code.
   */
  public async getAccessToken(code: string): Promise<string> {
    const { clientId, clientSecret, redirectUrl } = this.getConfig()
    this.validateConfig()

    const response = await fetcher
      .post<GoogleTokenResponse>(this.tokenUrl, {
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUrl,
        grant_type: 'authorization_code',
      })

    if (response.data.error) {
      throw new Error(`Google OAuth error: ${response.data.error_description}`)
    }

    return response.data.access_token
  }

  /**
   * Get the user details from Google using the access token.
   * Maps the Google-specific user data to our normalized SocialUser type.
   *
   * The audience is checked first. `/userinfo` answers for an access token
   * issued to *any* client, so without that check a token minted by the
   * attacker's own OAuth app resolves to whichever Google account they chose:
   * the classic confused deputy (stacksjs/stacks#2907). Nothing in the token
   * itself says who it was for, which is why it takes a round trip.
   *
   * Prefer {@link getUserByIdToken} where an id_token is available. It
   * carries its own audience and its own signature, so it settles the same
   * question without the extra request.
   */
  public async getUserByToken(token: string): Promise<SocialUser> {
    await this.assertTokenWasIssuedToUs(token)

    const response = await fetcher
      .withHeaders({
        Authorization: `Bearer ${token}`,
      })
      .get<GoogleUser>(`${this.apiUrl}/oauth2/v2/userinfo`)

    return {
      id: response.data.id,
      nickname: response.data.given_name,
      name: response.data.name,
      email: response.data.email,
      emailVerified: typeof response.data.verified_email === 'boolean' ? response.data.verified_email : null,
      avatar: response.data.picture,
      token,
      raw: response.data,
    }
  }

  /**
   * Build a SocialUser from an id_token, verified against Google's keys.
   *
   * This is the method a native sign-in should reach for: `GoogleSignIn` on a
   * phone yields an id_token, and unlike an access token it proves both who
   * the user is and which client it was minted for, without trusting the app
   * that handed it over.
   */
  public async getUserByIdToken(idToken: string, options: { nonce?: string } = {}): Promise<SocialUser> {
    const { clientId } = this.getConfig()

    let claims: Record<string, unknown>
    try {
      claims = await verifyIdToken(idToken, {
        jwksUrl: this.certsUrl,
        issuer: this.issuers,
        audience: clientId,
        nonce: options.nonce,
      })
    }
    catch (error) {
      throw new Error(`Google OAuth error: ${error instanceof Error ? error.message : String(error)}`)
    }

    const email = typeof claims.email === 'string' ? claims.email : ''

    return {
      id: String(claims.sub),
      nickname: typeof claims.given_name === 'string' ? claims.given_name : null,
      name: typeof claims.name === 'string' ? claims.name : '',
      email,
      emailVerified: typeof claims.email_verified === 'boolean'
        ? claims.email_verified
        : claims.email_verified === 'true' ? true : claims.email_verified === 'false' ? false : null,
      avatar: typeof claims.picture === 'string' ? claims.picture : null,
      token: idToken,
      raw: claims,
    }
  }

  /**
   * Refuse an access token that was not minted for this client.
   *
   * `tokeninfo` reports the audience under `aud`; the endpoint this replaced
   * called it `audience`, and tokens in flight during that change still see
   * the old name, so both are read.
   */
  protected async assertTokenWasIssuedToUs(accessToken: string): Promise<void> {
    const { clientId } = this.getConfig()

    const response = await fetch(`${this.tokenInfoUrl}?access_token=${encodeURIComponent(accessToken)}`)
    if (!response.ok)
      throw new Error(`Google OAuth error: access token was not accepted by tokeninfo (HTTP ${response.status})`)

    const info = await response.json() as { aud?: string, audience?: string, error?: string, error_description?: string }
    if (info.error)
      throw new Error(`Google OAuth error: ${info.error_description ?? info.error}`)

    const audience = info.aud ?? info.audience
    if (!audience)
      throw new Error('Google OAuth error: tokeninfo did not report an audience for the access token')

    if (audience !== clientId)
      throw new Error('Google OAuth error: access token was issued to a different client')
  }

  /**
   * Validate the provider configuration.
   */
  protected validateConfig(): void {
    const { clientId, clientSecret, redirectUrl } = this.getConfig()

    if (!clientId)
      throw new ConfigException('Google client ID not provided')

    if (!clientSecret)
      throw new ConfigException('Google client secret not provided')

    if (!redirectUrl)
      throw new ConfigException('Google redirect URL not provided')
  }

  protected getTokenUrl(): string {
    return this.tokenUrl
  }
}
