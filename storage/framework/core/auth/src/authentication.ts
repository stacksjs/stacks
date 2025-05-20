import type { TeamModel } from '../../../orm/src/models/Team'
import type { UserModel, UsersTable } from '../../../orm/src/models/User'
import { randomBytes } from 'node:crypto'
import { HttpError } from '@stacksjs/error-handling'
import { request } from '@stacksjs/router'
import { verifyHash, makeHash } from '@stacksjs/security'
import AccessToken from '../../../orm/src/models/AccessToken'
import Team from '../../../orm/src/models/Team'
import User from '../../../orm/src/models/User'

interface Credentials {
  password: string | undefined
  email: string | undefined
  [key: string]: string | undefined
}

type AuthToken = `${number}:${number}:${string}`

const authConfig = { username: 'email', password: 'password' }

let authUser: UserModel | null = null

// Rate limiting configuration
const MAX_ATTEMPTS = 5
const LOCKOUT_DURATION = 15 * 60 * 1000 // 15 minutes in milliseconds
const attemptStore = new Map<string, { attempts: number; lockedUntil: number }>()

function isRateLimited(email: string): boolean {
  const now = Date.now()
  const userAttempts = attemptStore.get(email)

  if (!userAttempts)
    return false

  if (userAttempts.lockedUntil > now)
    return true

  if (userAttempts.attempts >= MAX_ATTEMPTS) {
    attemptStore.set(email, { attempts: 0, lockedUntil: now + LOCKOUT_DURATION })
    return true
  }

  return false
}

function recordFailedAttempt(email: string): void {
  const userAttempts = attemptStore.get(email) || { attempts: 0, lockedUntil: 0 }
  userAttempts.attempts++
  attemptStore.set(email, userAttempts)
}

function resetAttempts(email: string): void {
  attemptStore.delete(email)
}

export async function attempt(credentials: Credentials): Promise<boolean> {
  const email = credentials[authConfig.username]
  
  if (!email || typeof email !== 'string')
    return false

  if (isRateLimited(email))
    throw new HttpError(429, 'Too many login attempts. Please try again later.')

  let hashCheck = false
  const user = await User.where(authConfig.username as keyof UsersTable, email).first()
  const authPass = credentials[authConfig.password]

  if (typeof authPass === 'string' && user?.password)
    hashCheck = await verifyHash(authPass, user.password, 'bcrypt')

  if (hashCheck && user) {
    resetAttempts(email)
    authUser = user
    return true
  }

  recordFailedAttempt(email)
  return false
}

export async function createAccessToken(user: UserModel, teamId: number): Promise<AuthToken> {
  const token = randomBytes(40).toString('hex')
  const hashedToken = await makeHash(token, { algorithm: 'bcrypt' })
  
  const accessToken = await AccessToken.create({
    team_id: teamId,
    user_id: user.id,
    token: hashedToken,
    name: 'auth-token',
    plain_text_token: token,
    abilities: ['read', 'write', 'admin'],
    expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(), // 30 days
    last_used_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })

  if (!accessToken?.id)
    throw new HttpError(500, 'Failed to create access token')

  return `${accessToken.id}:${teamId || 0}:${token}`
}

export async function login(credentials: Credentials): Promise<{ token: AuthToken } | null> {
  const isValid = await attempt(credentials)

  if (!isValid || !authUser)
    return null

  // Get user's primary team
  const teams = await authUser.userTeams()
  const primaryTeam = teams[0]

  const token = await createAccessToken(authUser, primaryTeam?.id)
  return { token }
}

export async function rotateToken(oldToken: string): Promise<AuthToken | null> {
  const parts = oldToken.split(':')
  if (parts.length !== 3)
    return null

  const [tokenId, teamId, plainToken] = parts
  const accessToken = await AccessToken.where('id', Number(tokenId))
    .where('team_id', Number(teamId))
    .first()

  if (!accessToken)
    return null

  // Verify the old token
  const isValid = await verifyHash(plainToken, accessToken.token, 'bcrypt')
  if (!isValid)
    return null

  // Generate new token
  const newToken = randomBytes(40).toString('hex')
  const hashedNewToken = await makeHash(newToken, { algorithm: 'bcrypt' })

  // Update the token
  await AccessToken.where('id', accessToken.id).update({
    token: hashedNewToken,
    plain_text_token: newToken,
    updated_at: new Date().toISOString(),
    last_used_at: new Date().toISOString(),
  })

  return `${accessToken.id}:${Number(teamId)}:${newToken}`
}

export async function validateToken(token: string): Promise<boolean> {
  const parts = token.split(':')

  if (parts.length !== 3)
    return false

  const [tokenId, teamId, plainToken] = parts

  const accessToken = await AccessToken.where('id', Number(tokenId))
    .where('team_id', Number(teamId))
    .first()

  if (!accessToken)
    return false

  // Verify the token hash
  const isValid = await verifyHash(plainToken, accessToken.token, 'bcrypt')
  if (!isValid)
    return false

  // Check if token is expired
  if (accessToken.expires_at && new Date(accessToken.expires_at) < new Date()) {
    // Automatically delete expired tokens
    await AccessToken.where('id', accessToken.id).delete()
    return false
  }

  // Rotate token if it's been used for more than 24 hours
  const lastUsed = accessToken.last_used_at ? new Date(accessToken.last_used_at) : new Date()
  const now = new Date()
  const hoursSinceLastUse = (now.getTime() - lastUsed.getTime()) / (1000 * 60 * 60)

  if (hoursSinceLastUse >= 24) {
    await rotateToken(token)
  } else {
    // Update last used timestamp
    await AccessToken.where('id', accessToken.id).update({
      last_used_at: now.toISOString(),
    })
  }

  return true
}

export async function getUserFromToken(token: string): Promise<UserModel | undefined> {
  const parts = token.split(':')

  if (parts.length !== 3)
    return undefined

  const [tokenId] = parts

  const accessToken = await AccessToken.where('id', Number(tokenId)).first()

  if (!accessToken?.user_id)
    return undefined

  return await User.find(accessToken.user_id)
}

export async function team(): Promise<TeamModel | undefined> {
  if (authUser) {
    const teams = await authUser.userTeams()
    return teams[0]
  }

  const bearerToken = request.bearerToken()

  if (!bearerToken)
    return undefined

  const parts = bearerToken.split(':')

  if (parts.length !== 3)
    throw new HttpError(401, 'Invalid bearer token format')

  const tokenId = Number(parts[0])
  const teamId = parts[1]
  const plainString = parts[2]

  const accessToken = await AccessToken.where('id', Number(tokenId))
    .where('token', plainString)
    .first()

  if (Number(teamId) !== Number(accessToken?.team_id))
    return undefined

  return await Team.find(Number(accessToken?.team_id))
}

export async function revokeToken(token: string): Promise<void> {
  const parts = token.split(':')

  if (parts.length !== 3)
    return

  const [tokenId] = parts

  await AccessToken.where('id', Number(tokenId)).delete()
}

export async function logout(): Promise<void> {
  const bearerToken = request.bearerToken()

  if (bearerToken)
    await revokeToken(bearerToken)

  authUser = null
}
