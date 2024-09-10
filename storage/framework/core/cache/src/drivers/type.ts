import type { BentoCache } from 'bentocache'

export type CacheDriver = {
  set: (key: string, value: string, ttl?: number) => Promise<void>
  setForever: (key: string, value: string, ttl?: number) => Promise<void>
  get: (key: string) => Promise<string | undefined | null>
  getOrSet: (key: string, value: string) => Promise<string | undefined | null>
  remove: (key: string) => Promise<void>
  has: (key: string) => Promise<boolean>
  missing: (key: string) => Promise<boolean>
  del: (key: string) => Promise<void>
  deleteMany: (keys: string[]) => Promise<void>
  clear: (keys: string[]) => Promise<void>
  deleteAll: () => Promise<void>
  disconnect: () => Promise<void>
  client: BentoCache<Record<string, any>>
}
