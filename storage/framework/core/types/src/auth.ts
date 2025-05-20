export interface AuthOptions {
  /**
   * The default authentication guard to use
   */
  default: string

  /**
   * The authentication guards available
   */
  guards: {
    [key: string]: {
      /**
       * The authentication driver to use
       */
      driver: 'session' | 'token'

      /**
       * The authentication provider to use
       */
      provider: string
    }
  }

  /**
   * The authentication providers available
   */
  providers: {
    [key: string]: {
      /**
       * The database driver to use
       */
      driver: 'database'

      /**
       * The database table to use
       */
      table: string
    }
  }

  /**
   * The username field used for authentication
   */
  username: string

  /**
   * The password field used for authentication
   */
  password: string

  /**
   * The token expiry time in milliseconds
   */
  tokenExpiry: number

  /**
   * The token rotation time in hours
   */
  tokenRotation: number

  /**
   * The token abilities that are granted by default
   */
  defaultAbilities: string[]

  /**
   * The token name used when creating new tokens
   */
  defaultTokenName: string
}

export type AuthConfig = Partial<AuthOptions>

export interface AuthInstance {
  guard: string
  provider: string
  user?: any
  token?: string
}

export type GuardType = 'session' | 'token'
export type ProviderType = 'database'

export interface AuthDriver {
  attempt: (credentials: any) => Promise<boolean>
  validate: (token: string) => Promise<boolean>
  login: (credentials: any) => Promise<{ token: string } | null>
  logout: () => Promise<void>
  user: () => Promise<any>
  token: () => string | null
}

export interface Authenticatable {
  getAuthIdentifier: () => any
  getAuthPassword: () => string
  getRememberToken: () => string
  setRememberToken: (token: string) => void
}
