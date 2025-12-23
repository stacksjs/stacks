import type { Server } from 'bun'
import type { BroadcastServer } from 'ts-broadcasting'
import { getServer, setServer } from './server-instance'

/**
 * Set the broadcast server instance
 * @deprecated Use setServer from './server-instance' instead
 */
export function setBunSocket(server: BroadcastServer | null): void {
  if (server) {
    setServer(server)
  }
}

/**
 * Store WebSocket event in the database
 * Note: This function is now a no-op. WebSocket events are tracked internally by ts-broadcasting.
 */
export async function storeWebSocketEvent(
  type: 'disconnection' | 'error' | 'success',
  socket: string,
  details: string,
): Promise<void> {
  // WebSocket events are tracked internally by ts-broadcasting's monitoring system
  // This function is kept for backward compatibility
}

/**
 * Handle WebSocket request upgrade
 * This is now handled internally by ts-broadcasting's BroadcastServer
 *
 * @deprecated Use BroadcastServer from ts-broadcasting instead
 */
export async function handleWebSocketRequest(req: Request, server: Server): Promise<Response | undefined> {
  const broadcastServer = getServer()

  if (!broadcastServer) {
    return new Response('WebSocket server not initialized', { status: 500 })
  }

  // The upgrade is handled by ts-broadcasting's server
  // This function is kept for backward compatibility
  const success = server.upgrade(req)

  if (success) {
    return undefined
  }

  return new Response('WebSocket upgrade failed', { status: 400 })
}
