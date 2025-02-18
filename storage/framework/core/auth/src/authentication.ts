import type { TeamModel } from '../../../orm/src/models/Team'
import { HttpError } from '@stacksjs/error-handling'
import { request } from '@stacksjs/router'
import { verifyHash } from '@stacksjs/security'
import AccessToken from '../../../orm/src/models/AccessToken'
import Team from '../../../orm/src/models/Team'
import User from '../../../orm/src/models/User'

interface Credentials {
  password: string | undefined
  [key: string]: string | undefined
}

type AuthToken = `${number}:${number}:${string}`

const authConfig = { username: 'email', password: 'password' }

let authUser: any

// TODO: restore remember param
export async function attempt(credentials: Credentials): Promise<boolean> {
  let hashCheck = false

  const user = await User.where(authConfig.username, credentials[authConfig.username]).first()
  const authPass = credentials[authConfig.password]

  if (typeof authPass === 'string' && user?.password)
    hashCheck = await verifyHash(authPass, user?.password, 'bcrypt')

  if (hashCheck) {
    if (user) {
      authUser = user

      return true
    }
  }

  return false
}

export async function team(): Promise<TeamModel | undefined> {
  if (authUser) {
    const teams = await authUser.userTeams()

    // TODO: reconfigure model instance
    return teams[0].team
  }

  // tokenId:teamId:tokenString
  const bearerToken = request.bearerToken()

  if (!bearerToken) {
    return undefined
  }

  const parts = bearerToken.split(':')

  if (parts.length !== 3)
    throw new HttpError(401, 'Invalid bearer token format')

  const tokenId = Number(parts[0])
  const teamId = parts[1]
  const plainString = parts[2]

  const accessToken = await AccessToken.where('id', Number(tokenId)).where('token', plainString).first()

  if (Number(teamId) !== Number(accessToken?.team_id)) {
    return undefined
  }

  const team = await Team.find(Number(accessToken?.team_id))

  return team
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
