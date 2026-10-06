import type { User } from 'ts-broadcasting'

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
 * (stacksjs/stacks#1877 R-1). It gates the broadcast server
 * `createServer()` starts, and is read on every upgrade, so it applies
 * whether it is installed before or after the server starts. Without
 * one, every upgrade proceeds - fine for local dev or public-only
 * broadcasting, but production apps should install one.
 *
 * On success, `user` becomes `socket.data.user` and `data` becomes
 * `socket.data.data` on the upgraded socket, which is what channel
 * authorization callbacks (`Broadcast.channel('private-orders.{id}',
 * (socket, params) => ...)`) read. Channel authorization still decides
 * who may join each private/presence channel; this decides who may
 * connect at all.
 */
export type WsAuthenticator = (req: Request) => Promise<WsAuthResult> | WsAuthResult

/** Result returned from a `WsAuthenticator`. */
export type WsAuthResult =
  | { ok: true, user?: User, data?: Record<string, unknown> }
  | { ok: false, status?: number, message?: string }

let wsAuthenticator: WsAuthenticator | null = null

/**
 * Install (or clear) the global WebSocket authenticator. Pass `null`
 * to disable auth (the unauthed default). A refusal answers the
 * upgrade with `status` (default 401) and `message` (default
 * 'Unauthorized'); an authenticator that throws refuses it with a 500
 * and the error is logged, never sent to the client.
 */
export function setWsAuthenticator(fn: WsAuthenticator | null): void {
  wsAuthenticator = fn
}

/** Read the currently-installed authenticator. Useful for tests. */
export function getWsAuthenticator(): WsAuthenticator | null {
  return wsAuthenticator
}
