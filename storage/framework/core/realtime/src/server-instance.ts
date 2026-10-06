import type { BroadcastServer, ConnectionAuthorizationResult, ServerConfig, User } from 'ts-broadcasting'
import { Broadcast } from 'ts-broadcasting'
import { recordBroadcast } from './replay-buffer'
import { getWsAuthenticator } from './ws'

let serverInstance: BroadcastServer | null = null
let removeReplayHook: (() => void) | null = null

/**
 * Set the global broadcast server instance.
 *
 * ts-broadcasting's own facade is pointed at it too. `@stacksjs/realtime`
 * re-exports ts-broadcasting, so `broadcast()`, `broadcastToUser()` and
 * `Broadcast.send()` from this package are ts-broadcasting's, and they read
 * the server from `Broadcast.setServer()`, which nothing called. Every one of
 * them threw "Broadcast server not initialized" against a running server -
 * including the ORM, which broadcasts model events through `broadcast()` and
 * logs that error, so no model event ever reached a socket.
 *
 * The replay buffer is installed on the server as a broadcast hook, so
 * every broadcast - `emit()`, `channel()`, `runBroadcast()`, the facade, the
 * legacy `Broadcast` class - is recorded and carries its sequence number to
 * clients as a top-level `seq` field. Recording used to happen only in the
 * legacy class, and the number never left the server.
 */
export function setServer(server: BroadcastServer | null): void {
  removeReplayHook?.()
  removeReplayHook = null

  serverInstance = server
  // The facade takes no null in its types; clearing it is what a stopped
  // server needs, so a later broadcast fails as "not initialized" rather than
  // writing to a closed one.
  Broadcast.setServer(server as BroadcastServer)

  if (server) {
    removeReplayHook = server.addBroadcastHook(({ channel, event, data }) => {
      const seq = recordBroadcast(channel, event, data)
      return seq === null ? undefined : { seq }
    })
  }
}

/**
 * Get the global broadcast server instance
 */
export function getServer(): BroadcastServer | null {
  return serverInstance
}

/**
 * The connection authorizer Stacks gives the broadcast server: the
 * authenticator installed with `setWsAuthenticator()` (read on every
 * upgrade, so one installed after the server started still applies), then
 * any `authorizeConnection` the app passed in its own config.
 */
function stacksConnectionAuthorizer(config: ServerConfig): NonNullable<ServerConfig['authorizeConnection']> {
  return async (req, user) => {
    let accepted: { user?: User | null, data?: Record<string, unknown> } = {}

    const authenticate = getWsAuthenticator()
    if (authenticate) {
      // A throw propagates to ts-broadcasting, which refuses the upgrade
      // with a 500 and logs the error without sending it to the client.
      const result = await authenticate(req)
      if (!result.ok)
        return { ok: false, status: result.status, message: result.message }
      accepted = { user: result.user, data: result.data }
    }

    const resolvedUser = accepted.user !== undefined ? accepted.user : user
    if (config.authorizeConnection) {
      const result = await config.authorizeConnection(req, resolvedUser)
      if (result === true)
        return { ok: true, user: resolvedUser, data: accepted.data } satisfies ConnectionAuthorizationResult
      return result
    }

    return { ok: true, user: resolvedUser, data: accepted.data } satisfies ConnectionAuthorizationResult
  }
}

/**
 * Create and start a new broadcast server.
 *
 * This is the WebSocket endpoint Stacks apps serve (`/app` and `/ws` on the
 * configured host/port), and the authenticator installed with
 * `setWsAuthenticator()` now gates it: it used to be consulted only by
 * `handleWebSocketRequest()`, which nothing called, while this server
 * upgraded every request it got.
 */
export async function createServer(config: ServerConfig): Promise<BroadcastServer> {
  const broadcasting = await import('ts-broadcasting')
  const Server = (broadcasting).BroadcastServer
  const server = new Server({ ...config, authorizeConnection: stacksConnectionAuthorizer(config) })
  await server.start()
  setServer(server)
  return server
}

/**
 * Stop the current broadcast server
 */
export async function stopServer(): Promise<void> {
  if (serverInstance) {
    await serverInstance.stop()
    setServer(null)
  }
}
