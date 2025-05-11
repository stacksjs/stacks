import type { BroadcastInstance, ChannelType, RealtimeDriver } from '@stacksjs/types'
import { config } from '@stacksjs/config'
import { appPath } from '@stacksjs/path'
import { globSync } from 'tinyglobby'
import { RealtimeFactory } from './factory'

export class Broadcast {
  private driver: RealtimeDriver

  constructor() {
    this.driver = RealtimeFactory.getInstance().getDriver(config.realtime.driver || 'socket')
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
  const broadcastFiles = globSync([appPath('Broadcasts/**/*.ts')], { absolute: true })
  const broadcastFile = broadcastFiles.find(file => file.endsWith(`${name}.ts`))

  if (!broadcastFile)
    throw new Error(`Broadcast ${name} not found`)

  const broadcastModule = await import(broadcastFile)
  const broadcast = broadcastModule.default as BroadcastInstance

  if (broadcast.handle) {
    await broadcast.handle(payload)
    return
  }

  throw new Error(`Broadcast ${name} must define a handle function`)
}

export async function broadcast(name: string, payload?: any): Promise<void> {
  await runBroadcast(name, payload)
}
