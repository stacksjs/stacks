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
   * The event name.
   */
  event: 'OrderShipped',

  /**
   * Handle the broadcast event.
   * This method is called when the event is triggered.
   */
  async handle(data: OrderData): Promise<void> {
    await channel(`orders.${data.orderId}`).private(this.event, data)
  },
} satisfies RealtimeOptions
```

## Channel Types

The package supports three types of channels:

1. **Public Channels**
   - Accessible to all clients
   - No authentication required
   - Example: `channel('notifications').public(event, data)`

2. **Private Channels**
   - Require authentication
   - Prefixed with `private-`
   - Example: `channel('user-123').private(event, data)`

3. **Presence Channels**
   - Require authentication
   - Support user presence features
   - Prefixed with `presence-`
   - Example: `channel('chat-room').presence(event, data)`

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

## Best Practices

1. **Channel Naming**
   - Use descriptive names for channels
   - Follow the naming convention: `{type}.{identifier}`
   - Example: `orders.12345`, `chat.user_123`

2. **Event Naming**
   - Use PascalCase for event names
   - Be specific and descriptive
   - Example: `OrderShipped`, `MessageReceived`

3. **Type Safety**
   - Define interfaces for your event data
   - Use TypeScript to ensure type safety
   - Export types for reuse across your application

4. **Security**
   - Use private channels for sensitive data
   - Implement proper authentication for private and presence channels
   - Validate data before broadcasting

5. **Organization**
   - Keep broadcast events in a dedicated directory
   - Group related events together
   - Use consistent naming conventions
