import type { BroadcastServer, ServerConfig } from 'ts-broadcasting'
import { Broadcast } from 'ts-broadcasting'

let serverInstance: BroadcastServer | null = null

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
 */
export function setServer(server: BroadcastServer | null): void {
  serverInstance = server
  // The facade takes no null in its types; clearing it is what a stopped
  // server needs, so a later broadcast fails as "not initialized" rather than
  // writing to a closed one.
  Broadcast.setServer(server as BroadcastServer)
}

/**
 * Get the global broadcast server instance
 */
export function getServer(): BroadcastServer | null {
  return serverInstance
}

/**
 * Create and start a new broadcast server
 */
export async function createServer(config: ServerConfig): Promise<BroadcastServer> {
  const broadcasting = await import('ts-broadcasting')
  const Server = (broadcasting).BroadcastServer
  const server = new Server(config)
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
