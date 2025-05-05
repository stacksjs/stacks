import type { Server } from 'bun'
import { config } from '@stacksjs/config'
import { BunSocket } from './drivers/bun'

let bunSocket: BunSocket | null = null

export function setBunSocket(socket: BunSocket | null): void {
  bunSocket = socket
}

export async function handleWebSocketRequest(req: Request, server: Server): Promise<Response | undefined> {
  const driver = config.broadcasting?.driver || 'socket'
  
  switch (driver) {
    case 'bun':
      if (!bunSocket) return new Response('WebSocket driver not initialized', { status: 500 })
      const success = server.upgrade(req)
      return success
        ? undefined
        : new Response('WebSocket upgrade failed', { status: 400 })
    
    case 'socket':
      // Socket.IO handles its own upgrade
      return new Response('Switching to Socket.IO', { status: 101 })
    
    case 'pusher':
      // Pusher handles WebSocket connections on their servers
      return new Response('Use Pusher client', { status: 400 })
    
    default:
      return new Response(`Unsupported WebSocket driver: ${driver}`, { status: 400 })
  }
}
