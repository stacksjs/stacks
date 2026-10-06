import type { UserModel } from '@stacksjs/orm'
import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions/runtime'
import { response, stream } from '@stacksjs/router'
import { RemoteCommandError } from './remote-commands'
import { terminalEventStream, terminalSessions } from './terminal-sessions'

/**
 * A terminal session's output as server-sent events (stacksjs/stacks#960).
 *
 * `after` (or `Last-Event-ID`) resumes after the last sequence number the
 * viewer saw, from the session's replay buffer.
 */
export default new Action({
  name: 'RemoteTerminalStreamAction',
  description: 'Streams a terminal session\'s output.',
  method: 'GET',
  async handle(request: RequestInstance) {
    try {
      const user = (await request.user() ?? null) as UserModel | null
      const resumeFrom = request.get('after') ?? request.headers.get('last-event-id') ?? 0
      const after = Number(resumeFrom)
      const events = terminalSessions.watch(request.getParam('id'), user, Number.isInteger(after) && after > 0 ? after : 0)
      return stream(terminalEventStream(events), {
        type: 'sse',
        // Proxies that buffer would hold keystroke echoes until a buffer fills.
        headers: { 'X-Accel-Buffering': 'no' },
      })
    }
    catch (error) {
      if (error instanceof RemoteCommandError)
        return response.json({ message: error.message }, error.status)
      throw error
    }
  },
})
