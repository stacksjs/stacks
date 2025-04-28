import type { DriverType, RealtimeDriver } from './types'
import { RealtimeFactory } from './factory'
import { config } from '@stacksjs/config'

export * from './drivers'

// Convenience function to get a driver instance
export function realtime(): RealtimeDriver {
  return RealtimeFactory.getInstance().getDriver(config.broadcasting.driver || 'socket')
}
