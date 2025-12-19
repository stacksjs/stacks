/**
 * Token Functions - Passport-style token management
 *
 * Standalone functions that can be imported and used anywhere.
 * These replicate Laravel Passport's HasApiTokens trait functionality.
 *
 * Features:
 * - Token hashing (SHA-256) for secure storage
 * - Refresh tokens for token renewal without re-authentication
 */

import type { UserModel } from '@stacksjs/orm'
import process from 'node:process'
import { createHash, randomBytes } from 'node:crypto'
import { db } from '@stacksjs/database'
import { HttpError } from '@stacksjs/error-handling'
import { getCurrentRequest } from '@stacksjs/router'

// Detect database driver from environment
const envVars = typeof Bun !== 'undefined' ? Bun.env : process.env
const dbDriver = envVars.DB_CONNECTION || 'sqlite'
const isPostgres = dbDriver === 'postgres'

// SQL syntax helpers for cross-database compatibility
const now = isPostgres ? 'NOW()' : "datetime('now')"
const boolTrue = isPostgres ? 'true' : '1'
const boolFalse = isPostgres ? 'false' : '0'

// Parameter placeholder helper for cross-database compatibility
function params(...values: any[]): { sql: string, values: any[] } {
  if (isPostgres) {
    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ')
    return { sql: placeholders, values }
  }
  const placeholders = values.map(() => '?').join(', ')
  return { sql: placeholders, values }
}

// Helper to create a single parameter placeholder
function param(index: number): string {
  return isPostgres ? `$${index}` : '?'
}

// ============================================================================
// TYPES
// ============================================================================

/**
 * Access token with scope checking capabilities
 */
export interface AccessToken {
  id: number
  userId: number
  clientId: number
  name: string
  scopes: string[]
  revoked: boolean
  expiresAt: Date | null
  createdAt: Date
  updatedAt: Date
}

/**
 * Refresh token for obtaining new access tokens
 */
export interface RefreshToken {
  id: number
  accessTokenId: number
  revoked: boolean
  expiresAt: Date | null
  createdAt: Date
}

/**
 * Result returned when creating a personal access token
 */
export interface PersonalAccessTokenResult {
  accessToken: AccessToken
  plainTextToken: string
  refreshToken?: string
  expiresIn: number
}

/**
 * Result returned when refreshing a token
 */
export interface RefreshTokenResult {
  accessToken: AccessToken
  plainTextToken: string
  refreshToken: string
  expiresIn: number
}

/**
 * OAuth Client
 */
export interface OAuthClient {
  id: number
  name: string
  secret: string
  provider: string | null
  redirect: string
  personalAccessClient: boolean
  passwordClient: boolean
  revoked: boolean
  createdAt: Date
  updatedAt: Date | null
}

// ============================================================================
// HASHING UTILITIES
// ============================================================================

/**
 * Hash a token using SHA-256
 * This is used to store tokens securely in the database
 */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/**
 * Generate a secure random token
 */
function generateSecureToken(bytes: number = 40): string {
  return randomBytes(bytes).toString('hex')
}

// ============================================================================
// TOKEN RETRIEVAL FUNCTIONS
// ============================================================================

/**
 * Get all access tokens for a user
 *
 * @example
 * import { tokens } from '@stacksjs/auth'
 * const userTokens = await tokens(user.id)
 */
export async function tokens(userId: number): Promise<AccessToken[]> {
  const rows = await db.unsafe(`
    SELECT t.*, c.provider as client_provider
    FROM oauth_access_tokens t
    LEFT JOIN oauth_clients c ON t.oauth_client_id = c.id
    WHERE t.user_id = ${param(1)}
    AND t.revoked = ${boolFalse}
    ORDER BY t.created_at DESC
  `, [userId]).execute()

  return (rows as any[]).map(row => ({
    id: row.id,
    userId: row.user_id,
    clientId: row.oauth_client_id,
    name: row.name || 'access-token',
    scopes: parseScopes(row.scopes),
    revoked: !!row.revoked,
    expiresAt: row.expires_at ? new Date(row.expires_at) : null,
    createdAt: new Date(row.created_at),
    updatedAt: row.updated_at ? new Date(row.updated_at) : new Date(),
  }))
}

/**
 * Get a specific token by its plain text value
 * Uses hash comparison for security
 *
 * @example
 * import { findToken } from '@stacksjs/auth'
 * const token = await findToken('abc123...')
 */
export async function findToken(plainTextToken: string): Promise<AccessToken | null> {
  const hashedToken = hashToken(plainTextToken)

  const rows = await db.unsafe(`
    SELECT * FROM oauth_access_tokens
    WHERE token = ${param(1)}
    AND revoked = ${boolFalse}
    AND (expires_at IS NULL OR expires_at > ${now})
    LIMIT 1
  `, [hashedToken]).execute()

  const row = (rows as any[])[0]
  if (!row) return null

  return {
    id: row.id,
    userId: row.user_id,
    clientId: row.oauth_client_id,
    name: row.name || 'access-token',
    scopes: parseScopes(row.scopes),
    revoked: !!row.revoked,
    expiresAt: row.expires_at ? new Date(row.expires_at) : null,
    createdAt: new Date(row.created_at),
    updatedAt: row.updated_at ? new Date(row.updated_at) : new Date(),
  }
}

/**
 * Get the current access token from the request context
 *
 * @example
 * import { currentAccessToken } from '@stacksjs/auth'
 * const token = await currentAccessToken()
 */
export async function currentAccessToken(): Promise<AccessToken | null> {
  const request = getCurrentRequest()
  if (!request) return null

  // Check if token is already attached to request
  const attached = (request as any)._currentAccessToken
  if (attached) return attached

  // Try to get from bearer token
  const bearerToken = request.bearerToken?.()
  if (!bearerToken) return null

  const token = await findToken(bearerToken)

  // Cache on request for subsequent calls
  if (token) {
    (request as any)._currentAccessToken = token
  }

  return token
}

/**
 * Alias for currentAccessToken
 *
 * @example
 * import { token } from '@stacksjs/auth'
 * const t = await token()
 */
export const token = currentAccessToken

// ============================================================================
// SCOPE CHECKING FUNCTIONS
// ============================================================================

/**
 * Check if the current token has a given scope/ability
 *
 * @example
 * import { tokenCan } from '@stacksjs/auth'
 * if (await tokenCan('posts:create')) {
 *   // user can create posts
 * }
 */
export async function tokenCan(scope: string): Promise<boolean> {
  const accessToken = await currentAccessToken()
  if (!accessToken) return false

  // Wildcard grants all permissions
  if (accessToken.scopes.includes('*')) return true

  return accessToken.scopes.includes(scope)
}

/**
 * Check if the current token does NOT have a given scope/ability
 *
 * @example
 * import { tokenCant } from '@stacksjs/auth'
 * if (await tokenCant('admin')) {
 *   throw new Error('Admin access required')
 * }
 */
export async function tokenCant(scope: string): Promise<boolean> {
  return !(await tokenCan(scope))
}

/**
 * Check if token has ALL of the given scopes
 *
 * @example
 * import { tokenCanAll } from '@stacksjs/auth'
 * if (await tokenCanAll(['posts:read', 'posts:write'])) {
 *   // user has both scopes
 * }
 */
export async function tokenCanAll(scopes: string[]): Promise<boolean> {
  const accessToken = await currentAccessToken()
  if (!accessToken) return false

  if (accessToken.scopes.includes('*')) return true

  return scopes.every(scope => accessToken.scopes.includes(scope))
}

/**
 * Check if token has ANY of the given scopes
 *
 * @example
 * import { tokenCanAny } from '@stacksjs/auth'
 * if (await tokenCanAny(['admin', 'moderator'])) {
 *   // user has at least one of the scopes
 * }
 */
export async function tokenCanAny(scopes: string[]): Promise<boolean> {
  const accessToken = await currentAccessToken()
  if (!accessToken) return false

  if (accessToken.scopes.includes('*')) return true

  return scopes.some(scope => accessToken.scopes.includes(scope))
}

/**
 * Get all scopes/abilities for the current token
 *
 * @example
 * import { tokenAbilities } from '@stacksjs/auth'
 * const abilities = await tokenAbilities()
 * // ['read', 'write', 'posts:create']
 */
export async function tokenAbilities(): Promise<string[]> {
  const accessToken = await currentAccessToken()
  return accessToken?.scopes || []
}

// ============================================================================
// TOKEN CREATION FUNCTIONS
// ============================================================================

/**
 * Create a new personal access token for a user
 * Tokens are hashed before storage for security
 *
 * @param userId - The user ID to create the token for
 * @param name - A name/description for the token
 * @param scopes - Array of scopes/abilities for the token
 * @param options - Additional options
 * @param options.expiresInMinutes - Token expiry in minutes (default: 60)
 * @param options.withRefreshToken - Whether to create a refresh token (default: true)
 * @param options.refreshExpiresInDays - Refresh token expiry in days (default: 30)
 *
 * @example
 * import { createToken } from '@stacksjs/auth'
 * const result = await createToken(user.id, 'My API Token', ['read', 'write'])
 * console.log(result.plainTextToken) // Save this - it won't be shown again!
 * console.log(result.refreshToken)   // Use this to get new access tokens
 */
export async function createToken(
  userId: number,
  name: string = 'access-token',
  scopes: string[] = ['*'],
  options: {
    expiresInMinutes?: number
    withRefreshToken?: boolean
    refreshExpiresInDays?: number
  } = {}
): Promise<PersonalAccessTokenResult> {
  const {
    expiresInMinutes = 60,
    withRefreshToken = true,
    refreshExpiresInDays = 30,
  } = options

  // Get the personal access client
  const clients = await db.unsafe(`
    SELECT id FROM oauth_clients WHERE personal_access_client = ${boolTrue} LIMIT 1
  `).execute()

  const client = (clients as any[])[0]
  if (!client) {
    throw new HttpError(500, 'No personal access client found. Run ./buddy auth:setup first.')
  }

  // Generate and hash access token
  const plainTextToken = generateSecureToken(40)
  const hashedToken = hashToken(plainTextToken)

  // Calculate expiry
  const expiresAt = new Date()
  expiresAt.setMinutes(expiresAt.getMinutes() + expiresInMinutes)

  // Insert access token
  if (isPostgres) {
    await db.unsafe(`
      INSERT INTO oauth_access_tokens (user_id, oauth_client_id, token, name, scopes, revoked, expires_at, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, false, $6, NOW(), NOW())
    `, [userId, client.id, hashedToken, name, JSON.stringify(scopes), expiresAt.toISOString()]).execute()
  } else {
    await db.unsafe(`
      INSERT INTO oauth_access_tokens (user_id, oauth_client_id, token, name, scopes, revoked, expires_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 0, ?, datetime('now'), datetime('now'))
    `, [userId, client.id, hashedToken, name, JSON.stringify(scopes), expiresAt.toISOString()]).execute()
  }

  // Get the inserted token
  const inserted = await db.unsafe(`
    SELECT * FROM oauth_access_tokens WHERE token = ${param(1)} LIMIT 1
  `, [hashedToken]).execute()

  const row = (inserted as any[])[0]

  const accessToken: AccessToken = {
    id: row.id,
    userId: row.user_id,
    clientId: row.oauth_client_id,
    name: row.name,
    scopes: parseScopes(row.scopes),
    revoked: false,
    expiresAt: expiresAt,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  }

  // Create refresh token if requested
  let refreshTokenPlain: string | undefined
  if (withRefreshToken) {
    refreshTokenPlain = generateSecureToken(40)
    const hashedRefreshToken = hashToken(refreshTokenPlain)

    const refreshExpiresAt = new Date()
    refreshExpiresAt.setDate(refreshExpiresAt.getDate() + refreshExpiresInDays)

    if (isPostgres) {
      await db.unsafe(`
        INSERT INTO oauth_refresh_tokens (access_token_id, token, revoked, expires_at, created_at)
        VALUES ($1, $2, false, $3, NOW())
      `, [accessToken.id, hashedRefreshToken, refreshExpiresAt.toISOString()]).execute()
    } else {
      await db.unsafe(`
        INSERT INTO oauth_refresh_tokens (access_token_id, token, revoked, expires_at, created_at)
        VALUES (?, ?, 0, ?, datetime('now'))
      `, [accessToken.id, hashedRefreshToken, refreshExpiresAt.toISOString()]).execute()
    }
  }

  return {
    accessToken,
    plainTextToken,
    refreshToken: refreshTokenPlain,
    expiresIn: expiresInMinutes * 60, // Return in seconds for consistency with OAuth2
  }
}

// ============================================================================
// REFRESH TOKEN FUNCTIONS
// ============================================================================

/**
 * Exchange a refresh token for a new access token
 *
 * @param refreshTokenPlain - The plain text refresh token
 * @param options - Additional options
 * @param options.expiresInMinutes - New access token expiry in minutes (default: 60)
 * @param options.refreshExpiresInDays - New refresh token expiry in days (default: 30)
 *
 * @example
 * import { refreshToken } from '@stacksjs/auth'
 * const result = await refreshToken('your-refresh-token')
 * // Use result.plainTextToken as new access token
 * // Use result.refreshToken as new refresh token (old one is revoked)
 */
export async function refreshToken(
  refreshTokenPlain: string,
  options: {
    expiresInMinutes?: number
    refreshExpiresInDays?: number
  } = {}
): Promise<RefreshTokenResult> {
  const {
    expiresInMinutes = 60,
    refreshExpiresInDays = 30,
  } = options

  const hashedRefreshToken = hashToken(refreshTokenPlain)

  // Find the refresh token and its associated access token
  const refreshRows = await db.unsafe(`
    SELECT r.*, t.user_id, t.oauth_client_id, t.name, t.scopes
    FROM oauth_refresh_tokens r
    JOIN oauth_access_tokens t ON r.access_token_id = t.id
    WHERE r.token = ${param(1)}
    AND r.revoked = ${boolFalse}
    AND (r.expires_at IS NULL OR r.expires_at > ${now})
    LIMIT 1
  `, [hashedRefreshToken]).execute()

  const refreshRow = (refreshRows as any[])[0]
  if (!refreshRow) {
    throw new HttpError(401, 'Invalid or expired refresh token')
  }

  // Revoke the old refresh token
  await db.unsafe(`
    UPDATE oauth_refresh_tokens
    SET revoked = ${boolTrue}
    WHERE id = ${param(1)}
  `, [refreshRow.id]).execute()

  // Create new access token
  const plainTextToken = generateSecureToken(40)
  const hashedToken = hashToken(plainTextToken)

  const expiresAt = new Date()
  expiresAt.setMinutes(expiresAt.getMinutes() + expiresInMinutes)

  if (isPostgres) {
    await db.unsafe(`
      INSERT INTO oauth_access_tokens (user_id, oauth_client_id, token, name, scopes, revoked, expires_at, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, false, $6, NOW(), NOW())
    `, [refreshRow.user_id, refreshRow.oauth_client_id, hashedToken, refreshRow.name, refreshRow.scopes, expiresAt.toISOString()]).execute()
  } else {
    await db.unsafe(`
      INSERT INTO oauth_access_tokens (user_id, oauth_client_id, token, name, scopes, revoked, expires_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 0, ?, datetime('now'), datetime('now'))
    `, [refreshRow.user_id, refreshRow.oauth_client_id, hashedToken, refreshRow.name, refreshRow.scopes, expiresAt.toISOString()]).execute()
  }

  // Get the new access token
  const inserted = await db.unsafe(`
    SELECT * FROM oauth_access_tokens WHERE token = ${param(1)} LIMIT 1
  `, [hashedToken]).execute()

  const row = (inserted as any[])[0]

  const accessToken: AccessToken = {
    id: row.id,
    userId: row.user_id,
    clientId: row.oauth_client_id,
    name: row.name,
    scopes: parseScopes(row.scopes),
    revoked: false,
    expiresAt: expiresAt,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  }

  // Create new refresh token
  const newRefreshTokenPlain = generateSecureToken(40)
  const newHashedRefreshToken = hashToken(newRefreshTokenPlain)

  const refreshExpiresAt = new Date()
  refreshExpiresAt.setDate(refreshExpiresAt.getDate() + refreshExpiresInDays)

  if (isPostgres) {
    await db.unsafe(`
      INSERT INTO oauth_refresh_tokens (access_token_id, token, revoked, expires_at, created_at)
      VALUES ($1, $2, false, $3, NOW())
    `, [accessToken.id, newHashedRefreshToken, refreshExpiresAt.toISOString()]).execute()
  } else {
    await db.unsafe(`
      INSERT INTO oauth_refresh_tokens (access_token_id, token, revoked, expires_at, created_at)
      VALUES (?, ?, 0, ?, datetime('now'))
    `, [accessToken.id, newHashedRefreshToken, refreshExpiresAt.toISOString()]).execute()
  }

  return {
    accessToken,
    plainTextToken,
    refreshToken: newRefreshTokenPlain,
    expiresIn: expiresInMinutes * 60,
  }
}

/**
 * Validate a refresh token without exchanging it
 *
 * @example
 * import { validateRefreshToken } from '@stacksjs/auth'
 * const isValid = await validateRefreshToken('your-refresh-token')
 */
export async function validateRefreshToken(refreshTokenPlain: string): Promise<boolean> {
  const hashedRefreshToken = hashToken(refreshTokenPlain)

  const rows = await db.unsafe(`
    SELECT id FROM oauth_refresh_tokens
    WHERE token = ${param(1)}
    AND revoked = ${boolFalse}
    AND (expires_at IS NULL OR expires_at > ${now})
    LIMIT 1
  `, [hashedRefreshToken]).execute()

  return (rows as any[]).length > 0
}

/**
 * Revoke a specific refresh token
 *
 * @example
 * import { revokeRefreshToken } from '@stacksjs/auth'
 * await revokeRefreshToken('your-refresh-token')
 */
export async function revokeRefreshToken(refreshTokenPlain: string): Promise<void> {
  const hashedRefreshToken = hashToken(refreshTokenPlain)

  await db.unsafe(`
    UPDATE oauth_refresh_tokens
    SET revoked = ${boolTrue}
    WHERE token = ${param(1)}
  `, [hashedRefreshToken]).execute()
}

/**
 * Revoke all refresh tokens for a user
 *
 * @example
 * import { revokeAllRefreshTokens } from '@stacksjs/auth'
 * await revokeAllRefreshTokens(user.id)
 */
export async function revokeAllRefreshTokens(userId: number): Promise<void> {
  await db.unsafe(`
    UPDATE oauth_refresh_tokens
    SET revoked = ${boolTrue}
    WHERE access_token_id IN (
      SELECT id FROM oauth_access_tokens WHERE user_id = ${param(1)}
    )
  `, [userId]).execute()
}

/**
 * Delete expired refresh tokens (cleanup)
 *
 * @example
 * import { deleteExpiredRefreshTokens } from '@stacksjs/auth'
 * const count = await deleteExpiredRefreshTokens()
 */
export async function deleteExpiredRefreshTokens(): Promise<number> {
  const result = await db.unsafe(`
    DELETE FROM oauth_refresh_tokens
    WHERE expires_at < ${now}
  `).execute()

  return (result as any)?.changes || (result as any)?.rowCount || 0
}

/**
 * Delete revoked refresh tokens older than specified days
 *
 * @example
 * import { deleteRevokedRefreshTokens } from '@stacksjs/auth'
 * const count = await deleteRevokedRefreshTokens(7)
 */
export async function deleteRevokedRefreshTokens(daysOld: number = 7): Promise<number> {
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - daysOld)

  const result = await db.unsafe(`
    DELETE FROM oauth_refresh_tokens
    WHERE revoked = ${boolTrue} AND created_at < ${param(1)}
  `, [cutoffDate.toISOString()]).execute()

  return (result as any)?.changes || (result as any)?.rowCount || 0
}

// ============================================================================
// TOKEN REVOCATION FUNCTIONS
// ============================================================================

/**
 * Revoke a specific access token
 *
 * @example
 * import { revokeToken } from '@stacksjs/auth'
 * await revokeToken('abc123...')
 */
export async function revokeToken(plainTextToken: string): Promise<void> {
  const hashedToken = hashToken(plainTextToken)

  // Also revoke associated refresh tokens
  await db.unsafe(`
    UPDATE oauth_refresh_tokens
    SET revoked = ${boolTrue}
    WHERE access_token_id IN (
      SELECT id FROM oauth_access_tokens WHERE token = ${param(1)}
    )
  `, [hashedToken]).execute()

  await db.unsafe(`
    UPDATE oauth_access_tokens
    SET revoked = ${boolTrue}, updated_at = ${now}
    WHERE token = ${param(1)}
  `, [hashedToken]).execute()
}

/**
 * Revoke a token by its ID
 *
 * @example
 * import { revokeTokenById } from '@stacksjs/auth'
 * await revokeTokenById(123)
 */
export async function revokeTokenById(tokenId: number): Promise<void> {
  // Also revoke associated refresh tokens
  await db.unsafe(`
    UPDATE oauth_refresh_tokens
    SET revoked = ${boolTrue}
    WHERE access_token_id = ${param(1)}
  `, [tokenId]).execute()

  await db.unsafe(`
    UPDATE oauth_access_tokens
    SET revoked = ${boolTrue}, updated_at = ${now}
    WHERE id = ${param(1)}
  `, [tokenId]).execute()
}

/**
 * Revoke all tokens for a user
 *
 * @example
 * import { revokeAllTokens } from '@stacksjs/auth'
 * await revokeAllTokens(user.id)
 */
export async function revokeAllTokens(userId: number): Promise<void> {
  // Revoke all refresh tokens first
  await revokeAllRefreshTokens(userId)

  await db.unsafe(`
    UPDATE oauth_access_tokens
    SET revoked = ${boolTrue}, updated_at = ${now}
    WHERE user_id = ${param(1)}
  `, [userId]).execute()
}

/**
 * Revoke all tokens except the current one
 *
 * @example
 * import { revokeOtherTokens } from '@stacksjs/auth'
 * await revokeOtherTokens(user.id)
 */
export async function revokeOtherTokens(userId: number): Promise<void> {
  const current = await currentAccessToken()
  if (!current) {
    return revokeAllTokens(userId)
  }

  // Revoke refresh tokens for other access tokens
  if (isPostgres) {
    await db.unsafe(`
      UPDATE oauth_refresh_tokens
      SET revoked = true
      WHERE access_token_id IN (
        SELECT id FROM oauth_access_tokens WHERE user_id = $1 AND id != $2
      )
    `, [userId, current.id]).execute()

    await db.unsafe(`
      UPDATE oauth_access_tokens
      SET revoked = true, updated_at = NOW()
      WHERE user_id = $1 AND id != $2
    `, [userId, current.id]).execute()
  } else {
    await db.unsafe(`
      UPDATE oauth_refresh_tokens
      SET revoked = 1
      WHERE access_token_id IN (
        SELECT id FROM oauth_access_tokens WHERE user_id = ? AND id != ?
      )
    `, [userId, current.id]).execute()

    await db.unsafe(`
      UPDATE oauth_access_tokens
      SET revoked = 1, updated_at = datetime('now')
      WHERE user_id = ? AND id != ?
    `, [userId, current.id]).execute()
  }
}

/**
 * Delete expired tokens (cleanup)
 *
 * @example
 * import { deleteExpiredTokens } from '@stacksjs/auth'
 * const count = await deleteExpiredTokens()
 */
export async function deleteExpiredTokens(): Promise<number> {
  // Delete associated refresh tokens first
  await db.unsafe(`
    DELETE FROM oauth_refresh_tokens
    WHERE access_token_id IN (
      SELECT id FROM oauth_access_tokens WHERE expires_at < ${now}
    )
  `).execute()

  const result = await db.unsafe(`
    DELETE FROM oauth_access_tokens
    WHERE expires_at < ${now}
  `).execute()

  return (result as any)?.changes || (result as any)?.rowCount || 0
}

/**
 * Delete revoked tokens older than specified days
 *
 * @example
 * import { deleteRevokedTokens } from '@stacksjs/auth'
 * const count = await deleteRevokedTokens(30) // older than 30 days
 */
export async function deleteRevokedTokens(daysOld: number = 7): Promise<number> {
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - daysOld)

  // Delete associated refresh tokens first
  await db.unsafe(`
    DELETE FROM oauth_refresh_tokens
    WHERE access_token_id IN (
      SELECT id FROM oauth_access_tokens WHERE revoked = ${boolTrue} AND updated_at < ${param(1)}
    )
  `, [cutoffDate.toISOString()]).execute()

  const result = await db.unsafe(`
    DELETE FROM oauth_access_tokens
    WHERE revoked = ${boolTrue} AND updated_at < ${param(1)}
  `, [cutoffDate.toISOString()]).execute()

  return (result as any)?.changes || (result as any)?.rowCount || 0
}

// ============================================================================
// OAUTH CLIENT FUNCTIONS
// ============================================================================

/**
 * Get all OAuth clients for a user
 *
 * @example
 * import { clients } from '@stacksjs/auth'
 * const userClients = await clients(user.id)
 */
export async function clients(userId: number): Promise<OAuthClient[]> {
  const rows = await db.unsafe(`
    SELECT * FROM oauth_clients
    WHERE user_id = ${param(1)} AND revoked = ${boolFalse}
    ORDER BY created_at DESC
  `, [userId]).execute()

  return (rows as any[]).map(mapToOAuthClient)
}

/**
 * Get a specific OAuth client by ID
 *
 * @example
 * import { findClient } from '@stacksjs/auth'
 * const client = await findClient(1)
 */
export async function findClient(clientId: number): Promise<OAuthClient | null> {
  const rows = await db.unsafe(`
    SELECT * FROM oauth_clients WHERE id = ${param(1)} LIMIT 1
  `, [clientId]).execute()

  const row = (rows as any[])[0]
  return row ? mapToOAuthClient(row) : null
}

/**
 * Create a new OAuth client
 *
 * @example
 * import { createClient } from '@stacksjs/auth'
 * const client = await createClient({
 *   name: 'My App',
 *   redirect: 'https://myapp.com/callback'
 * })
 */
export async function createClient(options: {
  name: string
  redirect: string
  userId?: number
  personalAccessClient?: boolean
  passwordClient?: boolean
}): Promise<{ client: OAuthClient, plainTextSecret: string }> {
  const secret = generateSecureToken(40)

  if (isPostgres) {
    await db.unsafe(`
      INSERT INTO oauth_clients (name, secret, provider, redirect, personal_access_client, password_client, revoked, created_at)
      VALUES ($1, $2, 'local', $3, $4, $5, false, NOW())
    `, [
      options.name,
      secret,
      options.redirect,
      options.personalAccessClient || false,
      options.passwordClient || false,
    ]).execute()
  } else {
    await db.unsafe(`
      INSERT INTO oauth_clients (name, secret, provider, redirect, personal_access_client, password_client, revoked, created_at)
      VALUES (?, ?, 'local', ?, ?, ?, 0, datetime('now'))
    `, [
      options.name,
      secret,
      options.redirect,
      options.personalAccessClient ? 1 : 0,
      options.passwordClient ? 1 : 0,
    ]).execute()
  }

  const inserted = await db.unsafe(`
    SELECT * FROM oauth_clients WHERE secret = ${param(1)} LIMIT 1
  `, [secret]).execute()

  return {
    client: mapToOAuthClient((inserted as any[])[0]),
    plainTextSecret: secret,
  }
}

/**
 * Revoke an OAuth client
 *
 * @example
 * import { revokeClient } from '@stacksjs/auth'
 * await revokeClient(1)
 */
export async function revokeClient(clientId: number): Promise<void> {
  await db.unsafe(`
    UPDATE oauth_clients
    SET revoked = ${boolTrue}, updated_at = ${now}
    WHERE id = ${param(1)}
  `, [clientId]).execute()
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function parseScopes(scopes: string | string[] | null | undefined): string[] {
  if (!scopes) return []
  if (Array.isArray(scopes)) return scopes
  try {
    const parsed = JSON.parse(scopes)
    return Array.isArray(parsed) ? parsed : []
  }
  catch {
    return []
  }
}

function mapToOAuthClient(row: any): OAuthClient {
  return {
    id: row.id,
    name: row.name,
    secret: row.secret,
    provider: row.provider,
    redirect: row.redirect,
    personalAccessClient: !!row.personal_access_client,
    passwordClient: !!row.password_client,
    revoked: !!row.revoked,
    createdAt: new Date(row.created_at),
    updatedAt: row.updated_at ? new Date(row.updated_at) : null,
  }
}
