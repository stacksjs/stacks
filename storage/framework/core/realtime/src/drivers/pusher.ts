import type { Broadcastable, ChannelType, RealtimeDriver } from '@stacksjs/types'
import { config } from '@stacksjs/config'
import { log } from '@stacksjs/logging'
import Pusher from 'pusher'
import { storeWebSocketEvent } from '../ws'

export class PusherDriver implements RealtimeDriver, Broadcastable {
  private pusher: Pusher | null = null
  private isConnectedState = false
  private channels: Map<string, any> = new Map()
  private currentChannel: string = 'default'
  private currentEvent: string = 'message'
  private currentData: any
  private channelType: ChannelType = 'public'
  private shouldExcludeCurrentUser = false

  constructor() {
    if (!config.realtime.pusher?.appId || !config.realtime.pusher?.key || !config.realtime.pusher?.secret) {
      throw new Error('Pusher driver requires appId, key, and secret in realtime configuration')
    }
  }

  async connect(): Promise<void> {
    if (this.pusher) {
      return
    }

    this.pusher = new Pusher({
      appId: config.realtime.pusher?.appId || '',
      key: config.realtime.pusher?.key || '',
      secret: config.realtime.pusher?.secret || '',
      cluster: config.realtime.pusher?.cluster || 'mt1',
      useTLS: config.realtime.pusher?.useTLS ?? true,
    })

    // Store connection event
    await storeWebSocketEvent('success', 'pusher', 'Pusher connection established')

    this.isConnectedState = true
    log.info('Pusher connection established')
  }

  async disconnect(): Promise<void> {
    if (!this.pusher) {
      return
    }

    // Store disconnection event
    await storeWebSocketEvent('disconnection', 'pusher', 'Pusher connection closed')

    this.channels.clear()
    this.pusher = null
    this.isConnectedState = false
    log.info('Pusher connection closed')
  }

  subscribe(channel: string, callback: (data: any) => void): void {
    if (!this.pusher) {
      throw new Error('Pusher not initialized. Call connect() first.')
    }

    this.channels.set(channel, callback)
    log.info(`Subscribed to channel: ${channel}`)
  }

  unsubscribe(channel: string): void {
    if (!this.pusher) {
      throw new Error('Pusher not initialized. Call connect() first.')
    }

    this.channels.delete(channel)
    log.info(`Unsubscribed from channel: ${channel}`)
  }

  publish(channel: string, data: any): void {
    if (!this.pusher) {
      throw new Error('Pusher not initialized. Call connect() first.')
    }

    this.pusher.trigger(channel, 'message', data)
    log.info(`Published to channel: ${channel}`)
  }

  broadcast(channel: string, event: string, data?: any, type: ChannelType = 'public'): void {
    if (!this.pusher) {
      throw new Error('Pusher not initialized. Call connect() first.')
    }

    const channelName = type === 'public' ? channel : `${type}-${channel}`

    this.pusher.trigger(channelName, event, {
      event,
      channel: channelName,
      data,
    })

    log.info(`Broadcasted event "${event}" to ${type} channel: ${channel}`)
  }

  isConnected(): boolean {
    return this.isConnectedState
  }

  // Broadcastable interface implementation
  async broadcastEvent(): Promise<void> {
    if (!this.pusher) {
      await this.connect()
    }

    const channelName = this.channelType === 'public' ? this.currentChannel : `${this.channelType}-${this.currentChannel}`

    if (!this.pusher) {
      throw new Error('Failed to connect to Pusher')
    }

    if (this.shouldExcludeCurrentUser) {
      // In Pusher, we can't exclude the current user directly
      // This is a limitation of Pusher's architecture
      log.warn('Excluding current user is not supported in Pusher driver')
    }

    this.pusher.trigger(channelName, this.currentEvent, {
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

  // Helper method to set event and data
  setEvent(event: string, data?: any): this {
    this.currentEvent = event
    this.currentData = data
    return this
  }
}
