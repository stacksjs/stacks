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
import { realtime } from '@stacksjs/realtime'

// Basic broadcasting
await realtime
  .setChannel('notifications')
  .setEvent('new-message', { message: 'Hello!' })
  .broadcastEvent()

// Broadcasting to private channels
await realtime
  .setChannel('user-123')
  .setPrivateChannel()
  .setEvent('status-update', { status: 'online' })
  .broadcastEvent()

// Broadcasting to presence channels
await realtime
  .setChannel('chat-room')
  .setPresenceChannel()
  .setEvent('user-joined', { user: 'John' })
  .broadcastEvent()
```

## Available Drivers

The package supports multiple realtime drivers:

### Pusher Driver

```typescript
import { PusherDriver } from '@stacksjs/realtime'

const pusher = new PusherDriver()
await pusher.connect()

// Subscribe to a channel
pusher.subscribe('notifications', (data) => {
  console.log('Received:', data)
})

// Publish to a channel
pusher.publish('notifications', { message: 'Hello!' })

// Broadcast to a specific channel type
pusher.broadcast('notifications', 'new-message', { message: 'Hello!' }, 'public')
```

### Socket.IO Driver

```typescript
import { SocketDriver } from '@stacksjs/realtime'

const socket = new SocketDriver()
await socket.connect()

// Subscribe to a channel
socket.subscribe('notifications', (data) => {
  console.log('Received:', data)
})

// Publish to a channel
socket.publish('notifications', { message: 'Hello!' })

// Broadcast to a specific channel type
socket.broadcast('notifications', 'new-message', { message: 'Hello!' }, 'private')
```

### Bun WebSocket Driver

```typescript
import { BunSocket } from '@stacksjs/realtime'

const bunSocket = new BunSocket()
await bunSocket.connect()

// Subscribe to a channel
bunSocket.subscribe('notifications', (data) => {
  console.log('Received:', data)
})

// Publish to a channel
bunSocket.publish('notifications', { message: 'Hello!' })

// Broadcast to a specific channel type
bunSocket.broadcast('notifications', 'new-message', { message: 'Hello!' }, 'presence')
```

## Channel Types

The package supports three types of channels:

1. **Public Channels**
   - Accessible to all clients
   - No authentication required
   - Example: `notifications`

2. **Private Channels**
   - Require authentication
   - Prefixed with `private-`
   - Example: `private-user-123`

3. **Presence Channels**
   - Require authentication
   - Support user presence features
   - Prefixed with `presence-`
   - Example: `presence-chat-room`

## Broadcasting Methods

### Basic Broadcasting

```typescript
// Broadcast to a public channel
await realtime
  .setChannel('notifications')
  .setEvent('new-message', { message: 'Hello!' })
  .broadcastEvent()

// Broadcast immediately
await realtime
  .setChannel('notifications')
  .setEvent('new-message', { message: 'Hello!' })
  .broadcastEventNow()
```

### Channel-Specific Broadcasting

```typescript
// Private channel broadcasting
await realtime
  .setChannel('user-123')
  .setPrivateChannel()
  .setEvent('status-update', { status: 'online' })
  .broadcastEvent()

// Presence channel broadcasting
await realtime
  .setChannel('chat-room')
  .setPresenceChannel()
  .setEvent('user-joined', { user: 'John' })
  .broadcastEvent()
```

### Excluding Current User

```typescript
// Broadcast to all users except the sender
await realtime
  .setChannel('notifications')
  .setEvent('new-message', { message: 'Hello!' })
  .excludeCurrentUser()
  .broadcastEvent()
```

## Connection Management

```typescript
// Check connection status
const isConnected = realtime.isConnected()

// Disconnect
await realtime.disconnect()
```

## Error Handling

The package includes built-in error handling and logging:

```typescript
// Connection errors are automatically logged
try {
  await realtime.connect()
} catch (error) {
  console.error('Connection failed:', error)
}

// Broadcasting errors
try {
  await realtime
    .setChannel('notifications')
    .setEvent('new-message', { message: 'Hello!' })
    .broadcastEvent()
} catch (error) {
  console.error('Broadcasting failed:', error)
}
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
   - Follow the naming convention: `{type}-{name}`
   - Example: `private-user-123`, `presence-chat-room`

2. **Event Naming**
   - Use kebab-case for event names
   - Be specific and descriptive
   - Example: `user-status-updated`, `new-message-received`

3. **Error Handling**
   - Always implement error handling for connections and broadcasts
   - Log errors appropriately
   - Implement reconnection logic for production

4. **Security**
   - Use private channels for sensitive data
   - Implement proper authentication for private and presence channels
   - Validate data before broadcasting

5. **Performance**
   - Use appropriate channel types for different use cases
   - Implement rate limiting for broadcasts
   - Monitor connection status and implement reconnection logic
