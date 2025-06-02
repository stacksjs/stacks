import type { ProviderInterface, SocialUser } from '../types'
import { fetcher } from '@stacksjs/api'
import { config } from '@stacksjs/config'
import { AbstractProvider } from '../abstract'
import { ConfigException } from '../exceptions'

interface FacebookTokenResponse {
  access_token: string
  token_type: string
  expires_in: number
  error?: {
    message: string
    type: string
    code: number
  }
}

interface FacebookUser {
  id: string
  email?: string
  name: string
  picture?: {
    data: {
      url: string
    }
  }
}

export class FacebookProvider extends AbstractProvider implements ProviderInterface {
  protected baseUrl = 'https://www.facebook.com'
  protected apiUrl = 'https://graph.facebook.com'

  private getConfig() {
    const providerConfig = {
      clientId: config.services.facebook?.clientId ?? '',
      clientSecret: config.services.facebook?.clientSecret ?? '',
      redirectUrl: config.services.facebook?.redirectUrl ?? '',
      scopes: config.services.facebook?.scopes ?? ['email', 'public_profile'],
    }
    this.setScopes(providerConfig.scopes)
    return providerConfig
  }

  /**
   * Get the authentication URL for Facebook.
   */
  public async getAuthUrl(): Promise<string> {
    const state = this.getState()
    const { clientId, redirectUrl, scopes } = this.getConfig()
    this.validateConfig()

    return `${this.baseUrl}/v18.0/dialog/oauth?${new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUrl,
      scope: scopes.join(','),
      state,
      response_type: 'code',
    }).toString()}`
  }

  /**
   * Get the access token from Facebook using the authorization code.
   */
  public async getAccessToken(code: string): Promise<string> {
    const { clientId, clientSecret, redirectUrl } = this.getConfig()
    this.validateConfig()

    const response = await fetcher
      .get<FacebookTokenResponse>(`${this.apiUrl}/v18.0/oauth/access_token?${new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUrl,
        code,
      }).toString()}`)

    if (response.data.error) {
      throw new Error(`Facebook OAuth error: ${response.data.error.message}`)
    }

    return response.data.access_token
  }

  /**
   * Get the user details from Facebook using the access token.
   * Maps the Facebook-specific user data to our normalized SocialUser type.
   */
  public async getUserByToken(token: string): Promise<SocialUser> {
    const response = await fetcher
      .get<FacebookUser>(`${this.apiUrl}/v18.0/me?${new URLSearchParams({
        access_token: token,
        fields: 'id,name,email,picture',
      }).toString()}`)

    return {
      id: response.data.id,
      nickname: null,
      name: response.data.name,
      email: response.data.email ?? null,
      avatar: response.data.picture?.data.url ?? null,
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
      throw new ConfigException('Facebook client ID not provided')

    if (!clientSecret)
      throw new ConfigException('Facebook client secret not provided')

    if (!redirectUrl)
      throw new ConfigException('Facebook redirect URL not provided')
  }

  protected getTokenUrl(): string {
    return `${this.apiUrl}/v18.0/oauth/access_token`
  }
}
