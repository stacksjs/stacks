---
name: stacks-cache
description: Use when implementing caching in Stacks - memory cache, Redis cache, cache-aside pattern (getOrSet), TTL management, cache stats, or cache configuration. Covers @stacksjs/cache and config/cache.ts.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Cache

Use `@stacksjs/cache` for cache-aside reads, explicit TTLs and invalidation.
Read `config/cache.ts` and the selected factory before assuming shared state.

## API and TTL

~~~ts
import { cache } from '@stacksjs/cache'

await cache.set('product:42', { name: 'Widget' }, 60)
const product = await cache.get<{ name: string }>('product:42')
const products = await cache.mget<{ name: string }>(['product:42', 'product:43'])
// mget returns a record keyed by cache key, not an array.
~~~

- TTL is in seconds. Zero means forever; omitted TTL uses the factory's
  stdTTL, which defaults to zero. The exported cache/memory singleton is a
  memory instance with no default expiry. Config's ttl value does not silently
  turn that singleton into a configured Redis instance.
- `setForever` stores without expiry; `getTtl` reads remaining TTL and
  `ttl(key, seconds)` updates it. Missing values are undefined.
- `mset([{ key, value, ttl? }])` writes entries. `del(keyOrKeys)` and
  `deleteMany(keys)` return counts; `remove(key)` returns void.
- `has/missing/take`, `keys(pattern?)`, `getStats`,
  `clear/flush` and `close/disconnect` provide the remaining facade API.
  Consult the driver before relying on take for a distributed atomic claim.

## Cache-aside and concurrent misses

`getOrSet(key, fetcher, ttl?)` computes and stores only on a miss.
`remember(key, ttl, callback)` is its Laravel-style argument order;
`rememberForever(key, callback)` uses TTL zero.

Concurrent misses share a promise within one StacksCache instance. Its bounded
inflight timeout rejects every joined caller and frees that slot for retry.
The underlying fetcher continues running after timeout; this is not cancellation
or a lock shared across worker processes. For a distributed lock, inspect the
re-exported CacheLock contract and selected driver separately.

## Drivers

`createMemoryCache(options?)` accepts stdTTL, checkPeriod, maxKeys, useClones
and prefix. Clone-on-read/write is enabled by default.
`createRedisCache(options?)` accepts URL or host/port/credentials/database/TLS
plus TTL/prefix options. `createSingleStoreCache(options?)` exposes the
experimental SQL-backed cache. `createCache(driver, options?)` selects one
of memory, redis or singlestore.

The `cache` export is the same memory instance as `memory`. Use an explicit
Redis instance for application data that must be shared across processes.
The capability registry proves memory and a versioned Redis core/TTL contract;
TLS/authenticated Redis deployments need separate provider evidence. SingleStore
has no dedicated service conformance matrix. Source:
`storage/framework/core/config/src/capabilities.ts`.

## Tag invalidation and advanced patterns

`StacksCache.tags(['products', 'tenant-7'])` creates a TaggedCache supporting
put/set/setForever, remember/rememberForever, get/has and flush. Its tag index
uses the same backend; process persistence depends on that backend. Tags label
shared keys rather than granting tenant authorization. Construct an explicit
tenant key/prefix as well when isolation matters.

The package also re-exports CacheAsidePattern, MultiLevelPattern,
RefreshAheadPattern, WriteThroughPattern, BatchOperations, CacheInvalidation,
CacheLock, CircuitBreaker, memoize and RateLimiter from ts-cache. Read the
installed upstream types before using these advanced classes; their signatures
are distinct from StacksCache and auth's RateLimiter.

## Source and verification

`storage/framework/core/cache/src/drivers/index.ts` is the facade/factory
contract. `drivers/singlestore.ts` owns the experimental backend.
Retained tests: `ttl.test.ts`, `getorset-timeout.test.ts`,
`tagged-flush-race.test.ts`, `redis-contract.test.ts` and
`cache-factory.test.ts` under `core/cache/tests/`.

## Representation-aware keys

`cacheKey(namespace, dependencies)` creates a deterministic key from named
primitive dependencies. Include owner/tenant scope, content version and every
setting affecting the result (for example privacy, locale or theme). Property
order does not change it; delimiter-containing strings cannot collide. Null
and undefined remain distinct. This constructs identity; it does not observe
settings, grant authorization or invalidate already issued public URLs.
The narrow `@stacksjs/cache/key` entry is pure and browser-bundleable.
