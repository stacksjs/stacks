export interface AuthGuard {
  driver: 'session' | 'token'
  provider: string
}

export interface AuthProvider {
  driver: 'database'
  table: string
}

export interface AuthConfig {
  default: string
  guards: {
    [key: string]: AuthGuard
  }
  providers: {
    [key: string]: AuthProvider
  }
  username: string
  password: string
  tokenExpiry: number
  /** @deprecated Use explicit bearer rotation or a refresh-token exchange. */
  tokenRotation?: number
  defaultAbilities: string[]
  defaultTokenName: string
}
