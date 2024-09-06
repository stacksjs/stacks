import type { DynamoDB } from '@aws-sdk/client-dynamodb'
import type { BentoCache } from 'bentocache'

export type CacheDriver = {
  createTable?: () => Promise<void>
  set: (key: string, value: string, ttl?: number) => Promise<void>
  get: (key: string) => Promise<string | undefined | null>
  remove: (key: string) => Promise<void>
  del: (key: string) => Promise<void>
  client: DynamoDB
}

export type RedisCacheDriver = {
  set: (key: string, value: string, ttl?: number) => Promise<void>
  setForever: (key: string, value: string, ttl?: number) => Promise<void>
  get: (key: string) => Promise<string | undefined | null>
  remove: (key: string) => Promise<void>
  has: (key: string) => Promise<boolean>
  missing: (key: string) => Promise<boolean>
  del: (key: string) => Promise<void>
  deleteMany: (keys: string[]) => Promise<void>
  deleteAll: () => Promise<void>
  disconnect: () => Promise<void>
  client: BentoCache<Record<string, any>>
}
