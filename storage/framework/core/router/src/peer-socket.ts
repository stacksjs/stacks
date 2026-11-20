/**
 * The socket a request arrived on, port included.
 *
 * bun-router's `peerAddress` keeps only the address. The web application
 * firewall needs the port as well (zig-waf's REMOTE_PORT, which it refuses to
 * take as 0), and Bun's `server.requestIP()` has it. So this records the
 * server the same way bun-router does and asks it for the whole socket
 * address.
 */

import { registerPeerSource as registerRouterPeerSource } from '@stacksjs/bun-router'

interface SocketSource {
  requestIP: (req: Request) => { address: string, port?: number } | null
}

let source: SocketSource | undefined

/**
 * Record the server whose `requestIP()` names request peers, here and in
 * bun-router, so `peerAddress`/`clientAddress` and `peerSocket` agree.
 */
export function registerPeerSource(server: SocketSource | undefined): void {
  if (server)
    source = server
  registerRouterPeerSource(server)
}

/**
 * The address and port on the other end of the request's socket, or `null`
 * when there is no socket: a request built in-process (a test, a proxy calling
 * `handleRequest`) or one that arrived over a Unix socket.
 */
export function peerSocket(req: Request): { address: string, port: number } | null {
  try {
    const peer = source?.requestIP(req)
    return peer && peer.port ? { address: peer.address, port: peer.port } : null
  }
  catch {
    // A request this server did not accept: Bun refuses to name its peer.
    return null
  }
}
