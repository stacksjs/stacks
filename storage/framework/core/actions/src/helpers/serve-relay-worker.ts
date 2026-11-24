import { isIP } from 'node:net'
import process from 'node:process'

interface SocketPeer { address: string, port?: number }

export function serveRelayPort(): number | undefined {
  const port = Number(process.env.STACKS_SERVE_RELAY_PORT)
  if (process.env.STACKS_SERVE_WORKER === '1' && typeof process.send === 'function'
    && Number.isInteger(port) && port > 0 && port <= 65535)
    return port
}

/** Peer data comes from the owning Buddy process, outside the public TCP stream. */
export function installServeRelayWorker(drain: () => void) {
  const peers = new Map<number, { id: number, address: string, port: number }>()
  process.on('message', (message) => {
    if (!message || typeof message !== 'object' || !('type' in message))
      return
    if (message.type === 'stacks:serve-drain') {
      drain()
      return
    }
    if (!('source' in message) || typeof message.source !== 'number' || !('id' in message) || typeof message.id !== 'number')
      return
    if (message.type === 'stacks:serve-peer-close' && peers.get(message.source)?.id === message.id)
      peers.delete(message.source)
    if (message.type === 'stacks:serve-peer' && 'address' in message && typeof message.address === 'string'
      && isIP(message.address) && 'port' in message && typeof message.port === 'number') {
      peers.set(message.source, { id: message.id, address: message.address, port: message.port })
      process.send?.({ type: 'stacks:serve-peer-ready', id: message.id })
    }
  })
  return {
    wrap<T extends SocketPeer>(server: { requestIP: (request: Request) => T | null } | undefined) {
      if (!server)
        return undefined
      return {
        requestIP(request: Request): T | null {
          const peer = server.requestIP(request)
          const forwarded = peer?.address === '127.0.0.1' && peer.port ? peers.get(peer.port) : undefined
          return peer && forwarded ? { ...peer, address: forwarded.address, port: forwarded.port } : peer
        },
      }
    },
  }
}
