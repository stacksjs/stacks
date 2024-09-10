import { config } from '@stacksjs/config'
import { dynamodb, fileSystem, memory, redis } from './drivers'

const driver = config.cache.driver || 'fileSystem'

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

export const cache = driverInstance
