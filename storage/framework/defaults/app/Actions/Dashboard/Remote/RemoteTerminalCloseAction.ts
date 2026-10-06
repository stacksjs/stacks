import type { UserModel } from '@stacksjs/orm'
import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions/runtime'
import { response } from '@stacksjs/router'
import { RemoteCommandError } from './remote-commands'
import { terminalSessions } from './terminal-sessions'

/** End a terminal session and the remote shell with it (stacksjs/stacks#960). */
export default new Action({
  name: 'RemoteTerminalCloseAction',
  description: 'Closes a terminal session.',
  method: 'DELETE',
  async handle(request: RequestInstance) {
    try {
      const user = (await request.user() ?? null) as UserModel | null
      await terminalSessions.close(request.getParam('id'), user)
      return response.json({ ok: true })
    }
    catch (error) {
      if (error instanceof RemoteCommandError)
        return response.json({ message: error.message }, error.status)
      throw error
    }
  },
})
