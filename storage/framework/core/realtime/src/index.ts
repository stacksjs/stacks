import type { Broadcastable, BroadcastConfig, ChannelType, RealtimeDriver } from './types'
import { config } from '@stacksjs/config'
import { log } from '@stacksjs/cli'
import { RealtimeFactory } from './factory'
import { appPath } from '@stacksjs/path'

export * from './drivers'
export * from './types'
export * from './ws'

export class Realtime {
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

export async function runBroadcast(name: string, payload?: any): Promise<void> {
  const broadcastModule = await import(appPath(`Broadcasts/${name}.ts`))
  const broadcast = broadcastModule.default as BroadcastConfig

  if (broadcast.handle) {
    await broadcast.handle(payload)
    return
  }

  // If no handle, try to execute the module directly
  if (typeof broadcastModule.default === 'function') {
    await broadcastModule.default(payload)
    return
  }

  // Try to execute the file itself if it exports a function
  const possibleFunction = Object.values(broadcastModule).find(exp => typeof exp === 'function')
  if (possibleFunction) {
    await possibleFunction(payload)
    return
  }

  throw new Error(`Broadcast ${name} must export a function or define a handle function`)
}