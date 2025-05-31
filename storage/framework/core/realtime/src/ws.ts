import type { Server } from 'bun'
import type { BunSocket } from './drivers/bun'
import { db } from '@stacksjs/database'
import { log } from '@stacksjs/logging'

let bunSocket: BunSocket | null = null

export function setBunSocket(socket: BunSocket | null): void {
  bunSocket = socket
}

/**
 * Store WebSocket event in the database
 */
export async function storeWebSocketEvent(type: 'disconnection' | 'error' | 'success', socket: string, details: string): Promise<void> {
  try {
    await db.insertInto('websockets').values({
      type,
      socket,
      details,
      time: new Date().getTime(),
    })
  }
  catch (error) {
    log.error('Failed to store WebSocket event:', error)
  }
}

export async function handleWebSocketRequest(req: Request, server: Server): Promise<Response | undefined> {
  if (!bunSocket)
    return new Response('WebSocket driver not initialized', { status: 500 })

  const success = server.upgrade(req)

  if (success) {
    // Store successful connection
    const socketId = Math.random().toString(36).slice(2) // Generate a unique socket ID
    await storeWebSocketEvent('success', socketId, 'WebSocket connection established')
    return undefined
  }

  // Store failed connection
  await storeWebSocketEvent('error', 'unknown', 'WebSocket upgrade failed')
  return new Response('WebSocket upgrade failed', { status: 400 })
}
