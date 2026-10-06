import type { UserModel } from '@stacksjs/orm'
import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions/runtime'
import { response } from '@stacksjs/router'
import { RemoteCommandError } from './remote-commands'
import { terminalSessions } from './terminal-sessions'

/** Resize a terminal session's window (stacksjs/stacks#960). */
export default new Action({
  name: 'RemoteTerminalResizeAction',
  description: 'Resizes a terminal session.',
  method: 'POST',
  async handle(request: RequestInstance) {
    try {
      const user = (await request.user() ?? null) as UserModel | null
      terminalSessions.resize(request.getParam('id'), user, request.get('cols'), request.get('rows'))
      return response.json({ ok: true })
    }
    catch (error) {
      if (error instanceof RemoteCommandError)
        return response.json({ message: error.message }, error.status)
      throw error
    }
  },
})
