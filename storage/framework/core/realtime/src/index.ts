import type { DriverType, RealtimeDriver } from './types'
import { RealtimeFactory } from './factory'

export * from './drivers'

// Convenience function to get a driver instance
export function realtime(type: DriverType = 'socket'): RealtimeDriver {
  return RealtimeFactory.getInstance().getDriver(type)
}
