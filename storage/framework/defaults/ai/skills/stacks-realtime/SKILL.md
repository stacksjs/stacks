---
name: stacks-realtime
description: Use when implementing real-time features in Stacks - WebSocket broadcasting, public/private/presence channels, emit to users, the Channel class, broadcast discovery, server lifecycle, or realtime configuration. Covers @stacksjs/realtime and config/realtime.ts.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Realtime

WebSocket broadcasting via `ts-broadcasting` with channel-based messaging. Provides a Laravel-like API for real-time features.

## Key Paths
- Core package: `storage/framework/core/realtime/src/`
- Configuration: `config/realtime.ts`
- Application broadcasts: `app/Broadcasts/`

## Source Files
```
realtime/src/
  index.ts            # re-exports ts-broadcasting + all Stacks-specific exports
  emit.ts             # emit(), emitToUser(), emitToUsers()
  channel.ts          # Channel class + channel() factory
  broadcast.ts        # Broadcast class + runBroadcast() + broadcast()
  ws.ts               # setWsAuthenticator() - gates upgrades on the broadcast server
  replay-buffer.ts    # setReplayBuffer() / replaySince() - per-channel replay with seq numbers
  server-instance.ts  # server lifecycle (createServer/getServer/setServer/stopServer)
```

## Exports (from index.ts)

The package re-exports everything from `ts-broadcasting` plus Stacks-specific APIs:

```typescript
// Re-exported from ts-broadcasting
export * from 'ts-broadcasting'

// Server instance management
export { getServer, setServer, createServer, stopServer } from './server-instance'

// Stacks-specific exports
export { emit, emitToUser, emitToUsers } from './emit'
export type { EmitOptions } from './emit'
export { channel as createChannel, Channel as StacksChannel } from './channel'
export { broadcast as dispatchBroadcast, runBroadcast, Broadcast as LegacyBroadcast } from './broadcast'
export type { BroadcastInstance } from './broadcast'
export { debugSnapshot, getReplayBuffer, pruneExpired, recordBroadcast, replaySince, setReplayBuffer } from './replay-buffer'
export { storeWebSocketEvent, setWsAuthenticator, getWsAuthenticator } from './ws'
export type { WsAuthenticator, WsAuthResult } from './ws'
```

Note the renamed exports:
- `channel()` is exported as `createChannel`
- `Channel` class is exported as `StacksChannel`
- `broadcast()` is exported as `dispatchBroadcast`
- `Broadcast` class is exported as `LegacyBroadcast`

---

## Emit Functions

The primary API for broadcasting events.

### `emit(channel, event, data?, options?)` - Broadcast to a channel

```typescript
import { emit, emitToUser, emitToUsers } from '@stacksjs/realtime'

// Broadcast to a public channel
emit('chat-room', 'new-message', { text: 'Hello', sender: 'John' })

// Broadcast to a private channel (auto-prefixes 'private-')
emit('orders', 'updated', { status: 'shipped' }, { private: true })

// Broadcast to a presence channel (auto-prefixes 'presence-')
emit('room-1', 'user-joined', { userId: 42 }, { presence: true })

// Exclude specific socket(s) from receiving - socket IDs (the `socket_id`
// a client gets in `connection_established`), not user IDs. Every ID in an
// array is excluded.
emit('chat', 'typing', data, { exclude: 'socket-id-1' })
emit('chat', 'typing', data, { exclude: ['socket-id-1', 'socket-id-2'] })
```

### EmitOptions interface

```typescript
interface EmitOptions {
  private?: boolean     // prefix channel with 'private-'
  presence?: boolean    // prefix channel with 'presence-'
  exclude?: string | string[]  // socket IDs to exclude (all of them)
  driver?: string       // broadcast driver override
}
```

### `emitToUser(userId, event, data?, options?)` - Emit to specific user

Sends to `private-user.{userId}` channel. The target user must be subscribed to their own private user channel.

```typescript
// Emit to a specific user (sends to 'private-user.42')
emitToUser(42, 'notification', { message: 'You have a new order' })
emitToUser('user-123', 'alert', { type: 'warning', text: 'Session expiring' })
```

### `emitToUsers(userIds, event, data?, options?)` - Emit to multiple users

Iterates over userIds and calls `emitToUser` for each.

```typescript
// Emit to multiple users
emitToUsers([42, 43, 44], 'announcement', { text: 'Server maintenance at 3pm' })
```

---

## Channel Class

Provides a fluent API for broadcasting to channels with explicit channel types.

### `channel(name)` - Factory function

```typescript
import { createChannel } from '@stacksjs/realtime'
// or within the package: import { channel } from './channel'

const ch = createChannel('orders')

// Broadcast to public channel (no prefix)
await ch.public('new-order', { id: 1, total: 99.99 })

// Broadcast to private channel (auto-prefixes 'private-')
await ch.private('status-update', { status: 'shipped' })

// Broadcast to presence channel (auto-prefixes 'presence-')
await ch.presence('user-online', { userId: 42 })

// Broadcast with explicit type
await ch.broadcast('event', data, 'private')   // type: 'public' | 'private' | 'presence'
await ch.broadcast('event', data)              // defaults to 'public'
```

### Channel class internals

```typescript
class Channel {
  private channelName: string

  constructor(channel: string)

  async private(event: string, data?: any): Promise<void>
  // Prefixes with 'private-' if not already prefixed

  async public(event: string, data?: any): Promise<void>
  // Uses channelName as-is

  async presence(event: string, data?: any): Promise<void>
  // Prefixes with 'presence-' if not already prefixed

  async broadcast(event: string, data?: any, type: ChannelType = 'public'): Promise<void>
  // Dispatches to private(), presence(), or public() based on type
}
```

All methods throw `Error('Broadcast server not initialized')` if `getServer()` returns null.

---

## Server Lifecycle

The server instance is stored as a module-level singleton (`serverInstance`).

```typescript
import { createServer, getServer, setServer, stopServer } from '@stacksjs/realtime'
import type { ServerConfig, BroadcastServer } from 'ts-broadcasting'

// Create and start a new broadcast server
// Internally: new BroadcastServer(config) -> server.start() -> setServer(server)
const server: BroadcastServer = await createServer(config)

// Get existing server instance (or null)
const server: BroadcastServer | null = getServer()

// Set server instance manually
setServer(server)

// Stop server and set instance to null
await stopServer()
```

`createServer()` dynamically imports `ts-broadcasting`, instantiates `BroadcastServer`, calls `start()`, stores the instance via `setServer()`, and returns it. That server is the WebSocket endpoint (`/app` and `/ws` on its own host/port); there is no upgrade handler for the app's HTTP server.

### Connection auth

```typescript
import { setWsAuthenticator } from '@stacksjs/realtime'

// Read on every upgrade, so it applies whether installed before or after createServer().
setWsAuthenticator(async (req) => {
  const token = new URL(req.url).searchParams.get('token')
  const user = token ? await verify(token) : null
  if (!user) return { ok: false, status: 401, message: 'Unauthorized' }
  // user -> socket.data.user, data -> socket.data.data (what channel authorizers read)
  return { ok: true, user: { id: user.id }, data: { team: user.team } }
})
```

A refusal answers the upgrade with its status; a throw refuses with a 500 and is logged, not sent. An `authorizeConnection` in the `createServer()` config still runs after it. Per-channel access is still `Broadcast.channel('private-orders.{id}', (socket, params) => ...)`.

`/stats` and `/metrics` are off unless `createServer({ endpoints: { stats: true, metrics: true, token } })`.

### Dead sockets and slow consumers

Bun's own WebSocket options, passed through `createServer()`:

```typescript
await createServer({
  host: '0.0.0.0',
  port: 6001,
  websocket: {
    idleTimeout: 60,                 // Bun pings idle sockets; no pong within this -> closed (rounded up to 4s steps)
    sendPings: true,
    backpressureLimit: 1024 * 1024,
    closeOnBackpressureLimit: true,  // drop a consumer that falls 1 MB behind
  },
})
```

### Replay buffer

```typescript
import { replaySince, setReplayBuffer } from '@stacksjs/realtime'

setReplayBuffer({ channels: ['orders.*'], maxPerChannel: 100, ttlMs: 5 * 60_000 })
```

Every broadcast on a matching channel, from any API, is recorded and reaches clients as `{ event, channel, data, seq }`. Patterns match with or without the `private-`/`presence-` prefix (`orders.*` covers `private-orders.1`); `replaySince()` takes the full name. The client keeps the last `seq` per channel and sends it back after reconnecting (through a route of the app's), which answers with `replaySince('private-orders.1', seq)`. The buffer and its numbering are per process.

---

## Broadcast Discovery

Dynamically loads broadcast files from `app/Broadcasts/` and executes them.

### `runBroadcast(name, payload?)` - Run a broadcast file

```typescript
import { runBroadcast, dispatchBroadcast } from '@stacksjs/realtime'

// Loads app/Broadcasts/OrderStatusChanged.ts and executes it
await runBroadcast('OrderStatusChanged', { orderId: 1 })

// Alias - identical to runBroadcast
await dispatchBroadcast('NewMessage', { text: 'Hello' })
```

### Broadcast file interface

```typescript
interface BroadcastInstance {
  channel?: () => string | string[]       // channels to broadcast on
  broadcastOn?: () => string | string[]   // alias for channel()
  event?: () => string                     // event name
  broadcastAs?: () => string              // alias for event()
  data?: () => any                         // data payload
  broadcastWith?: () => any               // alias for data()
  handle?: (payload?: any) => Promise<void> | void  // custom handler
}
```

### How broadcast discovery works

1. Scans `app/Broadcasts/**/*.ts` using `bun.globSync()`
2. Finds file ending with `{name}.ts`
3. Imports the module and reads its `default` export
4. If `handle()` exists, calls it with the payload and returns
5. Otherwise, reads channel/event/data from the interface methods
6. Constructs a `BroadcastEvent` and calls `server.broadcaster.broadcast(event)`

### Example broadcast file

```typescript
// app/Broadcasts/OrderCreated.ts
export default {
  broadcastOn: () => ['orders', 'private-admin'],
  broadcastAs: () => 'order.created',
  broadcastWith: () => ({ orderId: 123, total: 99.99 }),
}
```

Or with a custom handler:

```typescript
// app/Broadcasts/UserNotification.ts
export default {
  handle: async (payload) => {
    const { emit } = await import('@stacksjs/realtime')
    emit(`private-user.${payload.userId}`, 'notification', {
      message: payload.message,
    }, { private: true })
  },
}
```

---

## Legacy/Backward Compatibility

### Broadcast class (exported as `LegacyBroadcast`)

```typescript
class Broadcast {
  async connect(): Promise<void>       // no-op
  async disconnect(): Promise<void>    // no-op
  subscribe(channel, callback): void   // warns: use BroadcastClient instead
  unsubscribe(channel): void           // warns: use BroadcastClient instead
  broadcast(channel, event, data?, type?): void  // delegates to server.broadcast()
  isConnected(): boolean               // returns getServer() !== null
}
```

### ws.ts

```typescript
storeWebSocketEvent(type, socket, details): Promise<void> // no-op, kept for compatibility
```

---

## config/realtime.ts

Full configuration with all options and their defaults:

```typescript
export default {
  enabled: true,

  // Deployment mode
  mode: 'server' as 'server' | 'serverless',
  // 'server': ts-broadcasting (high-performance Bun WebSocket server)
  // 'serverless': API Gateway WebSocket + Lambda + DynamoDB

  // Legacy driver option (backward compat)
  driver: 'bun' as 'socket' | 'pusher' | 'bun' | 'reverb' | 'ably',

  // Server mode config (ts-broadcasting)
  server: {
    host: env.BROADCAST_HOST || '0.0.0.0',
    port: Number(env.BROADCAST_PORT || 6001),
    scheme: 'ws' as 'ws' | 'wss',
    driver: 'bun',

    redis: {
      enabled: Boolean(env.BROADCAST_REDIS_ENABLED || false),
      host: env.REDIS_HOST || 'localhost',
      port: Number(env.REDIS_PORT || 6379),
      password: env.REDIS_PASSWORD || '',
      prefix: env.BROADCAST_REDIS_PREFIX || 'stacks:realtime:',
    },

    rateLimit: {
      enabled: true,                    // env.BROADCAST_RATE_LIMIT_ENABLED
      maxConnectionsPerIp: 100,
      maxMessagesPerSecond: 50,
      maxPayloadSize: 65536,            // 64KB
      banDuration: 300,                 // seconds
    },

    loadManagement: {
      maxConnections: 10000,
      backpressureThreshold: 1000,
      messageQueueSize: 10000,
      gracefulShutdownTimeout: 30000,   // 30s
    },

    autoScaling: {
      min: 1,
      max: 10,
      targetCPU: 70,                    // percentage
    },

    healthCheck: {
      enabled: true,
      path: '/health',
      interval: 30,                     // seconds
    },

    metrics: {
      enabled: Boolean(env.BROADCAST_METRICS_ENABLED || false),
      port: 9090,
      path: '/metrics',
    },
  },

  // Serverless mode config (API Gateway WebSocket)
  serverless: {
    connectionTimeout: 3600,            // 1 hour
    idleTimeout: 600,                   // 10 minutes
    stageName: env.APP_ENV || 'production',
    memorySize: 256,                    // MB
    timeout: 30,                        // seconds
  },

  // Channel configuration
  channels: {
    public: true,
    private: true,
    presence: {
      enabled: true,
      maxMembersPerChannel: 100,
      memberInfoTtl: 60,               // seconds
    },
  },

  // App credentials (Pusher-compatible)
  app: {
    id: env.BROADCAST_APP_ID || 'stacks',
    key: env.BROADCAST_APP_KEY || '',
    secret: env.BROADCAST_APP_SECRET || '',
  },

  // Legacy socket config
  socket: {
    port: Number(env.BROADCAST_PORT || 6001),
    host: env.BROADCAST_HOST || 'localhost',
    cors: {
      origin: env.BROADCAST_CORS_ORIGIN || env.APP_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
    },
  },

  // Legacy Pusher config
  pusher: {
    appId: env.PUSHER_APP_ID || '',
    key: env.PUSHER_APP_KEY || '',
    secret: env.PUSHER_APP_SECRET || '',
    cluster: env.PUSHER_APP_CLUSTER || 'mt1',
    useTLS: Boolean(env.PUSHER_APP_USE_TLS ?? true),
  },

  debug: Boolean(env.BROADCAST_DEBUG || false),
} satisfies RealtimeConfig
```

### Environment Variables
| Variable | Default | Description |
|---|---|---|
| `REALTIME_MODE` | `server` | Deployment mode: server or serverless |
| `BROADCAST_DRIVER` | `bun` | Broadcasting driver |
| `BROADCAST_HOST` | `0.0.0.0` | Server bind host |
| `BROADCAST_PORT` | `6001` | Server port |
| `BROADCAST_SCHEME` | `ws` | WebSocket scheme (ws/wss) |
| `BROADCAST_REDIS_ENABLED` | `false` | Enable Redis adapter |
| `REDIS_HOST` | `localhost` | Redis host |
| `REDIS_PORT` | `6379` | Redis port |
| `REDIS_PASSWORD` | (empty) | Redis password |
| `BROADCAST_REDIS_PREFIX` | `stacks:realtime:` | Redis key prefix |
| `BROADCAST_RATE_LIMIT_ENABLED` | `true` | Enable rate limiting |
| `BROADCAST_METRICS_ENABLED` | `false` | Enable metrics endpoint |
| `BROADCAST_APP_ID` | `stacks` | App ID |
| `BROADCAST_APP_KEY` | (empty) | App key |
| `BROADCAST_APP_SECRET` | (empty) | App secret |
| `BROADCAST_CORS_ORIGIN` | APP_URL | CORS origin |
| `BROADCAST_DEBUG` | `false` | Debug mode |
| `PUSHER_APP_ID` | (empty) | Pusher app ID |
| `PUSHER_APP_KEY` | (empty) | Pusher app key |
| `PUSHER_APP_SECRET` | (empty) | Pusher app secret |
| `PUSHER_APP_CLUSTER` | `mt1` | Pusher cluster |
| `PUSHER_APP_USE_TLS` | `true` | Pusher TLS |

---

## Gotchas
- The server must be created via `createServer()` before `emit()` works -- otherwise it silently logs a warning and returns
- Channel and Broadcast methods throw errors if the server is not initialized (unlike `emit()` which only warns)
- Private channels auto-prefix `private-` -- don't add it yourself (the code checks `channel.startsWith('private-')`)
- Presence channels auto-prefix `presence-` -- same logic applies
- `emitToUser()` sends to `private-user.{userId}` -- users must subscribe to this channel pattern
- `emit()`'s `exclude` takes socket IDs, not user IDs; every ID in an array is excluded
- Broadcast files are dynamically imported from `app/Broadcasts/` using `bun.globSync`
- The `Broadcast` class is legacy -- new code should use `emit()` and `channel()` directly
- There is no `handleWebSocketRequest()`: sockets upgraded on the app's own server were never part of the broadcast server, so they could not join channels. Clients connect to the broadcast server's `/ws`
- There is no Stacks heartbeat or backpressure guard; use `createServer({ websocket: { idleTimeout, sendPings, backpressureLimit, closeOnBackpressureLimit } })`
- Serverless mode uses API Gateway WebSocket for AWS Lambda with DynamoDB for connection management
- Rate limiting defaults: 100 connections per IP, 50 messages/second, 64KB max payload, 300s ban duration
- Redis adapter enables horizontal scaling across multiple server instances
- Auto-scaling config (min/max/targetCPU) is for cloud deployment orchestration
- The `satisfies RealtimeConfig` type annotation ensures the config matches the expected type from `@stacksjs/types`
