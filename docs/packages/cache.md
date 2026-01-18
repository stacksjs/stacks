# Cache Package

A high-performance, type-safe caching library powered by ts-cache, supporting memory and Redis drivers with advanced caching patterns.

## Installation

```bash
bun add @stacksjs/cache
```

## Basic Usage

```typescript
import { cache, createCache, createMemoryCache, createRedisCache } from '@stacksjs/cache'

// Use the default memory cache
await cache.set('key', 'value', 60) // 60 second TTL
const value = await cache.get('key')

// Create a Redis cache
const redisCache = createRedisCache({
  host: 'localhost',
  port: 6379,
  prefix: 'myapp'
})

// Use factory function
const customCache = createCache('memory', { maxKeys: 1000 })
```

## Configuration

### Memory Cache Options

```typescript
import { createMemoryCache } from '@stacksjs/cache'

const cache = createMemoryCache({
  // Default TTL in seconds (0 = no expiration)
  stdTTL: 0,

  // Check period for expired keys (seconds)
  checkPeriod: 600,

  // Maximum number of keys (-1 = unlimited)
  maxKeys: -1,

  // Clone values on get/set (safer but slower)
  useClones: true,

  // Key prefix for namespacing
  prefix: 'myapp:'
})
```

### Redis Cache Options

```typescript
import { createRedisCache } from '@stacksjs/cache'

const cache = createRedisCache({
  // Redis connection URL (overrides host/port)
  url: 'redis://localhost:6379',

  // Or use individual settings
  host: 'localhost',
  port: 6379,
  username: 'default',
  password: 'secret',
  database: 0,

  // Enable TLS
  tls: true,

  // Default TTL in seconds
  stdTTL: 3600,

  // Key prefix
  prefix: 'myapp:'
})
```

## Core Operations

### Getting and Setting

```typescript
// Set a value with TTL (seconds)
await cache.set('user:1', { name: 'John' }, 3600)

// Set forever (no expiration)
await cache.setForever('config', { theme: 'dark' })

// Get a value
const user = await cache.get<User>('user:1')

// Get or set (fetch if missing)
const data = await cache.getOrSet('expensive-data', async () => {
  return await computeExpensiveData()
}, 600)
```

### Checking Existence

```typescript
// Check if key exists
const exists = await cache.has('user:1')

// Check if key is missing
const missing = await cache.missing('user:1')
```

### Deleting

```typescript
// Delete single key
await cache.del('user:1')
// Or use remove
await cache.remove('user:1')

// Delete multiple keys
await cache.del(['user:1', 'user:2', 'user:3'])
await cache.deleteMany(['key1', 'key2'])

// Clear all cache
await cache.flush()
// Or
await cache.clear()
```

### Bulk Operations

```typescript
// Get multiple keys
const values = await cache.mget<User>(['user:1', 'user:2', 'user:3'])
// Returns: { 'user:1': User, 'user:2': User, ... }

// Set multiple keys
await cache.mset([
  { key: 'user:1', value: user1, ttl: 3600 },
  { key: 'user:2', value: user2, ttl: 3600 },
  { key: 'user:3', value: user3 } // Uses default TTL
])
```

### TTL Management

```typescript
// Get TTL of a key (seconds remaining)
const ttl = await cache.getTtl('user:1')

// Update TTL of existing key
await cache.ttl('user:1', 7200) // Extend to 2 hours
```

### Take (Get and Delete)

```typescript
// Get value and remove from cache atomically
const user = await cache.take<User>('user:1')
// Value is now deleted from cache
```

### Listing Keys

```typescript
// Get all keys
const allKeys = await cache.keys()

// Get keys matching pattern
const userKeys = await cache.keys('user:*')
```

## Cache Statistics

```typescript
const stats = await cache.getStats()

console.log(stats.hits)     // Number of cache hits
console.log(stats.misses)   // Number of cache misses
console.log(stats.keys)     // Total number of keys
console.log(stats.size)     // Memory size (if available)
console.log(stats.hitRate)  // Hit rate percentage
```

## Advanced Patterns

### Cache-Aside Pattern

```typescript
import { CacheAsidePattern } from '@stacksjs/cache'

const cacheAside = new CacheAsidePattern(cache, {
  defaultTtl: 3600
})

// Automatically handles cache-aside logic
const user = await cacheAside.get('user:1', async () => {
  return await db.selectFrom('users').where('id', '=', 1).first()
})
```

### Write-Through Pattern

```typescript
import { WriteThroughPattern } from '@stacksjs/cache'

const writeThrough = new WriteThroughPattern(cache, {
  defaultTtl: 3600,
  writeToStore: async (key, value) => {
    // Write to database
    await db.updateTable('users')
      .set(value)
      .where('id', '=', key.split(':')[1])
      .execute()
  }
})

// Updates cache and database
await writeThrough.set('user:1', { name: 'Jane' })
```

### Refresh-Ahead Pattern

```typescript
import { RefreshAheadPattern } from '@stacksjs/cache'

const refreshAhead = new RefreshAheadPattern(cache, {
  ttl: 3600,
  refreshThreshold: 300, // Refresh when TTL < 5 minutes
  fetcher: async (key) => {
    return await fetchDataForKey(key)
  }
})

// Proactively refreshes before expiration
const data = await refreshAhead.get('data:key')
```

### Multi-Level Cache

```typescript
import { MultiLevelPattern } from '@stacksjs/cache'

const l1Cache = createMemoryCache({ maxKeys: 1000 })
const l2Cache = createRedisCache({ host: 'localhost' })

const multiLevel = new MultiLevelPattern([l1Cache, l2Cache], {
  defaultTtl: 3600
})

// Checks L1 first, then L2, populates missing levels
const value = await multiLevel.get('key')
```

## Utility Classes

### Rate Limiter

```typescript
import { RateLimiter } from '@stacksjs/cache'

const limiter = new RateLimiter(cache, {
  points: 100,      // Max requests
  duration: 60,     // Per 60 seconds
  keyPrefix: 'rl:'
})

// Check and consume
const result = await limiter.consume('user:1')
if (result.allowed) {
  // Process request
  console.log(`Remaining: ${result.remainingPoints}`)
} else {
  // Rate limited
  console.log(`Retry after: ${result.retryAfter}ms`)
}
```

### Cache Lock (Distributed Locking)

```typescript
import { CacheLock } from '@stacksjs/cache'

const lock = new CacheLock(cache, {
  lockTimeout: 30000, // 30 seconds
  retryDelay: 100
})

// Acquire lock
const acquired = await lock.acquire('resource:1')
if (acquired) {
  try {
    // Do exclusive work
    await processExclusiveTask()
  } finally {
    await lock.release('resource:1')
  }
}

// Or use with callback
await lock.withLock('resource:1', async () => {
  // Automatically acquires and releases
  await processExclusiveTask()
})
```

### Circuit Breaker

```typescript
import { CircuitBreaker } from '@stacksjs/cache'

const breaker = new CircuitBreaker(cache, {
  failureThreshold: 5,
  recoveryTimeout: 30000
})

// Wrap external calls
const result = await breaker.execute('external-api', async () => {
  return await fetch('https://api.example.com/data')
})

// Check circuit state
const state = await breaker.getState('external-api')
// 'closed' | 'open' | 'half-open'
```

### Cache Invalidation

```typescript
import { CacheInvalidation } from '@stacksjs/cache'

const invalidation = new CacheInvalidation(cache)

// Invalidate by pattern
await invalidation.invalidateByPattern('user:*')

// Invalidate by tags
await cache.set('post:1', data, 3600)
await invalidation.tag('post:1', ['posts', 'user:1:posts'])

// Later, invalidate all tagged items
await invalidation.invalidateByTag('user:1:posts')
```

### Batch Operations

```typescript
import { BatchOperations } from '@stacksjs/cache'

const batch = new BatchOperations(cache)

// Execute multiple operations efficiently
await batch.execute([
  { operation: 'set', key: 'key1', value: 'value1', ttl: 3600 },
  { operation: 'set', key: 'key2', value: 'value2' },
  { operation: 'del', key: 'old-key' }
])
```

### Memoization

```typescript
import { memoize } from '@stacksjs/cache'

// Memoize expensive function
const memoizedFetch = memoize(
  async (userId: number) => {
    return await fetchUserFromDB(userId)
  },
  {
    cache,
    ttl: 3600,
    keyGenerator: (userId) => `user:${userId}`
  }
)

// Subsequent calls use cache
const user1 = await memoizedFetch(1)
const user1Again = await memoizedFetch(1) // From cache
```

## Connection Management

```typescript
// Close connection (important for Redis)
await cache.close()
// Or
await cache.disconnect()

// Access underlying cache manager
const manager = cache.cacheManager
```

## Edge Cases

### Handling Cache Misses

```typescript
// Get returns undefined on miss
const value = await cache.get('non-existent')
if (value === undefined) {
  // Handle cache miss
}

// Or use getOrSet to always have a value
const value = await cache.getOrSet('key', () => 'default', 3600)
```

### Handling Serialization

```typescript
// Complex objects are serialized automatically
await cache.set('user', {
  name: 'John',
  roles: ['admin', 'user'],
  metadata: { lastLogin: new Date() }
})

// Note: Date objects become strings after serialization
const user = await cache.get('user')
// user.metadata.lastLogin is a string, not Date
```

### Handling Large Values

```typescript
// Memory cache with limits
const cache = createMemoryCache({
  maxKeys: 10000,
  // Large values may be truncated or rejected
})

// Consider chunking large data
const largeData = await getLargeData()
const chunks = chunkData(largeData, 1000)
for (let i = 0; i < chunks.length; i++) {
  await cache.set(`data:chunk:${i}`, chunks[i])
}
```

### Redis Connection Failures

```typescript
try {
  await cache.set('key', 'value')
} catch (error) {
  if (error.code === 'ECONNREFUSED') {
    // Redis not available, fall back to memory
    console.warn('Redis unavailable, using fallback')
  }
}
```

## API Reference

### Cache Driver Methods

| Method | Description |
|--------|-------------|
| `get<T>(key)` | Get cached value |
| `set<T>(key, value, ttl?)` | Set cached value |
| `mget<T>(keys)` | Get multiple values |
| `mset(entries)` | Set multiple values |
| `setForever<T>(key, value)` | Set without expiration |
| `getOrSet<T>(key, fetcher, ttl?)` | Get or compute and cache |
| `has(key)` | Check if key exists |
| `missing(key)` | Check if key is missing |
| `del(keys)` | Delete key(s) |
| `remove(key)` | Alias for del |
| `deleteMany(keys)` | Delete multiple keys |
| `clear()` | Clear all cache |
| `flush()` | Alias for clear |
| `keys(pattern?)` | List keys |
| `getTtl(key)` | Get TTL remaining |
| `ttl(key, seconds)` | Update TTL |
| `take<T>(key)` | Get and delete |
| `getStats()` | Get statistics |
| `close()` | Close connection |
| `disconnect()` | Alias for close |

### Factory Functions

| Function | Description |
|----------|-------------|
| `createCache(driver, options)` | Create cache by driver type |
| `createMemoryCache(options)` | Create memory cache |
| `createRedisCache(options)` | Create Redis cache |

### Pattern Classes

| Class | Description |
|-------|-------------|
| `CacheAsidePattern` | Cache-aside implementation |
| `WriteThroughPattern` | Write-through implementation |
| `RefreshAheadPattern` | Refresh-ahead implementation |
| `MultiLevelPattern` | Multi-level cache |

### Utility Classes

| Class | Description |
|-------|-------------|
| `RateLimiter` | Rate limiting |
| `CacheLock` | Distributed locking |
| `CircuitBreaker` | Circuit breaker pattern |
| `CacheInvalidation` | Tag-based invalidation |
| `BatchOperations` | Batch cache operations |
