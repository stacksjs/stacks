import type { TeamModel } from '../../../orm/src/models/Team'
import type { UserModel } from '../../../orm/src/models/User'
import { HttpError } from '@stacksjs/error-handling'
import { request } from '@stacksjs/router'
import { verifyHash } from '@stacksjs/security'
import { sign, verify } from '@stacksjs/security' // Assuming this exists, if not we can use 'jsonwebtoken'
import AccessToken from '../../../orm/src/models/AccessToken'
import Team from '../../../orm/src/models/Team'
import User from '../../../orm/src/models/User'

interface Credentials {
  password: string | undefined
  email: string | undefined
  [key: string]: string | undefined
}

interface TokenPayload {
  userId: number
  teamId?: number
  email: string
  exp?: number
}

type AuthToken = `${number}:${number}:${string}`

const TOKEN_EXPIRY = 60 * 60 * 24 // 24 hours
const authConfig = { username: 'email', password: 'password' }

let authUser: UserModel | null = null

export async function attempt(credentials: Credentials): Promise<boolean> {
  let hashCheck = false

  const user = await User.where(authConfig.username, credentials[authConfig.username]).first()
  const authPass = credentials[authConfig.password]

  if (typeof authPass === 'string' && user?.password)
    hashCheck = await verifyHash(authPass, user.password, 'bcrypt')

  if (hashCheck && user) {
    authUser = user
    return true
  }

  return false
}

export async function generateAccessToken(user: UserModel): Promise<string> {
  const payload: TokenPayload = {
    userId: user.id as number,
    email: user.email as string,
    exp: Math.floor(Date.now() / 1000) + TOKEN_EXPIRY,
  }

  return sign(payload, process.env.JWT_SECRET || 'your-secret-key')
}

export async function verifyAccessToken(token: string): Promise<TokenPayload | null> {
  try {
    const payload = await verify(token, process.env.JWT_SECRET || 'your-secret-key') as TokenPayload
    return payload
  }
  catch (error) {
    return null
  }
}

export async function login(credentials: Credentials): Promise<{ token: string } | null> {
  const isValid = await attempt(credentials)

  if (!isValid || !authUser)
    return null

  const token = await generateAccessToken(authUser)
  return { token }
}

export async function getUserFromToken(token: string): Promise<UserModel | null> {
  const payload = await verifyAccessToken(token)

  if (!payload)
    return null

  return await User.find(payload.userId)
}

export async function team(): Promise<TeamModel | undefined> {
  if (authUser) {
    const teams = await authUser.userTeams()
    return teams[0].team
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

export async function authToken(): Promise<AuthToken | undefined> {
  if (authUser) {
    const teams = await authUser.userTeams()
    const team = teams[0]
    const accessTokens = await team.teamAccessTokens()
    const accessToken = accessTokens[0]
    const tokenId = accessToken?.id

    if (!accessToken)
      throw new HttpError(500, 'Error generating token!')

    return `${tokenId}:${team.id}:${accessToken.token}`
  }
}

export async function logout(): Promise<void> {
  authUser = null
}
