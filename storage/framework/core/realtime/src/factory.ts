import type { DriverType, RealtimeDriver } from '@stacksjs/types'
import { BunSocket } from './drivers/bun'
import { PusherDriver } from './drivers/pusher'
import { SocketDriver } from './drivers/socket'

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

  getDriver(type: DriverType): RealtimeDriver {
    if (!this.drivers.has(type)) {
      switch (type) {
        case 'socket':
          this.drivers.set(type, new SocketDriver())
          break
        case 'pusher':
          this.drivers.set(type, new PusherDriver())
          break
        case 'bun':
          this.drivers.set(type, new BunSocket())
          break
        default:
          throw new Error(`Unsupported driver type: ${type}`)
      }
    }

    const driver = this.drivers.get(type)

    if (!driver) {
      throw new Error(`Driver not found for type: ${type}`)
    }

    return driver
  }
}
