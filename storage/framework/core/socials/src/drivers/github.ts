import type { GitHubEmail, GitHubTokenResponse, GitHubUser, ProviderInterface, SocialUser } from '../types'
import { config } from '@stacksjs/config'
import { AbstractProvider, ConfigException } from '../types'

export class GitHubProvider extends AbstractProvider implements ProviderInterface {
  protected baseUrl = 'https://github.com'
  protected apiUrl = 'https://api.github.com'
  private clientId: string | null = null
  private clientSecret: string | null = null
  private redirectUrl: string | null = null
  private scopes: string[] | null = null

  private getConfig() {
    if (!this.clientId || !this.clientSecret || !this.redirectUrl || !this.scopes) {
      this.clientId = config.services.github?.clientId ?? ''
      this.clientSecret = config.services.github?.clientSecret ?? ''
      this.redirectUrl = config.services.github?.redirectUrl ?? ''
      this.scopes = config.services.github?.scopes ?? ['read:user', 'user:email']
    }

    return {
      clientId: this.clientId,
      clientSecret: this.clientSecret,
      redirectUrl: this.redirectUrl,
      scopes: this.scopes,
    }
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

    const response = await fetch(`${this.baseUrl}/login/oauth/access_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUrl,
      }),
    })

    const data = await response.json() as GitHubTokenResponse

    if (data.error) {
      throw new Error(`GitHub OAuth error: ${data.error_description}`)
    }

    return data.access_token
  }

  /**
   * Get the user details from GitHub using the access token.
   * Maps the GitHub-specific user data to our normalized SocialiteUser type.
   */
  public async getUserByToken(token: string): Promise<SocialUser> {
    const [userResponse, emailsResponse] = await Promise.all([
      fetch(`${this.apiUrl}/user`, {
        headers: {
          Accept: 'application/vnd.github.v3+json',
          Authorization: `token ${token}`,
        },
      }),
      fetch(`${this.apiUrl}/user/emails`, {
        headers: {
          Accept: 'application/vnd.github.v3+json',
          Authorization: `token ${token}`,
        },
      }),
    ])

    const user = await userResponse.json() as GitHubUser
    const emails = await emailsResponse.json() as GitHubEmail[]

    return {
      id: user.id.toString(),
      nickname: user.login,
      name: user.name,
      email: this.getEmail(emails),
      avatar: user.avatar_url,
      token,
      raw: user,
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
}
