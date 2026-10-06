import { Action } from '@stacksjs/actions/runtime'
import { commands, hosts } from '~/config/remote'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'RemoteCommandIndexAction',
  description: 'Lists the hosts and operations the dashboard is configured to run.',
  method: 'GET',
  async handle() {
    // The registry, not the credentials. `identityFile` and `knownHosts` are
    // deliberately not returned: a listing endpoint should not disclose which
    // key file a server uses or the fingerprint an attacker would need to
    // impersonate.
    return response.json({
      hosts: hosts.map(host => ({
        key: host.key,
        host: host.host,
        user: host.user,
        port: host.port ?? 22,
        // Whether the host allows terminal sessions at all. Whether this
        // user may open one is the `open-remote-terminal` gate's call.
        terminal: host.terminal === true,
      })),
      commands: commands.map(command => ({
        key: command.key,
        description: command.description,
        argv: command.argv,
        hosts: command.hosts ?? null,
      })),
    })
  },
})
