import type { ChannelType, RealtimeDriver } from '../types'
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

      socket.on('subscribe', (channel: string) => {
        if (channel.startsWith('private-') || channel.startsWith('presence-')) {
          socket.join(channel)
          log.info(`Client ${socket.id} joined ${channel}`)
        }
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

  broadcast(channel: string, event: string, data?: any, type: ChannelType = 'public'): void {
    if (!this.io) {
      throw new Error('Socket.IO server not initialized. Call connect() first.')
    }

    const channelName = type === 'public' ? channel : `${type}-${channel}`

    if (type !== 'public') {
      const room = this.io.sockets.adapter.rooms.get(channelName)
      if (!room) {
        log.warn(`No clients connected to ${type} channel: ${channel}`)
        return
      }
    }

    this.io.to(channelName).emit(event, {
      event,
      channel: channelName,
      data,
    })

    log.info(`Broadcasted event "${event}" to ${type} channel: ${channel}`)
  }

  isConnected(): boolean {
    return this.isConnectedState
  }
}
