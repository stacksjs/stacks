import { config } from '@stacksjs/config'
import { dynamodb } from './dynamodb'
import { fileSystem } from './filesystem'
import { memory } from './memory'
import { redis } from './redis'

import type { CacheDriver } from './type'

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
