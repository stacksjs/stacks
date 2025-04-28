import type { RealtimeDriver } from './drivers/base'
import { SocketDriver } from './drivers/socket'
import { PusherDriver } from './drivers/pusher'

export type DriverType = 'socket' | 'pusher' // Add more driver types as needed

export class RealtimeFactory {
  private static instance: RealtimeFactory
  private drivers: Map<DriverType, RealtimeDriver> = new Map()

  private constructor() {}

  static getInstance(): RealtimeFactory {
    if (!RealtimeFactory.instance) {
      RealtimeFactory.instance = new RealtimeFactory()
    }
    return RealtimeFactory.instance
  }

  getDriver(type: DriverType, options?: any): RealtimeDriver {
    if (!this.drivers.has(type)) {
      switch (type) {
        case 'socket':
          this.drivers.set(type, new SocketDriver(options))
          break
        case 'pusher':
          if (!options?.appId || !options?.key || !options?.secret) {
            throw new Error('Pusher driver requires appId, key, and secret options')
          }
          this.drivers.set(type, new PusherDriver(options))
          break
        // Add more cases for other drivers here
        default:
          throw new Error(`Unsupported driver type: ${type}`)
      }
    }

    return this.drivers.get(type)!
  }
}
