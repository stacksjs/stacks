/**
 * Normalized user type that all providers will map their responses to.
 * This ensures a consistent user structure regardless of the provider used.
 */
export interface SocialUser {
  id: string
  nickname: string | null
  name: string
  email: string | null
  avatar: string | null
  token: string
  raw?: any
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

export interface TwitterTokenResponse {
  access_token: string
  token_type: string
  expires_in: number
  scope: string
  error?: string
  error_description?: string
}

export interface TwitterUser {
  id: string
  username: string
  name: string
  email?: string
  profile_image_url?: string
}
