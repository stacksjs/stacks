import type { GitHubEmail, GitHubTokenResponse, GitHubUser, ProviderInterface, SocialUser } from '../types'
import { fetcher } from '@stacksjs/api'
import { config } from '@stacksjs/config'
import { AbstractProvider } from '../abstract'
import { ConfigException } from '../exceptions'

export class GitHubProvider extends AbstractProvider implements ProviderInterface {
  protected baseUrl = 'https://github.com'
  protected apiUrl = 'https://api.github.com'

  private getConfig() {
    // Instance values (constructor args or set*() calls) win over the
    // global config — otherwise setRedirectUrl()/setScopes() are
    // silently ignored, which breaks per-request redirect URIs.
    const providerConfig = {
      clientId: this.clientId || (config.services.github?.clientId ?? ''),
      clientSecret: this.clientSecret || (config.services.github?.clientSecret ?? ''),
      redirectUrl: this.redirectUrl || (config.services.github?.redirectUrl ?? ''),
      scopes: this._scopes.length > 0
        ? this._scopes
        : (config.services.github?.scopes ?? ['read:user', 'user:email']),
    }
    this.setScopes(providerConfig.scopes)
    return providerConfig
  }

  /**
   * Get the authentication URL for GitHub.
   */
  public async getAuthUrl(): Promise<string> {
    const state = this.resolveState()
    const { clientId, redirectUrl, scopes } = this.getConfig()
    this.validateConfig()

    return `${this.baseUrl}/login/oauth/authorize?${new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUrl,
      scope: scopes.join(' '),
      state,
      response_type: 'code',
      ...this.parameters,
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

    // Fall back to the public profile email when /user/emails returns
    // nothing — that endpoint can be empty (no `user:email` scope, or
    // the user hides every address). The profile's email field, when
    // present, is the publicly-listed one which is fine for sign-up,
    // but its verified status is unknown.
    const picked = this.pickEmail(emailsResponse.data)

    return {
      id: userResponse.data.id.toString(),
      nickname: userResponse.data.login,
      name: userResponse.data.name ?? userResponse.data.login,
      email: picked?.email ?? userResponse.data.email ?? null,
      emailVerified: picked ? picked.verified : null,
      avatar: userResponse.data.avatar_url,
      token,
      raw: userResponse.data,
    }
  }

  /**
   * Pick the best email from the list of emails.
   *
   * Order of preference: primary AND verified > verified > primary > first.
   * Verifiedness matters for security — using an unverified email lets
   * an attacker register it on GitHub and then impersonate the owner
   * via "sign in with GitHub".
   */
  protected pickEmail(emails: GitHubEmail[]): GitHubEmail | null {
    if (!Array.isArray(emails) || emails.length === 0) return null
    const primaryAndVerified = emails.find(e => e.primary && e.verified)
    const verified = emails.find(e => e.verified)
    return primaryAndVerified ?? verified ?? emails.find(e => e.primary) ?? emails[0] ?? null
  }

  /**
   * Get the primary email from the list of emails (see pickEmail).
   */
  protected getEmail(emails: GitHubEmail[]): string | null {
    return this.pickEmail(emails)?.email ?? null
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
