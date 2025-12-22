/**
 * OAuth & Token Types
 *
 * Comprehensive type definitions for OAuth 2.0 authentication,
 * personal access tokens, and related functionality.
 *
 * This module provides type-safe interfaces for:
 * - Access tokens (JWT-like tokens for API authentication)
 * - Refresh tokens (for obtaining new access tokens)
 * - OAuth clients (applications authorized to request tokens)
 * - Database row types (for raw database queries)
 * - Token creation and validation results
 */

// ============================================================================
// BRANDED TYPES
// ============================================================================

/**
 * Branded type for authentication tokens.
 * Using a branded type ensures tokens are not accidentally confused with regular strings.
 *
 * @example
 * ```typescript
 * const token: AuthToken = 'abc123' as AuthToken
 * // or use createAuthToken helper
 * ```
 */
export type AuthToken = string & { readonly __brand: 'AuthToken' }

/**
 * Branded type for refresh tokens.
 * Distinct from AuthToken to prevent accidental misuse.
 */
export type RefreshTokenString = string & { readonly __brand: 'RefreshToken' }

/**
 * Branded type for OAuth client secrets.
 */
export type ClientSecret = string & { readonly __brand: 'ClientSecret' }

/**
 * Branded type for hashed token values stored in database.
 */
export type HashedToken = string & { readonly __brand: 'HashedToken' }

// ============================================================================
// TOKEN SCOPE TYPES
// ============================================================================

/**
 * Common OAuth scopes/abilities.
 * Use these predefined scopes or define custom ones.
 */
export type CommonScope =
  | '*' // Wildcard - all permissions
  | 'read'
  | 'write'
  | 'delete'
  | 'admin'
  | 'user:read'
  | 'user:write'
  | 'posts:read'
  | 'posts:write'
  | 'posts:delete'

/**
 * Token scope - can be common scopes or custom string scopes.
 */
export type TokenScope = CommonScope | (string & {})

/**
 * Array of token scopes/abilities.
 */
export type TokenScopes = TokenScope[]

// ============================================================================
// ACCESS TOKEN TYPES
// ============================================================================

/**
 * Access token entity with full metadata.
 * Represents a token after being retrieved from the database.
 */
export interface AccessToken {
  /** Unique token identifier */
  readonly id: number
  /** ID of the user this token belongs to */
  readonly userId: number
  /** ID of the OAuth client that issued this token */
  readonly clientId: number
  /** Human-readable name for the token */
  readonly name: string
  /** Array of scopes/abilities granted to this token */
  readonly scopes: TokenScopes
  /** Whether the token has been revoked */
  readonly revoked: boolean
  /** When the token expires (null = never expires) */
  readonly expiresAt: Date | null
  /** When the token was created */
  readonly createdAt: Date
  /** When the token was last updated */
  readonly updatedAt: Date
}

/**
 * Personal access token with additional metadata.
 * Extended version used in the Auth class.
 */
export interface PersonalAccessToken extends AccessToken {
  /** Abilities is an alias for scopes */
  readonly abilities: TokenScopes
  /** The plain text token (only available immediately after creation) */
  readonly plainTextToken?: AuthToken
}

/**
 * Mutable version of AccessToken for internal use.
 */
export interface MutableAccessToken {
  id: number
  userId: number
  clientId: number
  name: string
  scopes: TokenScopes
  revoked: boolean
  expiresAt: Date | null
  createdAt: Date
  updatedAt: Date
}

// ============================================================================
// REFRESH TOKEN TYPES
// ============================================================================

/**
 * Refresh token entity for obtaining new access tokens.
 */
export interface RefreshToken {
  /** Unique refresh token identifier */
  readonly id: number
  /** ID of the associated access token */
  readonly accessTokenId: number
  /** Whether the refresh token has been revoked */
  readonly revoked: boolean
  /** When the refresh token expires */
  readonly expiresAt: Date | null
  /** When the refresh token was created */
  readonly createdAt: Date
}

// ============================================================================
// OAUTH CLIENT TYPES
// ============================================================================

/**
 * OAuth client types for different authentication flows.
 */
export type OAuthClientType = 'personal_access' | 'password' | 'authorization_code' | 'client_credentials'

/**
 * OAuth client entity representing an authorized application.
 */
export interface OAuthClient {
  /** Unique client identifier */
  readonly id: number
  /** Client name */
  readonly name: string
  /** Client secret (hashed in database) */
  readonly secret: ClientSecret | string
  /** Authentication provider */
  readonly provider: string | null
  /** OAuth redirect URI */
  readonly redirect: string
  /** Whether this is a personal access client */
  readonly personalAccessClient: boolean
  /** Whether this is a password grant client */
  readonly passwordClient: boolean
  /** Whether the client has been revoked */
  readonly revoked: boolean
  /** When the client was created */
  readonly createdAt: Date
  /** When the client was last updated */
  readonly updatedAt: Date | null
}

// ============================================================================
// DATABASE ROW TYPES
// ============================================================================

/**
 * Raw database row for oauth_access_tokens table.
 * Use this when working with raw SQL queries.
 */
export interface OAuthAccessTokenRow {
  id: number
  user_id: number
  oauth_client_id: number
  token: string
  name: string | null
  scopes: string | null
  revoked: boolean | number
  expires_at: string | null
  created_at: string | null
  updated_at: string | null
}

/**
 * Raw database row for oauth_refresh_tokens table.
 */
export interface OAuthRefreshTokenRow {
  id: number
  access_token_id: number
  token: string
  revoked: boolean | number
  expires_at: string | null
  created_at: string | null
}

/**
 * Raw database row for oauth_clients table.
 */
export interface OAuthClientRow {
  id: number
  name: string
  secret: string
  provider: string | null
  redirect: string
  personal_access_client: boolean | number
  password_client: boolean | number
  revoked: boolean | number
  created_at: string | null
  updated_at: string | null
}

// ============================================================================
// TOKEN CREATION TYPES
// ============================================================================

/**
 * Options for creating a new token.
 */
export interface TokenCreateOptions {
  /** Human-readable name for the token */
  name?: string
  /** Scopes/abilities to grant to the token */
  abilities?: TokenScopes
  /** Alternative name for abilities */
  scopes?: TokenScopes
  /** When the token should expire */
  expiresAt?: Date
  /** Token expiry in minutes (alternative to expiresAt) */
  expiresInMinutes?: number
  /** Whether to create a refresh token */
  withRefreshToken?: boolean
  /** Refresh token expiry in days */
  refreshExpiresInDays?: number
}

/**
 * Result returned when creating a personal access token.
 */
export interface PersonalAccessTokenResult {
  /** The created access token entity */
  readonly accessToken: AccessToken
  /** The plain text token - SAVE THIS, it won't be shown again */
  readonly plainTextToken: AuthToken | string
  /** The plain text refresh token (if requested) */
  readonly refreshToken?: RefreshTokenString | string
  /** Token expiry in seconds (for OAuth2 compatibility) */
  readonly expiresIn: number
}

/**
 * Result returned when creating a token via the Auth class.
 */
export interface NewAccessToken {
  /** The created access token entity */
  readonly accessToken: PersonalAccessToken
  /** The plain text token */
  readonly plainTextToken: AuthToken
}

/**
 * Result returned when refreshing a token.
 */
export interface RefreshTokenResult {
  /** The new access token entity */
  readonly accessToken: AccessToken
  /** The new plain text access token */
  readonly plainTextToken: AuthToken | string
  /** The new plain text refresh token */
  readonly refreshToken: RefreshTokenString | string
  /** Token expiry in seconds */
  readonly expiresIn: number
}

// ============================================================================
// OAUTH CLIENT CREATION TYPES
// ============================================================================

/**
 * Options for creating a new OAuth client.
 */
export interface CreateClientOptions {
  /** Client name */
  name: string
  /** OAuth redirect URI */
  redirect: string
  /** User ID who owns this client */
  userId?: number
  /** Whether this is a personal access client */
  personalAccessClient?: boolean
  /** Whether this is a password grant client */
  passwordClient?: boolean
  /** Authentication provider */
  provider?: string
}

/**
 * Result returned when creating a new OAuth client.
 */
export interface CreateClientResult {
  /** The created client entity */
  readonly client: OAuthClient
  /** The plain text client secret - SAVE THIS, it won't be shown again */
  readonly plainTextSecret: ClientSecret | string
}

// ============================================================================
// TOKEN VALIDATION TYPES
// ============================================================================

/**
 * Result of token validation.
 */
export interface TokenValidationResult {
  /** Whether the token is valid */
  readonly valid: boolean
  /** The access token if valid */
  readonly token?: AccessToken
  /** Error message if invalid */
  readonly error?: string
  /** Whether the token was rotated */
  readonly rotated?: boolean
  /** New token if rotated */
  readonly newToken?: AuthToken
}

/**
 * Token payload extracted from JWT-like tokens.
 */
export interface TokenPayload {
  /** Subject (user ID) */
  readonly sub: number
  /** Issued at timestamp */
  readonly iat: number
  /** Expiration timestamp */
  readonly exp: number
  /** JWT ID */
  readonly jti: string
}

// ============================================================================
// AUTHENTICATION CREDENTIALS
// ============================================================================

/**
 * User credentials for authentication.
 */
export interface AuthCredentials {
  /** User's email address */
  email?: string
  /** User's password */
  password?: string
  /** Additional credential fields (for custom auth) */
  [key: string]: string | undefined
}

/**
 * Login result containing user and token.
 */
export interface LoginResult<TUser = unknown> {
  /** The authenticated user */
  readonly user: TUser
  /** The authentication token */
  readonly token: AuthToken
}

// ============================================================================
// DATABASE DRIVER TYPES
// ============================================================================

/**
 * Supported database drivers for OAuth tables.
 */
export type DatabaseDriver = 'postgres' | 'mysql' | 'sqlite'

/**
 * SQL syntax configuration based on database driver.
 */
export interface DatabaseSqlSyntax {
  /** Current timestamp function */
  readonly now: string
  /** Boolean true value */
  readonly boolTrue: string
  /** Boolean false value */
  readonly boolFalse: string
  /** Auto-increment keyword */
  readonly autoIncrement: string
  /** Primary key syntax */
  readonly primaryKey: string
  /** Parameter placeholder function */
  readonly param: (index: number) => string
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Type guard to check if a value is an AccessToken.
 */
export function isAccessToken(value: unknown): value is AccessToken {
  return (
    typeof value === 'object'
    && value !== null
    && 'id' in value
    && 'userId' in value
    && 'clientId' in value
    && 'scopes' in value
  )
}

/**
 * Type guard to check if a value is a PersonalAccessToken.
 */
export function isPersonalAccessToken(value: unknown): value is PersonalAccessToken {
  return isAccessToken(value) && 'abilities' in value
}

/**
 * Type guard to check if a value is an OAuthClient.
 */
export function isOAuthClient(value: unknown): value is OAuthClient {
  return (
    typeof value === 'object'
    && value !== null
    && 'id' in value
    && 'name' in value
    && 'secret' in value
    && 'redirect' in value
  )
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Make specific properties of a type optional.
 */
export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>

/**
 * Make specific properties of a type required.
 */
export type RequiredBy<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>

/**
 * Extract the user type from a generic context.
 */
export type ExtractUser<T> = T extends { user: infer U } ? U : never

/**
 * Token with user attached.
 */
export interface TokenWithUser<TUser = unknown> extends AccessToken {
  readonly user: TUser
}
