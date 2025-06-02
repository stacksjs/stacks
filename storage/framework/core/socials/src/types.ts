/**
 * Normalized user type that all providers will map their responses to.
 * This ensures a consistent user structure regardless of the provider used.
 */
export interface SocialUser {
  id: string
  nickname: string | null
  name: string | null
  email: string | null
  avatar: string | null
  token: string
  raw: Record<string, any>
}

/**
 * GitHub-specific user type from their API response
 */
export interface GitHubUser {
  id: number
  login: string
  name: string | null
  avatar_url: string | null
  [key: string]: any
}

/**
 * GitHub-specific email type from their API response
 */
export interface GitHubEmail {
  email: string
  primary: boolean
  verified: boolean
}

/**
 * GitHub-specific OAuth token response
 */
export interface GitHubTokenResponse {
  access_token: string
  error?: string
  error_description?: string
}

export interface ProviderInterface {
  getAuthUrl: () => Promise<string>
  getAccessToken: (code: string) => Promise<string>
  getUserByToken: (token: string) => Promise<SocialUser>
}

export abstract class AbstractProvider implements ProviderInterface {
  /**
   * Generate a random state string to prevent CSRF attacks.
   */
  protected getState(): string {
    const bytes = new Uint8Array(16)
    crypto.getRandomValues(bytes)
    return Array.from(bytes)
      .map(byte => byte.toString(16).padStart(2, '0'))
      .join('')
  }

  abstract getAuthUrl(): Promise<string>
  abstract getAccessToken(code: string): Promise<string>
  abstract getUserByToken(token: string): Promise<SocialUser>
}

export class ConfigException extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ConfigException'
  }
}


export interface TwitterTokenResponse {
  access_token: string
  token_type: string
  expires_in: number
  scope: string
  refresh_token?: string
  error?: string
  error_description?: string
}

export interface TwitterUser {
  id: string
  name: string
  username: string
  profile_image_url: string
  email?: string
}
