/**
 * Token Functions - Passport-style token management
 *
 * Standalone functions that can be imported and used anywhere.
 * These replicate Laravel Passport's HasApiTokens trait functionality.
 */

import type { UserModel } from '@stacksjs/orm'
import { randomBytes } from 'node:crypto'
import { db } from '@stacksjs/database'
import { HttpError } from '@stacksjs/error-handling'
import { getCurrentRequest } from '@stacksjs/router'

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
 * Result returned when creating a personal access token
 */
export interface PersonalAccessTokenResult {
  accessToken: AccessToken
  plainTextToken: string
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
    WHERE t.user_id = ?
    AND t.revoked = 0
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
 *
 * @example
 * import { findToken } from '@stacksjs/auth'
 * const token = await findToken('abc123...')
 */
export async function findToken(plainTextToken: string): Promise<AccessToken | null> {
  const rows = await db.unsafe(`
    SELECT * FROM oauth_access_tokens
    WHERE token = ?
    LIMIT 1
  `, [plainTextToken]).execute()

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

  return findToken(bearerToken)
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
 *
 * @example
 * import { createToken } from '@stacksjs/auth'
 * const result = await createToken(user.id, 'My API Token', ['read', 'write'])
 * console.log(result.plainTextToken) // Save this!
 */
export async function createToken(
  userId: number,
  name: string = 'access-token',
  scopes: string[] = ['*'],
  expiresInDays: number = 365
): Promise<PersonalAccessTokenResult> {
  // Get the personal access client
  const clients = await db.unsafe(`
    SELECT id FROM oauth_clients WHERE personal_access_client = 1 LIMIT 1
  `).execute()

  const client = (clients as any[])[0]
  if (!client) {
    throw new HttpError(500, 'No personal access client found. Run ./buddy auth:setup first.')
  }

  // Generate token
  const plainTextToken = randomBytes(40).toString('hex')
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + expiresInDays)

  // Insert token
  await db.unsafe(`
    INSERT INTO oauth_access_tokens (user_id, oauth_client_id, token, name, scopes, revoked, expires_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 0, ?, datetime('now'), datetime('now'))
  `, [userId, client.id, plainTextToken, name, JSON.stringify(scopes), expiresAt.toISOString()]).execute()

  // Get the inserted token
  const inserted = await db.unsafe(`
    SELECT * FROM oauth_access_tokens WHERE token = ? LIMIT 1
  `, [plainTextToken]).execute()

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

  return {
    accessToken,
    plainTextToken,
  }
}

// ============================================================================
// TOKEN REVOCATION FUNCTIONS
// ============================================================================

/**
 * Revoke a specific token
 *
 * @example
 * import { revokeToken } from '@stacksjs/auth'
 * await revokeToken('abc123...')
 */
export async function revokeToken(plainTextToken: string): Promise<void> {
  await db.unsafe(`
    UPDATE oauth_access_tokens
    SET revoked = 1, updated_at = datetime('now')
    WHERE token = ?
  `, [plainTextToken]).execute()
}

/**
 * Revoke a token by its ID
 *
 * @example
 * import { revokeTokenById } from '@stacksjs/auth'
 * await revokeTokenById(123)
 */
export async function revokeTokenById(tokenId: number): Promise<void> {
  await db.unsafe(`
    UPDATE oauth_access_tokens
    SET revoked = 1, updated_at = datetime('now')
    WHERE id = ?
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
  await db.unsafe(`
    UPDATE oauth_access_tokens
    SET revoked = 1, updated_at = datetime('now')
    WHERE user_id = ?
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

  await db.unsafe(`
    UPDATE oauth_access_tokens
    SET revoked = 1, updated_at = datetime('now')
    WHERE user_id = ? AND id != ?
  `, [userId, current.id]).execute()
}

/**
 * Delete expired tokens (cleanup)
 *
 * @example
 * import { deleteExpiredTokens } from '@stacksjs/auth'
 * const count = await deleteExpiredTokens()
 */
export async function deleteExpiredTokens(): Promise<number> {
  const result = await db.unsafe(`
    DELETE FROM oauth_access_tokens
    WHERE expires_at < datetime('now')
  `).execute()

  return (result as any)?.changes || 0
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

  const result = await db.unsafe(`
    DELETE FROM oauth_access_tokens
    WHERE revoked = 1 AND updated_at < ?
  `, [cutoffDate.toISOString()]).execute()

  return (result as any)?.changes || 0
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
    WHERE user_id = ? AND revoked = 0
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
    SELECT * FROM oauth_clients WHERE id = ? LIMIT 1
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
  const secret = randomBytes(40).toString('hex')

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

  const inserted = await db.unsafe(`
    SELECT * FROM oauth_clients WHERE secret = ? LIMIT 1
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
    SET revoked = 1, updated_at = datetime('now')
    WHERE id = ?
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
