import type { RealtimeDriver } from '../types'
import { log } from '@stacksjs/logging'
import type { Server, ServerWebSocket } from 'bun'

export interface WebSocketConfig {
  message: (ws: ServerWebSocket, message: string | ArrayBuffer | Uint8Array) => void
  open: (ws: ServerWebSocket) => void
  close: (ws: ServerWebSocket, code: number, reason: string) => void
  error: (ws: ServerWebSocket, error: Error) => void
  drain: (ws: ServerWebSocket) => void
  maxPayloadLength: number
  idleTimeout: number
  backpressureLimit: number
  closeOnBackpressureLimit: boolean
  sendPings: boolean
  publishToSelf: boolean
}

export class BunSocket implements RealtimeDriver {
  private server: Server | null = null
  private isConnectedState = false
  private subscribers: Map<string, Set<(data: any) => void>> = new Map()

  constructor() {}

  async connect(): Promise<void> {
    if (this.server) {
      return
    }

    this.isConnectedState = true
  }

  async disconnect(): Promise<void> {
    if (this.server) {
      this.server = null
      this.isConnectedState = false
    }
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

  isConnected(): boolean {
    return this.isConnectedState
  }

  getWebSocketConfig(): WebSocketConfig {
    return {
      message: (ws: ServerWebSocket, message: string | ArrayBuffer | Uint8Array): void => {
        try {
          const data = typeof message === 'string' ? JSON.parse(message) : message
          const channel = data.channel
          const subscribers = this.subscribers.get(channel)
          
          if (subscribers) {
            subscribers.forEach(callback => callback(data))
          }
        } catch (error) {
          log.error('Error processing WebSocket message:', error)
        }
      },

      open: (ws: ServerWebSocket): void => {
        log.info('Client connected:', ws.remoteAddress)
      },

      close: (ws: ServerWebSocket, code: number, reason: string): void => {
        log.info('Client disconnected:', ws.remoteAddress, code, reason)
      },

      error: (ws: ServerWebSocket, error: Error): void => {
        log.error('WebSocket error:', error)
      },

      drain: (ws: ServerWebSocket): void => {
        log.info('WebSocket drain:', ws.remoteAddress)
      },

      maxPayloadLength: 16 * 1024 * 1024, // 16 MB
      idleTimeout: 120, // 120 seconds
      backpressureLimit: 1024 * 1024, // 1 MB
      closeOnBackpressureLimit: false,
      sendPings: true,
      publishToSelf: false,
    }
  }
}
