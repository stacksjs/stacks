import type { TeamModel } from '../../../orm/src/models/Team'
import type { UserModel, UsersTable } from '../../../orm/src/models/User'
import { randomBytes } from 'node:crypto'
import { HttpError } from '@stacksjs/error-handling'
import { request } from '@stacksjs/router'
import { verifyHash } from '@stacksjs/security'
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

export async function attempt(credentials: Credentials): Promise<boolean> {
  let hashCheck = false

  const user = await User.where(authConfig.username as keyof UsersTable, credentials[authConfig.username]).first()
  const authPass = credentials[authConfig.password]

  if (typeof authPass === 'string' && user?.password)
    hashCheck = await verifyHash(authPass, user.password, 'bcrypt')

  if (hashCheck && user) {
    authUser = user
    return true
  }

  return false
}

export async function createAccessToken(user: UserModel, teamId: number): Promise<AuthToken> {
  const token = randomBytes(40).toString('hex')

  const accessToken = await AccessToken.create({
    team_id: teamId,
    user_id: user.id,
    token,
    name: 'auth-token',
    plain_text_token: token,
    abilities: ['read', 'write', 'admin'],
    expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30), // 30 days
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

export async function validateToken(token: string): Promise<boolean> {
  const parts = token.split(':')

  if (parts.length !== 3)
    return false

  const [tokenId, teamId, plainToken] = parts

  const accessToken = await AccessToken.where('id', Number(tokenId))
    .where('token', plainToken)
    .where('team_id', Number(teamId))
    .first()

  if (!accessToken)
    return false

  // Check if token is expired
  if (accessToken.expires_at && new Date(accessToken.expires_at) < new Date())
    return false

  // Update last used timestamp
  await AccessToken.where('id', accessToken.id).update({
    last_used_at: new Date(),
  })

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
