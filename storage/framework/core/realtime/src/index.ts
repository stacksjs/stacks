export * from './drivers'
import type { RealtimeDriver } from './drivers/base'
import { RealtimeFactory } from './factory'
import type { DriverType } from './factory'

// Convenience function to get a driver instance
export function realtime(type: DriverType = 'socket'): RealtimeDriver {
  return RealtimeFactory.getInstance().getDriver(type)
}
