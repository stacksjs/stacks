import { Middleware, request } from '@stacksjs/router'
import { AccessToken, Team } from '../../storage/framework/orm/src'

export default new Middleware({
  name: 'API Authentication',
  priority: 1,
  async handle() {
    const bearerToken = request.bearerToken() || ''

    if (!bearerToken) {
      throw { message: 'Unauthorized.', status: 401 }
    }

    const parts = bearerToken.split(':')

    if (parts.length !== 3) {
      throw { message: 'Invalid bearer token format', status: 401 }
    }

    const tokenId = Number(parts[0])
    const teamId = parts[1] as string
    const plainString = parts[2] as string

    const team = await Team.find(Number(teamId))

    if (!team) {
      throw { message: 'Invalid bearer token', status: 401 }
    }

    const accessTokens = await team.teamAccessTokens()

    if (!accessTokens.length) {
      throw { message: 'Invalid bearer token', status: 401 }
    }

    const accessTokenIds = accessTokens.map(accessToken => accessToken.id)

    if (!accessTokenIds.includes(tokenId)) {
      throw { message: 'Invalid bearer token', status: 401 }
    }

    const teamBearerToken = await AccessToken.where('token', plainString).first()

    if (!teamBearerToken) {
      throw { message: 'Invalid bearer token', status: 401 }
    }
  },
})
