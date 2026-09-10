import type { UserModel } from '@stacksjs/orm'
import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { Gate } from '@stacksjs/auth'
import { commands, hosts } from '~/config/remote'
import { response } from '@stacksjs/router'
import { RemoteCommandError, resolveCommand, resolveHost, runRemoteCommand } from './remote-commands'
import { createSshRunner, loggingAuditSink } from './ssh-runner'

/**
 * Run one configured operation on one configured host (stacksjs/stacks#960).
 *
 * Routed WITHOUT the dashboard's `guard()` helper. That helper drops auth
 * entirely when `APP_ENV` is local, development or test, which for this surface
 * would be an unauthenticated command runner on every developer machine
 * reachable on the network. See `routes/dashboard-api.ts`.
 */
export default new Action({
  name: 'RemoteCommandRunAction',
  description: 'Runs a configured operation on a configured host over SSH.',
  method: 'POST',
  async handle(request: RequestInstance) {
    try {
      // `request.user()` answers `AuthenticatedUser | undefined`; the gate and
      // the audit identity both want the model or an explicit null.
      const user = (await request.user() ?? null) as UserModel | null
      const hostKey = request.get('host')
      const commandKey = request.get('command')

      // Resolved before authorization so the gate is asked about real keys
      // rather than whatever the request said.
      const host = resolveHost(hosts, hostKey)
      const command = resolveCommand(commands, commandKey, host)

      const result = await runRemoteCommand({ hostKey, commandKey }, {
        user,
        hosts,
        commands,
        // The gate receives both keys, so an application can scope by host, by
        // command, or by both. Undefined when the app has not defined it, and
        // `authorize` refuses in that case rather than proceeding.
        authorizer: Gate.has('run-remote-command')
          ? (candidate, forHost, forCommand) => Gate.allows('run-remote-command', candidate, forHost, forCommand)
          : undefined,
        run: createSshRunner(host, command),
        audit: loggingAuditSink,
      })

      return response.json(result)
    }
    catch (error) {
      if (error instanceof RemoteCommandError)
        return response.json({ message: error.message }, error.status)
      throw error
    }
  },
})
