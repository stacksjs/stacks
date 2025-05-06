import type { ChannelType, RealtimeDriver } from './types'
import { config } from '@stacksjs/config'
import { RealtimeFactory } from './factory'

export * from './drivers'
export * from './types'
export * from './ws'

class Realtime {
  private driver: RealtimeDriver

  constructor() {
    this.driver = RealtimeFactory.getInstance().getDriver(config.broadcasting.driver || 'socket')
  }

  // Connect to the realtime service
  async connect(): Promise<void> {
    await this.driver.connect()
  }

  // Disconnect from the realtime service
  async disconnect(): Promise<void> {
    await this.driver.disconnect()
  }

  // Subscribe to a channel
  subscribe(channel: string, callback: (data: any) => void): void {
    this.driver.subscribe(channel, callback)
  }

  // Unsubscribe from a channel
  unsubscribe(channel: string): void {
    this.driver.unsubscribe(channel)
  }

  // Broadcast an event to a channel
  broadcast(channel: string, event: string, data?: any, type: ChannelType = 'public'): void {
    const channelName = type === 'public' ? channel : `${type}-${channel}`
    this.driver.broadcast(channelName, event, data, type)
  }

  // Check if connected to the realtime service
  isConnected(): boolean {
    return this.driver.isConnected()
  }
}

// Export a singleton instance
export const realtime: Realtime = new Realtime()
