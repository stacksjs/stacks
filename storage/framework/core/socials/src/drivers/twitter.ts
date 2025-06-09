import type { ProviderInterface, SocialUser, TwitterTokenResponse, TwitterUser } from '../types'
import { Buffer } from 'node:buffer'
import { createHash, randomBytes } from 'node:crypto'
import { fetcher } from '@stacksjs/api'
import { config } from '@stacksjs/config'
import { AbstractProvider } from '../abstract'
import { ConfigException } from '../exceptions'

export class TwitterProvider extends AbstractProvider implements ProviderInterface {
  protected baseUrl = 'https://twitter.com'
  protected apiUrl = 'https://api.twitter.com'
  private codeVerifier: string | null = null

  private getConfig() {
    const providerConfig = {
      clientId: config.services.twitter?.clientId ?? '',
      clientSecret: config.services.twitter?.clientSecret ?? '',
      redirectUrl: config.services.twitter?.redirectUrl ?? '',
      scopes: config.services.twitter?.scopes ?? ['users.read', 'tweet.read'],
    }
    this.setScopes(providerConfig.scopes)
    return providerConfig
  }

  /**
   * Generate a code verifier for PKCE.
   */
  private generateCodeVerifier(): string {
    return randomBytes(32)
      .toString('base64')
      .replace(/[^a-z0-9]/gi, '')
      .substring(0, 128)
  }

  /**
   * Generate a code challenge from the code verifier.
   */
  private generateCodeChallenge(codeVerifier: string): string {
    return createHash('sha256')
      .update(codeVerifier)
      .digest('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '')
  }

  /**
   * Get the authentication URL for Twitter.
   */
  public async getAuthUrl(): Promise<string> {
    const state = this.getState()
    const { clientId, redirectUrl, scopes } = this.getConfig()
    this.validateConfig()

    // Generate and store PKCE values
    this.codeVerifier = this.generateCodeVerifier()
    const codeChallenge = this.generateCodeChallenge(this.codeVerifier)

    return `${this.baseUrl}/i/oauth2/authorize?${new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUrl,
      scope: scopes.join(' '),
      state,
      response_type: 'code',
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    }).toString()}`
  }

  /**
   * Get the access token from Twitter using the authorization code.
   */
  public async getAccessToken(code: string): Promise<string> {
    const { clientId, clientSecret, redirectUrl } = this.getConfig()
    this.validateConfig()

    if (!this.codeVerifier) {
      throw new Error('Code verifier not found. Please ensure getAuthUrl() is called first.')
    }

    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

    const response = await fetcher
      .withHeaders({
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      })
      .post<TwitterTokenResponse>(`${this.apiUrl}/2/oauth2/token`, {
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUrl,
        code_verifier: this.codeVerifier,
      })

    if (response.data.error) {
      throw new Error(`Twitter OAuth error: ${response.data.error_description}`)
    }

    return response.data.access_token
  }

  /**
   * Get the user details from Twitter using the access token.
   * Maps the Twitter-specific user data to our normalized SocialUser type.
   */
  public async getUserByToken(token: string): Promise<SocialUser> {
    const response = await fetcher
      .withHeaders({
        Authorization: `Bearer ${token}`,
      })
      .get<TwitterUser>(`${this.apiUrl}/2/users/me?user.fields=profile_image_url`)

    return {
      id: response.data.id,
      nickname: response.data.username,
      name: response.data.name,
      email: response.data.email ?? null,
      avatar: response.data.profile_image_url ?? null,
      token,
      raw: response.data,
    }
  }

  /**
   * Validate the provider configuration.
   */
  protected validateConfig(): void {
    const { clientId, clientSecret, redirectUrl } = this.getConfig()

    if (!clientId)
      throw new ConfigException('Twitter client ID not provided')

    if (!clientSecret)
      throw new ConfigException('Twitter client secret not provided')

    if (!redirectUrl)
      throw new ConfigException('Twitter redirect URL not provided')
  }

  protected getTokenUrl(): string {
    return `${this.apiUrl}/2/oauth2/token`
  }
}
