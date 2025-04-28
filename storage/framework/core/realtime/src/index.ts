import type { RealtimeDriver } from './types'
import { config } from '@stacksjs/config'
import { RealtimeFactory } from './factory'

export * from './drivers'

// Convenience function to get a driver instance
export function realtime(): RealtimeDriver {
  return RealtimeFactory.getInstance().getDriver(config.broadcasting.driver || 'socket')
}
