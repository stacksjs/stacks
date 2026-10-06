import type { UserModel } from '@stacksjs/orm'
import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions/runtime'
import { response } from '@stacksjs/router'
import { RemoteCommandError } from './remote-commands'
import { terminalSessions } from './terminal-sessions'

/** Type into a terminal session (stacksjs/stacks#960). */
export default new Action({
  name: 'RemoteTerminalInputAction',
  description: 'Sends input to a terminal session.',
  method: 'POST',
  async handle(request: RequestInstance) {
    try {
      const user = (await request.user() ?? null) as UserModel | null
      await terminalSessions.input(request.getParam('id'), user, request.get('data'))
      return response.json({ ok: true })
    }
    catch (error) {
      if (error instanceof RemoteCommandError)
        return response.json({ message: error.message }, error.status)
      throw error
    }
  },
})
