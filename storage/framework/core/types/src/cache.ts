import type { GetOptions } from 'bentocache/types'

export interface CacheOptions {
  /**
   * **Cache Driver**
   *
   * This value determines the cache driver that will be used by your application to store
   * cached data. By default, Stacks uses the "redis" driver, which stores cached data in
   * in a self-configufed Redis instance. You may use any of the other drivers provided
   * by Stacks or write your own custom driver.
   *
   * @default "redis"
   * @example "redis"
   * @example "memcached"
   * @example "dynamodb"
   *
   * @see https://stacks.js.org/docs/cache
   */
  driver: string

  /**
   * **Cache Prefix**
   *
   * This value determines the prefix that will be used when storing items in the cache. This
   * prefix may be useful when multiple applications are sharing the same cache driver so that
   * they may avoid collisions when attempting to retrieve items from the cache.
   *
   * @default string "stacks"
   * @example "stacks"
   *
   * @see https://stacks.js.org/docs/cache
   */
  prefix: string

  /**
   * **Cache TTL**
   *
   * This value determines the default time to live for items stored in the cache. This value
   * may be overridden when storing items in the cache. If no value is specified, the cache
   * driver will default to a reasonable time to live for the given item.
   *
   * @default number 3600
   * @example 3600
   * @example 3600 * 24
   * @example -1 (never expires)
   */
  ttl: number

  drivers: {
    redis?: {
      connection: string

      /**
       * **Redis Host**
       *
       * This value determines the host that will be used to connect to the Redis server.
       *
       * @default string "localhost"
       * @example "localhost"
       */
      host: string

      /**
       * **Redis Port**
       *
       * This value determines the port that will be used to connect to the Redis server.
       *
       * @default number 6379
       * @example 6379
       */
      port: number

      /**
       * **Redis Username**
       *
       * This value determines the username that will be used to connect to the Redis server.
       *
       * @default string ""
       * @example "admin"
       */
      username: string

      /**
       * **Redis Password**
       *
       * This value determines the password that will be used to connect to the Redis server.
       *
       * @default string ""
       * @example "password"
       */
      password: string
    }

    memcached?: object

    dynamodb?: {
      key: string
      secret: string
      region: string
      table: string
      endpoint: string
    }
  }
}

export type CacheConfig = Partial<CacheOptions>

export interface CacheDriver {
  set: (key: string, value: string, ttl?: number) => Promise<void>
  setForever: (key: string, value: string, ttl?: number) => Promise<void>
  get: <T> (key: GetOptions<T>) => Promise<T>
  getOrSet: <T> (key: string, value: T) => Promise<T>
  remove: (key: string) => Promise<void>
  has: (key: string) => Promise<boolean>
  missing: (key: string) => Promise<boolean>
  del: (key: string) => Promise<void>
  deleteMany: (keys: string[]) => Promise<void>
  clear: () => Promise<void>
  deleteAll: () => Promise<void>
  disconnect: () => Promise<void>
}
