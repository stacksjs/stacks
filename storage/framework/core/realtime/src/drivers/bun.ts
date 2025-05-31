import type { ChannelType, RealtimeDriver } from '@stacksjs/types'
import type { Server, ServerWebSocket } from 'bun'
import { db } from '@stacksjs/database'
import { log } from '@stacksjs/logging'

interface WebSocketData {
  clientId: string
  subscriptions: Set<string>
}

export class BunSocket implements RealtimeDriver {
  private server: Server | null = null
  private isConnectedState = false
  private subscribers: Map<string, Set<(data: any) => void>> = new Map()

  constructor() {}

  setServer(server: Server): void {
    this.server = server
    this.isConnectedState = true
  }

  async connect(): Promise<void> {
    // Connection is handled by Bun.serve
    this.isConnectedState = true
  }

  async disconnect(): Promise<void> {
    this.isConnectedState = false
    this.subscribers.clear()
  }

  subscribe(channel: string, callback: (data: any) => void): void {
    if (!this.subscribers.has(channel)) {
      this.subscribers.set(channel, new Set())
    }
    this.subscribers.get(channel)?.add(callback)
  }

  unsubscribe(channel: string): void {
    this.subscribers.delete(channel)
  }

  publish(channel: string, data: any): void {
    if (!this.server) {
      throw new Error('WebSocket server not initialized.')
    }

    this.server.publish(channel, JSON.stringify(data))
  }

  broadcast(channel: string, event: string, data?: any, type: ChannelType = 'public'): void {
    if (!this.server) {
      throw new Error('WebSocket server not initialized.')
    }

    const channelName = type === 'public' ? channel : `${type}-${channel}`

    this.server.publish(channelName, JSON.stringify({
      event,
      channel: channelName,
      data,
    }))

    log.info(`Broadcasted event "${event}" to ${type} channel: ${channel}`)
  }

  isConnected(): boolean {
    return this.isConnectedState
  }

  getWebSocketConfig(): {
    open: (ws: ServerWebSocket<WebSocketData>) => void
    message: (ws: ServerWebSocket<WebSocketData>, message: string | ArrayBuffer | Uint8Array) => void
    close: (ws: ServerWebSocket<WebSocketData>) => void
    drain: (ws: ServerWebSocket<WebSocketData>) => void
  } {
    return {
      open: (ws: ServerWebSocket<WebSocketData>): void => {
        ws.data = {
          clientId: Math.random().toString(36).slice(2),
          subscriptions: new Set(),
        }
        log.info('Client connected:', ws.data.clientId)
      },

      message: (ws: ServerWebSocket<WebSocketData>, message: string | ArrayBuffer | Uint8Array): void => {
        try {
          const data = typeof message === 'string' ? JSON.parse(message) : message

          if (data.type === 'subscribe') {
            this.handleSubscription(ws, data.channel)
          }
          else {
            // Handle regular messages
            const subscribers = this.subscribers.get(data.channel)
            if (subscribers) {
              subscribers.forEach(callback => callback(data))
            }
          }
        }
        catch (error) {
          log.error('Error processing WebSocket message:', error)
        }
      },

      close: async (ws: ServerWebSocket<WebSocketData>): Promise<void> => {
        // Unsubscribe from all channels
        ws.data.subscriptions.forEach((channel) => {
          ws.unsubscribe(channel)
        })

        // Store disconnection event
        try {
          await db.insertInto('websockets').values({
            type: 'disconnection',
            socket: ws.data.clientId,
            details: 'WebSocket connection closed',
            time: new Date().toISOString(),
          })
        }
        catch (error) {
          log.error('Failed to store WebSocket disconnection event:', error)
        }

        log.info('Client disconnected:', ws.data.clientId)
      },

      drain: (ws: ServerWebSocket<WebSocketData>): void => {
        log.info('WebSocket drain:', ws.data.clientId)
      },
    }
  }

  private handleSubscription(ws: ServerWebSocket<WebSocketData>, channel: string): void {
    if (channel.startsWith('private-') || channel.startsWith('presence-')) {
      // Here you would implement your authentication logic
      // For now, we'll just allow all subscriptions
      ws.subscribe(channel)
      ws.data.subscriptions.add(channel)
      log.info(`Client ${ws.data.clientId} joined ${channel}`)
    }
    else {
      // Public channels don't need authentication
      ws.subscribe(channel)
      ws.data.subscriptions.add(channel)
      log.info(`Client ${ws.data.clientId} joined ${channel}`)
    }
  }
}
