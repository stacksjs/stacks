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
  _type: 'disconnection' | 'error' | 'success',
  _socket: string,
  _details: string,
): Promise<void> {
  // WebSocket events are tracked internally by ts-broadcasting's monitoring system
  // This function is kept for backward compatibility
}

/**
 * Optional authenticator invoked at WebSocket handshake time.
 *
 * Apps install one via `setWsAuthenticator(fn)` to require a valid
 * token / cookie / signed query param BEFORE the upgrade goes through
 * (stacksjs/stacks#1877 R-1). Without an authenticator, the upgrade
 * proceeds as before — useful for local-dev / public-broadcast apps,
 * but production apps should always install one.
 *
 * The returned `data` is attached to the upgraded socket as `ws.data`
 * so per-message authorization can read it back without re-parsing
 * the auth token on every frame.
 */
export type WsAuthenticator = (req: Request) => Promise<WsAuthResult> | WsAuthResult

/** Result returned from a `WsAuthenticator`. */
export type WsAuthResult =
  | { ok: true, data?: Record<string, unknown> }
  | { ok: false, status?: number, message?: string }

let wsAuthenticator: WsAuthenticator | null = null

/**
 * Install (or clear) the global WebSocket authenticator. Called once
 * at server boot; pass `null` to disable auth (the unauthed default).
 */
export function setWsAuthenticator(fn: WsAuthenticator | null): void {
  wsAuthenticator = fn
}

/** Read the currently-installed authenticator. Useful for tests. */
export function getWsAuthenticator(): WsAuthenticator | null {
  return wsAuthenticator
}

/**
 * Handle WebSocket request upgrade. If an authenticator is installed
 * (see `setWsAuthenticator`), it runs FIRST and a 401 is returned on
 * failure (stacksjs/stacks#1877 R-1). Without an authenticator the
 * upgrade proceeds for backwards-compat — the function still works
 * the same way it did before.
 */
export async function handleWebSocketRequest(req: Request, server: Server<any>): Promise<Response | undefined> {
  const broadcastServer = getServer()

  if (!broadcastServer) {
    return new Response('WebSocket server not initialized', { status: 500 })
  }

  // Authentication at the upgrade boundary, BEFORE the socket is
  // established. Without this, ts-broadcasting's per-channel auth
  // ran only after the connection was open — meaning an attacker
  // could establish a socket, subscribe to public channels, and
  // burn server resources without ever presenting a credential.
  if (wsAuthenticator) {
    try {
      const result = await wsAuthenticator(req)
      if (!result.ok) {
        return new Response(
          result.message ?? 'Unauthorized',
          { status: result.status ?? 401 },
        )
      }
      // Pass the auth data through to the upgraded socket so
      // downstream handlers (channel auth callbacks, presence
      // tracking) can read it via `ws.data` without re-parsing.
      const upgraded = server.upgrade(req, result.data ? { data: result.data } : undefined)
      if (upgraded) return undefined
      return new Response('WebSocket upgrade failed', { status: 400 })
    }
    catch (err) {
      // Don't expose internals to the client — log and 500.
      // eslint-disable-next-line no-console
      console.error('[realtime] WebSocket authenticator threw:', err)
      return new Response('WebSocket auth error', { status: 500 })
    }
  }

  // No authenticator installed — preserve the original behavior.
  const success = server.upgrade(req)
  if (success) return undefined
  return new Response('WebSocket upgrade failed', { status: 400 })
}
