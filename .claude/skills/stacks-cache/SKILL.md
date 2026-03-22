---
name: stacks-cache
description: Use when implementing caching in Stacks — memory cache, Redis cache, cache-aside pattern (getOrSet), TTL management, cache stats, or cache configuration. Covers @stacksjs/cache and config/cache.ts.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Cache

## Key Paths
- Core package: `storage/framework/core/cache/src/`
- Configuration: `config/cache.ts`
- Cache storage: `storage/framework/cache/`

## Cache API (StacksCache)

```typescript
import { cache, memory } from '@stacksjs/cache'

// Get/Set
await cache.get<string>('key')                    // T | undefined
await cache.set('key', 'value', 3600)             // TTL in seconds
await cache.setForever('key', 'value')            // no expiry
await cache.mget<string>(['key1', 'key2'])        // T[]
await cache.mset([{ key: 'k1', value: 'v1', ttl: 60 }, ...])

// Cache-aside pattern
const value = await cache.getOrSet('expensive-key', async () => {
  return await computeExpensiveValue()
}, 3600)

// Delete
await cache.del('key')
await cache.del(['key1', 'key2'])
await cache.deleteMany(['key1', 'key2'])
await cache.remove('key')

// Existence
await cache.has('key')          // boolean
await cache.missing('key')     // boolean

// Take (get and delete)
const value = await cache.take<string>('key')

// TTL management
await cache.getTtl('key')              // remaining TTL
await cache.ttl('key', 7200)           // update TTL

// Clear
await cache.clear()
await cache.flush()

// Stats
const stats = await cache.getStats()
// { hits, misses, keys, size, hitRate }

// Keys
const keys = await cache.keys('user:*')  // pattern matching

// Cleanup
await cache.close()
await cache.disconnect()
```

## Factory Functions

```typescript
import { createMemoryCache, createRedisCache, createCache } from '@stacksjs/cache'

const memCache = createMemoryCache({
  stdTTL: 3600,       // default TTL (seconds)
  checkPeriod: 120,   // eviction check interval
  maxKeys: -1,        // -1 = unlimited
  useClones: true,    // clone on get/set
  prefix: 'app:'      // key prefix
})

const redisCache = createRedisCache({
  url: 'redis://localhost:6379',
  // or individual:
  host: 'localhost',
  port: 6379,
  username: undefined,
  password: undefined,
  database: 0,
  tls: false,
  stdTTL: 3600,
  prefix: 'app:'
})

// Auto-detect from config
const cache = createCache('memory')
const cache = createCache('redis', { host: 'localhost' })
```

## config/cache.ts
```typescript
{
  driver: 'memory',     // 'memory' | 'redis'
  prefix: 'stacks',
  ttl: 3600,            // 1 hour default
  maxKeys: -1,          // unlimited
  useClones: true,
  drivers: {
    redis: { host: 'localhost', port: 6379 },
    memory: {}
  }
}
```

## Default Instance
- `cache` — default memory cache (pre-configured)
- `memory` — alias for `cache`

## Gotchas
- Default driver is `memory` — data lost on restart
- Redis driver requires a running Redis server
- `getOrSet()` is the cache-aside pattern — fetches only on miss
- `useClones: true` means mutations to retrieved objects don't affect cache
- `take()` atomically gets and deletes — useful for one-time tokens
- Cache stats track hits, misses, and hit rate — useful for tuning
- `keys()` supports glob patterns for key listing
- Framework caches (auto-imports, discovered packages) are in `storage/framework/cache/`
- Use `buddy clean` or `buddy fresh` to clear framework caches
