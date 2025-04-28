import { log } from '@stacksjs/logging'
import type { RealtimeDriver } from './base'
import Pusher from 'pusher'

export class PusherDriver implements RealtimeDriver {
  private pusher: Pusher | null = null
  private isConnectedState = false
  private channels: Map<string, any> = new Map()

  constructor(
    private options: {
      appId: string
      key: string
      secret: string
      cluster?: string
      useTLS?: boolean
    }
  ) {}

  async connect(): Promise<void> {
    if (this.pusher) {
      return
    }

    this.pusher = new Pusher({
      appId: this.options.appId,
      key: this.options.key,
      secret: this.options.secret,
      cluster: this.options.cluster || 'mt1',
      useTLS: this.options.useTLS ?? true,
    })

    this.isConnectedState = true
    log.info('Pusher connection established')
  }

  async disconnect(): Promise<void> {
    if (this.pusher) {
      this.channels.clear()
      this.pusher = null
      this.isConnectedState = false
      log.info('Pusher connection closed')
    }
  }

  subscribe(channel: string, callback: (data: any) => void): void {
    if (!this.pusher) {
      throw new Error('Pusher not initialized. Call connect() first.')
    }

    this.pusher.trigger(channel, 'message', callback)
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

  isConnected(): boolean {
    return this.isConnectedState
  }
} 