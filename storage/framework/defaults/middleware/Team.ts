import type { Request } from '@stacksjs/router'
import { Team } from '@stacksjs/orm'
import { Middleware } from '@stacksjs/router'

export default new Middleware({
  name: 'Team ',
  priority: 1,
  async handle(request: Request) {
    const bearerToken = request.bearerToken() || ''

    if (!bearerToken) {
      throw new Error(JSON.stringify({ message: 'Unauthorized', status: 401 }))
    }

    const parts = bearerToken.split(':')

    if (parts.length !== 3) {
      throw new Error(JSON.stringify({ message: 'Invalid bearer token', status: 401 }))
    }

    const teamId = parts[1] as string

    const team = await Team.find(Number(teamId))

    if (!team) {
      throw new Error(JSON.stringify({ message: 'Team not found!', status: 401 }))
    }
  },
})
