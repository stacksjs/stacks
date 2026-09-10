import type { RemoteCommand, RemoteHost } from '../storage/framework/defaults/app/Actions/Dashboard/Remote/remote-commands'

/**
 * **Remote Command Configuration**
 *
 * Hosts the dashboard may reach, and the operations it may run on them
 * (stacksjs/stacks#960).
 *
 * **Both lists are empty by default, and that is the safe state.** With no
 * hosts declared, the dashboard's remote endpoints resolve nothing and the
 * surface does not exist. Declaring a host is an explicit decision to let a
 * dashboard user run commands on a server.
 *
 * ## This is not a shell
 *
 * A request names a host KEY and a command KEY. It never carries a hostname or
 * a command, so there is nothing to escape and no shell to reach. The `argv` of
 * a command is an array and is never interpolated - a string would be a shell
 * command, and a shell command with a caller-supplied part in it is an
 * injection.
 *
 * ## Two things a host must have
 *
 * - `knownHosts`, the pinned SSH host key. **Required.** Accepting a key on
 *   first contact is what makes a connection to a long-lived box open to a
 *   man in the middle, and a host declared without its fingerprint is refused
 *   rather than trusted. Get it with `ssh-keyscan -t ed25519 your.host`.
 * - Credentials the app server can use non-interactively. `BatchMode=yes` is
 *   set, so a host that wants a password fails rather than hanging on a prompt
 *   nobody can answer.
 *
 * ## And authorization is separate
 *
 * Declaring a host does not grant anyone access to it. Every run is checked
 * against the `run-remote-command` gate in `app/Gates.ts`, which receives the
 * host and command keys. Without that gate defined, every run is refused.
 */
export const hosts: RemoteHost[] = [
  // {
  //   key: 'app',
  //   host: 'app.example.com',
  //   user: 'deploy',
  //   // ssh-keyscan -t ed25519 app.example.com
  //   knownHosts: 'app.example.com ssh-ed25519 AAAAC3Nz...',
  //   // identityFile: '/home/stacks/.ssh/id_ed25519',
  // },
]

export const commands: RemoteCommand[] = [
  // {
  //   key: 'disk',
  //   description: 'Free space on each mount',
  //   argv: ['df', '-h'],
  // },
  // {
  //   key: 'restart-api',
  //   description: 'Restart the API service',
  //   argv: ['systemctl', 'restart', 'stacks-api'],
  //   // Omit `hosts` to allow every host. Naming them is a deliberate
  //   // restriction: a command scoped away from a host is a 403, not a 404.
  //   hosts: ['app'],
  // },
]

export default { hosts, commands }
