import type { GitHubEmail, GitHubTokenResponse, GitHubUser, ProviderInterface, SocialUser } from '../types'
import { fetcher } from '@stacksjs/api'
import { config } from '@stacksjs/config'
import { AbstractProvider } from '../abstract'
import { ConfigException } from '../exceptions'

export class GitHubProvider extends AbstractProvider implements ProviderInterface {
  protected baseUrl = 'https://github.com'
  protected apiUrl = 'https://api.github.com'

  private getConfig() {
    const providerConfig = {
      clientId: config.services.github?.clientId ?? '',
      clientSecret: config.services.github?.clientSecret ?? '',
      redirectUrl: config.services.github?.redirectUrl ?? '',
      scopes: config.services.github?.scopes ?? ['read:user', 'user:email'],
    }
    this.setScopes(providerConfig.scopes)
    return providerConfig
  }

  /**
   * Get the authentication URL for GitHub.
   */
  public async getAuthUrl(): Promise<string> {
    const state = this.getState()
    const { clientId, redirectUrl, scopes } = this.getConfig()
    this.validateConfig()

    return `${this.baseUrl}/login/oauth/authorize?${new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUrl,
      scope: scopes.join(' '),
      state,
      response_type: 'code',
    }).toString()}`
  }

  /**
   * Get the access token from GitHub using the authorization code.
   */
  public async getAccessToken(code: string): Promise<string> {
    const { clientId, clientSecret, redirectUrl } = this.getConfig()
    this.validateConfig()

    const response = await fetcher
      .post<GitHubTokenResponse>(`${this.baseUrl}/login/oauth/access_token`, {
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUrl,
      })

    if (response.data.error) {
      throw new Error(`GitHub OAuth error: ${response.data.error_description}`)
    }

    return response.data.access_token
  }

  /**
   * Get the user details from GitHub using the access token.
   * Maps the GitHub-specific user data to our normalized SocialiteUser type.
   */
  public async getUserByToken(token: string): Promise<SocialUser> {
    const [userResponse, emailsResponse] = await Promise.all([
      fetcher
        .withHeaders({
          Accept: 'application/vnd.github.v3+json',
          Authorization: `token ${token}`,
        })
        .get<GitHubUser>(`${this.apiUrl}/user`),

      fetcher
        .withHeaders({
          Accept: 'application/vnd.github.v3+json',
          Authorization: `token ${token}`,
        })
        .get<GitHubEmail[]>(`${this.apiUrl}/user/emails`),
    ])

    return {
      id: userResponse.data.id.toString(),
      nickname: userResponse.data.login,
      name: userResponse.data.name,
      email: this.getEmail(emailsResponse.data),
      avatar: userResponse.data.avatar_url,
      token,
      raw: userResponse.data,
    }
  }

  /**
   * Get the primary email from the list of emails.
   */
  protected getEmail(emails: GitHubEmail[]): string | null {
    const primaryEmail = emails.find(email => email.primary)
    const verifiedEmail = emails.find(email => email.verified)

    return (primaryEmail || verifiedEmail || emails[0])?.email ?? null
  }

  /**
   * Validate the provider configuration.
   */
  protected validateConfig(): void {
    const { clientId, clientSecret, redirectUrl } = this.getConfig()

    if (!clientId)
      throw new ConfigException('GitHub client ID not provided')

    if (!clientSecret)
      throw new ConfigException('GitHub client secret not provided')

    if (!redirectUrl)
      throw new ConfigException('GitHub redirect URL not provided')
  }

  protected getTokenUrl(): string {
    return `${this.baseUrl}/login/oauth/access_token`
  }
}
