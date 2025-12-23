import type { BroadcastServer, ServerConfig } from 'ts-broadcasting'

let serverInstance: BroadcastServer | null = null

/**
 * Set the global broadcast server instance
 */
export function setServer(server: BroadcastServer): void {
  serverInstance = server
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
  const { BroadcastServer: Server } = await import('ts-broadcasting')
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
    serverInstance = null
  }
}
