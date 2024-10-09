import { Middleware, request } from '@stacksjs/router'
import { Team } from '../../storage/framework/orm/src'

export default new Middleware({
  name: 'Team ',
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

    const teamId = parts[1] as string

    const team = await Team.find(Number(teamId))

    if (!team) {
      throw { message: 'Team not found!', status: 401 }
    }
  },
})
