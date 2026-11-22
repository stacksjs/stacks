import { join } from 'node:path'
import { stacksHome } from '@stacksjs/path'

/**
 * Where the background daemon keeps its state: `~/.stacks/buddy/`, beside the
 * certificates and the rpx proxy that already live under `~/.stacks`.
 */

/**
 * Raised when the daemon's answers change shape. A client that finds an older
 * daemon running restarts it with its own code; a newer daemon answers an
 * older client the way it always did.
 */
export const DAEMON_PROTOCOL = 4

export function daemonDir(path = ''): string {
  return stacksHome(join('buddy', path))
}

/** The daemon's only way in: a socket file only this user can open. */
export function daemonSocket(): string {
  return daemonDir('daemon.sock')
}

/** Who the running daemon is. Its presence, with a live pid, is the lock. */
export function daemonStateFile(): string {
  return daemonDir('daemon.json')
}

export function daemonLogFile(): string {
  return daemonDir('daemon.log')
}

/** What a project's dashboard printed while the daemon ran it. */
export function dashboardLogFile(projectId: string): string {
  return daemonDir(join('logs', `${projectId}.dashboard.log`))
}

/** First port handed to a project's dashboard; see `reserveProjectPort`. */
export const DASHBOARD_PORT_BASE = 3900

/** A dashboard the daemon started stops itself after this long unused. */
export const DASHBOARD_IDLE_EXIT_MS = 15 * 60 * 1000

/** The daemon stops itself after this long with nothing to look after. */
export const DAEMON_IDLE_EXIT_MS = 30 * 60 * 1000
