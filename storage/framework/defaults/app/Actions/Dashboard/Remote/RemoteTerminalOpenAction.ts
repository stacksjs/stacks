import type { UserModel } from '@stacksjs/orm'
import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions/runtime'
import { hosts } from '~/config/remote'
import { response } from '@stacksjs/router'
import { RemoteCommandError } from './remote-commands'
import { terminalAuthorizer, terminalSessions } from './terminal-sessions'

/**
 * Open a terminal session on a configured host (stacksjs/stacks#960).
 *
 * Routed without `guard()`, like the command runner: that helper drops auth
 * entirely when `APP_ENV` is local or test, which here would be an
 * unauthenticated shell. See `routes/dashboard-api.ts`.
 */
export default new Action({
  name: 'RemoteTerminalOpenAction',
  description: 'Opens an interactive terminal session on a configured host.',
  method: 'POST',
  async handle(request: RequestInstance) {
    try {
      const user = (await request.user() ?? null) as UserModel | null
      const session = await terminalSessions.open({
        user,
        hosts,
        hostKey: request.get('host'),
        authorizer: terminalAuthorizer(),
        cols: request.get('cols'),
        rows: request.get('rows'),
      })
      return response.json(session, 201)
    }
    catch (error) {
      if (error instanceof RemoteCommandError)
        return response.json({ message: error.message }, error.status)
      throw error
    }
  },
})
