import type { ProviderInterface, SocialUser } from '../types'
import { fetcher } from '@stacksjs/api'
import { config } from '@stacksjs/config'
import { AbstractProvider } from '../abstract'
import { ConfigException } from '../exceptions'

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

  private getConfig() {
    const providerConfig = {
      clientId: config.services.google?.clientId ?? '',
      clientSecret: config.services.google?.clientSecret ?? '',
      redirectUrl: config.services.google?.redirectUrl ?? '',
      scopes: config.services.google?.scopes ?? [
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/userinfo.email',
      ],
    }

    this.setScopes(providerConfig.scopes)
    return providerConfig
  }

  /**
   * Get the authentication URL for Google.
   */
  public async getAuthUrl(): Promise<string> {
    const state = this.getState()
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
    }).toString()}`
  }

  /**
   * Get the access token from Google using the authorization code.
   */
  public async getAccessToken(code: string): Promise<string> {
    const { clientId, clientSecret, redirectUrl } = this.getConfig()
    this.validateConfig()

    const response = await fetcher
      .post<GoogleTokenResponse>(`${this.baseUrl}/oauth2/v4/token`, {
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
   */
  public async getUserByToken(token: string): Promise<SocialUser> {
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
      avatar: response.data.picture,
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
      throw new ConfigException('Google client ID not provided')

    if (!clientSecret)
      throw new ConfigException('Google client secret not provided')

    if (!redirectUrl)
      throw new ConfigException('Google redirect URL not provided')
  }

  protected getTokenUrl(): string {
    return `${this.baseUrl}/oauth2/v4/token`
  }
}
