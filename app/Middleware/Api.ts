import { Middleware } from '@stacksjs/router'
import { request } from '@stacksjs/router'
import { AccessToken, Team } from '../../storage/framework/orm/src'

export default new Middleware({
  name: 'API Authentication',
  priority: 1,
  async handle() {
    const bearerToken = request.bearerToken() || ''

    const parts = bearerToken.split('|')

    if (parts.length !== 2) {
      throw { message: 'Invalid bearer token format', status: 401 }
    }

    const teamToken = parts[0]
    const plainString = parts[1] as string

    const team = await Team.find(Number(teamToken))

    if (!team) {
      throw { message: 'Invalid bearer token', status: 401 }
    }

    const teamBearerToken = await AccessToken.where('token', plainString).first()

    if (!teamBearerToken) {
      throw { message: 'Invalid bearer token', status: 401 }
    }
  },
})
