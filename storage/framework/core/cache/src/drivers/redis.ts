// redis-cache-driver.ts
import { BentoCache, bentostore } from 'bentocache'
import { redisDriver } from 'bentocache/drivers/redis'
import { BaseCacheDriver } from './base'

export interface RedisOptions {
  host?: string
  port?: number
  username?: string
  password?: string
  db?: number
  tls?: boolean
}

export class RedisCacheDriver extends BaseCacheDriver {
  constructor(options: RedisOptions = {}) {
    const client = new BentoCache({
      default: 'redis',
      stores: {
        redis: bentostore().useL2Layer(
          redisDriver({
            connection: {
              host: options.host ?? '127.0.0.1',
              port: options.port ?? 6379,
              ...(options.username && { username: options.username }),
              ...(options.password && { password: options.password }),
              ...(options.db !== undefined && { db: options.db }),
              ...(options.tls && { tls: {} }),
            },
          }),
        ),
      },
    })

    super(client)
  }
}

// Export a singleton instance with default config
export const redis: RedisCacheDriver = new RedisCacheDriver()
