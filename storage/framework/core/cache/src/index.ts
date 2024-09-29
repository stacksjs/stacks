import { config } from '@stacksjs/config'
import { dynamodb, fileSystem, memory, redis } from './drivers'
import type { CacheDriver } from './drivers/type'

const driver = config.cache.driver || 'memory'

let driverInstance = fileSystem

if (driver === 'redis') {
  driverInstance = redis
}

if (driver === 'fileSystem') {
  driverInstance = fileSystem
}

if (driver === 'memory') {
  driverInstance = memory
}

if (driver === 'dynamodb') {
  driverInstance = dynamodb
}

export const cache: CacheDriver = driverInstance
