# Redis invalidation hints

`createRedisInvalidationBus` provides explicit, metadata-only hints between
workers. Pass a shared worker bus to `createBroadcastResponse` to wake an
HTTP/SSE client after another worker commits application state. Existing callers
that omit `invalidations` keep their local broadcast wire format and behavior.
There is no automatic forwarding of broadcast bodies, message text or files.

```ts
import { createRedisInvalidationBus, createBroadcastResponse } from '@stacksjs/realtime'

// One shared bus per worker, from operator-owned server configuration.
const invalidations = createRedisInvalidationBus({
  url: process.env.REDIS_URL!,
  namespace: 'supporthq:production',
})

// Domain worker, only after its SQL transaction/outbox has committed:
await invalidations.publish(serverSelectedChannel)

// HTTP handler: select channels using current authoritative ownership/grants.
return createBroadcastResponse({
  channels: serverSelectedChannels,
  invalidations,
  signal: request.signal,
  authorize: () => currentAccountCanReadTheseChannels(request),
})
```

The bus has `publish(channel)`, `subscribe({channels,onInvalidate,onClose?,signal?})`
(readiness followed by a synchronous idempotent disposer), and `close()`.
`createMemoryInvalidationBus` is a deterministic fake with an explicit `resync()`
control. Neither bus grants channel ownership. The Redis URL and namespace must
never come from a tenant request. Share a bus instead of opening connections per
HTTP consumer, and close it during worker shutdown.

## Protocol and authority

Each logical channel maps to one exact Redis topic containing the required
application/environment namespace and SHA-256 of that channel. There are no
wildcard subscriptions. Redis Pub/Sub does not isolate database numbers: use an
explicit namespace even if cache/queue clients select another Redis database.
See [Redis Pub/Sub scoping and delivery](https://redis.io/docs/latest/develop/pubsub/).
The serialized hint contains only `{v:1,origin:<UUID>,id:<UUID>}`. There is no
transcript, event data, customer identity, credential or logical channel in its
body. Incoming hints must match this schema and be at most 256 bytes.

Only this stream's captured, initially authorized exact channel set is
subscribed. Subscription readiness is awaited, then authorization is checked
again before opening SSE. Hints pass through the existing subscriber-bound
per-event authorization queue; heartbeats also continue checking authority.
The SSE hint is exactly `{channel,event:'invalidated',data:null}`. The client must
re-read authorized domain state or finite SQL replay. A channel label, Redis
message, cursor or `status: 'ready'` is never authority. Revocation closes a
consumer even during a Redis outage. Abort/close releases its bus references.

## Delivery, bounds and lifecycle

Redis Pub/Sub is at-most-once. A publish result exposes only Redis's subscriber
**connection count**, not end-user delivery, durable acceptance or a receipt.
The publishing worker notifies local subscribers once and ignores its own Redis
echo. A bounded nonce cache suppresses recent remote duplicates; hints may still
repeat or be lost. SQL/domain snapshots and durable outbox receipts remain the
source of truth. A producer-only outage can lose a hint without disconnecting
another API worker; applications still need replay/reconnect or periodic state
refresh. This adapter does not claim durable fan-out or exactly-once delivery.

Each bus owns separate publisher/subscriber Bun clients. It never borrows cache
or queue connections. Offline queues and Bun automatic reconnect are disabled;
one bounded connection attempt and one bounded-backoff timer manage recovery.
Active subscriptions are restored after reconnect acknowledgment and receive a
local `resync` hint, because missed Pub/Sub messages cannot be replayed. Retry
attempt counters and delays are capped; attempts continue while subscriptions
exist until `close()`. Startup/command promises have explicit deadlines. A new
hint-enabled SSE request returns 503 when readiness is unavailable; existing
local traffic can continue during broker loss.

Default bounds: 1024 channels, 1024 subscriptions, 64 pending channel hints per
subscriber, five-second callback deadline, 64 concurrent publishes, and 1024
remembered nonces. Hard maxima are 4096 channels/subscriptions, 1024 pending
hints/publishes, 30-second callback/connect/command deadlines and 10,000 nonces.
Repeated queued hints coalesce; overflow becomes one bounded all-channel resync.
A callback failure/deadline closes that subscription. Existing SSE backpressure
bounds still close slow consumers. Logical unsubscribe is immediate; Redis
UNSUBSCRIBE is synchronized asynchronously. Bus close aborts pending work,
clears retry/deadline timers, closes both owned clients and closes subscribers.

`status` is a readonly getter: `idle`, `connecting`, `ready`, `disconnected` or
`closed`. Ready means the owned pair and requested subscriptions are acknowledged,
not that data reached a browser. Optional `onStatus` receives only these enums.
Core operational paths never log hint bodies, URLs, credentials or Redis errors;
public failures use bounded generic codes. This TCP adapter accepts operator
`redis://`, `rediss://` and `redis+tls://` endpoints. TLS/ACL/managed cluster
configurations need their own deployment qualification.

## Experimental interface and retained evidence

Bun documents native Redis Pub/Sub as experimental. The adapter feature-checks
`RedisClient` and its connection/publish/subscribe/unsubscribe methods before
creating clients. Missing support raises `invalidation_pubsub_unavailable` only
when this explicit factory is used. See the [official Bun Redis API](https://bun.sh/docs/runtime/redis).
Qualified here with **Bun 1.4.4 and Redis 8.8.0**, on a task-owned loopback service.

The official [Redis 8.8.0 source archive](https://download.redis.io/releases/redis-8.8.0.tar.gz)
was compiled in a task-specific temporary tool directory. Its SHA-256 was
`88422181efb0c9c0abba332e3e391d409e1e13714b838931669235e5796f704b`,
matching the [Redis project's published hashes](https://github.com/redis/redis-hashes/blob/master/README).
No shared Redis instance was written, restarted or flushed.

`invalidation-bus.test.ts` covers exact snapshots, subscriber async context,
coalescing/capacity, callback timeout, abort and disposal. `stream-invalidations`
covers initial/post-readiness/event authorization, cleanup, resync and unchanged
local frame bytes. `redis-invalidations` and `redis-invalidation-process` start
an owned Redis binary, validate its process ID at readiness, and exercise
independent publisher/API workers with real HTTP/SSE, malformed/oversized hints,
namespace/echo/nonce isolation, outage, heartbeat revocation while offline,
restart/resubscription resync, and physical unsubscribe. Unsupported capabilities
and readonly status are tested explicitly. No provider accounts are used.

Set `STACKS_TEST_REDIS_BINARY` to an official Redis executable (or make one
available on PATH). The tests start and stop their own isolated loopback service;
they never use a shared `REDIS_URL`. Without a binary, the live fixture cases are
explicitly skipped; the deterministic tests still run. A release/CI qualification
must provide the owned binary and run those cases, not count skips as evidence.
