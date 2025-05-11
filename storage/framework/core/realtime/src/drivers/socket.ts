import type { Broadcastable, ChannelType, RealtimeDriver } from '@stacksjs/types'
import { config } from '@stacksjs/config'
import { log } from '@stacksjs/logging'
import { Server } from 'socket.io'
import { storeWebSocketEvent } from '../ws'

export class SocketDriver implements RealtimeDriver, Broadcastable {
  private io: Server | null = null
  private isConnectedState = false
  private currentChannel: string = 'default'
  private currentEvent: string = 'message'
  private currentData: any
  private channelType: ChannelType = 'public'
  private shouldExcludeCurrentUser = false
  private options = {
    port: config.realtime?.socket?.port,
    host: config.realtime?.socket?.host,
  }

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

    this.io.on('connection', async (socket) => {
      log.info('Client connected:', socket.id)

      // Store connection event
      await storeWebSocketEvent('success', socket.id, 'Socket.IO connection established')

      socket.on('disconnect', async () => {
        log.info('Client disconnected:', socket.id)

        // Store disconnection event
        await storeWebSocketEvent('disconnection', socket.id, 'Socket.IO connection closed')
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

    if (this.shouldExcludeCurrentUser) {
      this.io.to(channelName).emit(event, {
        event,
        channel: channelName,
        data,
      })
    }
    else {
      this.io.emit(event, {
        event,
        channel: channelName,
        data,
      })
    }

    log.info(`Broadcasted event "${event}" to ${type} channel: ${channel}`)
  }

  isConnected(): boolean {
    return this.isConnectedState
  }

  async broadcastEvent(): Promise<void> {
    if (!this.io) {
      await this.connect()
    }

    const channelName = this.channelType === 'public' ? this.currentChannel : `${this.channelType}-${this.currentChannel}`

    if (!this.io) {
      throw new Error('Failed to connect to Socket.IO server')
    }

    if (this.channelType !== 'public') {
      const room = this.io.sockets.adapter.rooms.get(channelName)
      if (!room) {
        log.warn(`No clients connected to ${this.channelType} channel: ${this.currentChannel}`)
        return
      }
    }

    this.io.to(channelName).emit(this.currentEvent, {
      event: this.currentEvent,
      channel: channelName,
      data: this.currentData,
    })

    log.info(`Broadcasted event "${this.currentEvent}" to ${this.channelType} channel: ${this.currentChannel}`)
  }

  async broadcastEventNow(): Promise<void> {
    await this.broadcastEvent()
  }

  setChannel(channel: string): this {
    this.currentChannel = channel
    return this
  }

  excludeCurrentUser(): this {
    this.shouldExcludeCurrentUser = true
    return this
  }

  setPresenceChannel(): this {
    this.channelType = 'presence'
    return this
  }

  setPrivateChannel(): this {
    this.channelType = 'private'
    return this
  }

  setEvent(event: string, data?: any): this {
    this.currentEvent = event
    this.currentData = data
    return this
  }
}
