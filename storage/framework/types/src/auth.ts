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
  tokenRotation: number
  defaultAbilities: string[]
  defaultTokenName: string
}
