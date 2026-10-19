---
title: TypeScript Realtime Package
description: "A powerful and flexible realtime communication library for TypeScript that provides multiple drivers (Pusher, Socket.IO, and Bun WebSocket) for handling re..."
---
# TypeScript Realtime Package

A powerful and flexible realtime communication library for TypeScript that provides multiple drivers (Pusher, Socket.IO, and Bun WebSocket) for handling realtime events and broadcasting.

## Installation

```bash
# Using bun
bun add @stacksjs/realtime

# Using npm
npm install @stacksjs/realtime

# Using yarn
yarn add @stacksjs/realtime

# Using pnpm
pnpm add @stacksjs/realtime
```

## Basic Usage

```typescript
import { broadcast, channel } from '@stacksjs/realtime'

// Broadcasting an event
const orderData = {
  orderId: '12345',
  userId: 'user_123',
  products: [
    { id: 'prod_1', name: 'Widget', quantity: 2 },
    { id: 'prod_2', name: 'Gadget', quantity: 1 },
  ],
  totalAmount: 99.99,
  shippingAddress: {
    street: '123 Main St',
    city: 'Anytown',
    country: 'USA',
    postalCode: '12345',
  },
}

// Trigger the broadcast
await broadcast('OrderShipped', orderData)
```

## Creating Broadcast Events

Create a broadcast event by defining a handler in your broadcasts directory:

```typescript
// app/Broadcasts/OrderShipped.ts
import type { RealtimeOptions } from '@stacksjs/types'
import { channel } from '@stacksjs/realtime'

interface OrderData {
  orderId: string
  userId: string
  products: Array<{
    id: string
    name: string
    quantity: number
  }>
  totalAmount: number
  shippingAddress: {
    street: string
    city: string
    country: string
    postalCode: string
  }
  shippedAt?: string
}

export default {
  /**

   _ The event name.

   _/
  event: 'OrderShipped',

  /**

   _ Handle the broadcast event.
   _ This method is called when the event is triggered.

   */
  async handle(data: OrderData): Promise<void> {
    await channel(`orders.${data.orderId}`).private(this.event, data)
  },
} satisfies RealtimeOptions
```

## Channel Types

The package supports three types of channels:

1. **Public Channels**

   _ Accessible to all clients
   _ No authentication required

   * Example: `channel('notifications').public(event, data)`

2. **Private Channels**

   _ Require authentication
   _ Prefixed with `private-`

   * Example: `channel('user-123').private(event, data)`

3. **Presence Channels**

   _ Require authentication
   _ Support user presence features
   _ Prefixed with `presence-`
   _ Example: `channel('chat-room').presence(event, data)`

## Broadcasting Methods

### Basic Broadcasting

```typescript
// Broadcast to a public channel
await channel('notifications').public('new-message', { message: 'Hello!' })

// Broadcast to a private channel
await channel('user-123').private('status-update', { status: 'online' })

// Broadcast to a presence channel
await channel('chat-room').presence('user-joined', { user: 'John' })
```

### Broadcasting with Events

```typescript
// Define your event data interface
interface MessageData {
  content: string
  sender: string
  timestamp: string
}

// Create a broadcast event
// app/Broadcasts/NewMessage.ts
export default {
  event: 'NewMessage',
  async handle(data: MessageData): Promise<void> {
    await channel(`chat.${data.sender}`).private(this.event, data)
  },
} satisfies RealtimeOptions

// Trigger the broadcast
await broadcast('NewMessage', {
  content: 'Hello!',
  sender: 'user_123',
  timestamp: new Date().toISOString(),
})
```

## Configuration

The package can be configured through the application's configuration file:

```typescript
// config/realtime.ts
export default {
  driver: 'pusher', // or 'socket' or 'bun'
  
  // Pusher configuration
  pusher: {
    appId: 'your-app-id',
    key: 'your-key',
    secret: 'your-secret',
    cluster: 'mt1',
    useTLS: true,
  },
  
  // Socket.IO configuration
  socket: {
    host: 'localhost',
    port: 3000,
  },
}
```

## Authenticated HTTP streams

Optional `onEnqueue(chunk, broadcast)` observes a successful local enqueue. The
chunk is the exact queued `Uint8Array`; broadcast metadata retains the original
`channel`, `event` and `data` identity. Connected and heartbeat frames pass
`null` metadata. Do not mutate these bytes. This is local queue admission, not a
client receipt. Optional `onClose()` runs once after subscription cleanup.
Both callbacks retain the subscriber's async context and options receiver.
They run synchronously without delaying delivery. A throwing or rejecting
enqueue observer closes the stream; close observer failures are contained.
Neither callback changes framing, authorization checks or queue limits.

`createBroadcastHub()` initializes the native broadcast engine without opening a
WebSocket listener. `createBroadcastResponse({ channels, authorize, signal })`
returns an SSE response for server-selected channels. Authorization runs before
subscription, each event and each heartbeat, in the subscriber's async context.
A broadcast from another request therefore checks the subscriber's identity.
The broadcaster's context is restored after the callback.

The callback must resolve current credentials, permissions and expiry each time.
Context binding preserves request identity; it does not cache permission or
provide a distributed revocation fence. Pass the request's abort signal for
cleanup. Slow consumers are bounded and disconnected. Re-read durable state after
reconnecting because this HTTP transport does not promise durable replay.

## Best Practices

1. **Channel Naming**

   _ Use descriptive names for channels
   _ Follow the naming convention: `{type}.{identifier}`

   * Example: `orders.12345`, `chat.user_123`

2. **Event Naming**

   _ Use PascalCase for event names
   _ Be specific and descriptive

   * Example: `OrderShipped`, `MessageReceived`

3. **Type Safety**

   _ Define interfaces for your event data
   _ Use TypeScript to ensure type safety

   * Export types for reuse across your application

4. **Security**

   _ Use private channels for sensitive data
   _ Implement proper authentication for private and presence channels

   * Validate data before broadcasting

5. **Organization**

   _ Keep broadcast events in a dedicated directory
   _ Group related events together

   * Use consistent naming conventions
