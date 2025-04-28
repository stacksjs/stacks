import type { RealtimeDriver } from '../types'
import { log } from '@stacksjs/logging'
import { Server } from 'socket.io'

export class SocketDriver implements RealtimeDriver {
  private io: Server | null = null
  private isConnectedState = false

  constructor(private options: { port?: number, host?: string } = {}) {}

  async connect(): Promise<void> {
    if (this.io) {
      return
    }

    this.io = new Server({
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
      },
      ...this.options,
    })

    this.io.on('connection', (socket) => {
      log.info('Client connected:', socket.id)

      socket.on('disconnect', () => {
        log.info('Client disconnected:', socket.id)
      })
    })

    this.isConnectedState = true
  }

  async disconnect(): Promise<void> {
    if (this.io) {
      this.io.close()
      this.io = null
      this.isConnectedState = false
    }
  }

  subscribe(channel: string, callback: (data: any) => void): void {
    if (!this.io) {
      throw new Error('Socket.IO server not initialized. Call connect() first.')
    }

    this.io.on('connection', (socket) => {
      socket.on(channel, callback)
    })
  }

  unsubscribe(channel: string): void {
    if (!this.io) {
      throw new Error('Socket.IO server not initialized. Call connect() first.')
    }

    this.io.sockets.removeAllListeners(channel)
  }

  publish(channel: string, data: any): void {
    if (!this.io) {
      throw new Error('Socket.IO server not initialized. Call connect() first.')
    }

    this.io.emit(channel, data)
  }

  isConnected(): boolean {
    return this.isConnectedState
  }
}
