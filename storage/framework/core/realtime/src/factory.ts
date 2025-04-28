import type { BroadcastingConfig } from '@stacksjs/types'
import type { RealtimeDriver } from './drivers/base'
import type { DriverType } from './types'
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

  getDriver(type: DriverType, config?: BroadcastingConfig): RealtimeDriver {
    if (!this.drivers.has(type)) {
      switch (type) {
        case 'socket':
          this.drivers.set(type, new SocketDriver(config?.socket))
          break
        case 'pusher':
          this.drivers.set(type, new PusherDriver())
          break
        // Add more cases for other drivers here
        default:
          throw new Error(`Unsupported driver type: ${type}`)
      }
    }

    return this.drivers.get(type)!
  }
}
