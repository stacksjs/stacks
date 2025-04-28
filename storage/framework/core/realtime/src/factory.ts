import type { RealtimeDriver } from './drivers/base'
import { SocketDriver } from './drivers/socket'

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

  getDriver(type: DriverType): RealtimeDriver {
    if (!this.drivers.has(type)) {
      switch (type) {
        case 'socket':
          this.drivers.set(type, new SocketDriver())
          break
        // Add more cases for other drivers here
        default:
          throw new Error(`Unsupported driver type: ${type}`)
      }
    }

    return this.drivers.get(type)!
  }
}
