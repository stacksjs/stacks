import type { Server } from 'bun'
import { config } from '@stacksjs/config'
import { BunSocket } from './drivers/bun'

let bunSocket: BunSocket | null = null

export function setBunSocket(socket: BunSocket | null): void {
  bunSocket = socket
}

export async function handleWebSocketRequest(req: Request, server: Server): Promise<Response | undefined> {
  if (!bunSocket) 
    return new Response('WebSocket driver not initialized', { status: 500 })

  const success = server.upgrade(req)
  return success
    ? undefined
    : new Response('WebSocket upgrade failed', { status: 400 })
}
