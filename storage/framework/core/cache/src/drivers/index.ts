// index.ts
import type { CacheDriver } from '@stacksjs/types'
import type { DynamoDBOptions } from './dynamodb'
import type { FileSystemOptions } from './filesystem'
import type { RedisOptions } from './redis'
import { dynamodb, DynamoDBCacheDriver } from './dynamodb'
import { fileSystem, FileSystemCacheDriver } from './filesystem'
import { memory, MemoryCacheDriver } from './memory'
import { redis, RedisCacheDriver } from './redis'

// Map of available drivers
const drivers: Record<string, CacheDriver> = {
  redis,
  fileSystem,
  memory,
  dynamodb,
}

// Get configured driver name with fallback to memory
const driverName = 'memory'

// Select the appropriate driver
const selectedDriver = drivers[driverName] || memory

// Export the selected driver as the default cache implementation
export const cache: CacheDriver = selectedDriver

// Also export individual drivers and base class for direct usage
export { BaseCacheDriver } from './base'
export { dynamodb, DynamoDBCacheDriver, type DynamoDBOptions } from './dynamodb'
export { fileSystem, FileSystemCacheDriver, type FileSystemOptions } from './filesystem'
export { memory, MemoryCacheDriver } from './memory'
export { redis, RedisCacheDriver, type RedisOptions } from './redis'

/**
 * Create a custom cache driver instance with specific options
 */
export function createCache(driver: 'redis', options?: RedisOptions): CacheDriver
export function createCache(driver: 'fileSystem', options?: FileSystemOptions): CacheDriver
export function createCache(driver: 'memory', options?: { maxSize?: number, maxItems?: number }): CacheDriver
export function createCache(driver: 'dynamodb', options?: DynamoDBOptions): CacheDriver
export function createCache(
  driver: 'redis' | 'fileSystem' | 'memory' | 'dynamodb',
  options?: any,
): CacheDriver {
  switch (driver) {
    case 'redis':
      return new RedisCacheDriver(options)
    case 'fileSystem':
      return new FileSystemCacheDriver(options)
    case 'memory':
      return new MemoryCacheDriver(options)
    case 'dynamodb':
      return new DynamoDBCacheDriver(options)
    default:
      return memory
  }
}
