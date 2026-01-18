# Events Package

A lightweight (~200b) functional event emitter and pub/sub system, providing a simple yet powerful event bus for application-wide communication.

## Installation

```bash
bun add @stacksjs/events
```

## Basic Usage

```typescript
import { dispatch, listen, events } from '@stacksjs/events'

// Listen for an event
listen('user:registered', (user) => {
  console.log('New user registered:', user.name)
})

// Dispatch an event
dispatch('user:registered', { name: 'John', email: 'john@example.com' })
```

## Event System Overview

The events package provides a functional event emitter based on the mitt library, with Stacks-specific enhancements for model events and application-wide event handling.

### Core Concepts

- **Events**: Named occurrences that can carry data
- **Listeners**: Functions that respond to events
- **Dispatch**: Triggering an event with optional data
- **Wildcards**: Listen to all events with `*`

## Listening to Events

### Single Event Listener

```typescript
import { listen, useListen } from '@stacksjs/events'

// Using listen
listen('order:placed', (order) => {
  console.log(`Order ${order.id} was placed`)
  sendOrderConfirmation(order)
})

// Using useListen (alias)
useListen('payment:completed', (payment) => {
  console.log(`Payment of $${payment.amount} received`)
})
```

### Wildcard Listener

```typescript
import { listen } from '@stacksjs/events'

// Listen to ALL events
listen('*', (eventType, eventData) => {
  console.log(`Event: ${String(eventType)}`, eventData)
  // Useful for logging, debugging, or analytics
})
```

### Multiple Listeners

```typescript
import { listen } from '@stacksjs/events'

// Same event can have multiple listeners
listen('user:created', sendWelcomeEmail)
listen('user:created', createDefaultSettings)
listen('user:created', notifyAdminTeam)
listen('user:created', trackAnalytics)

// All listeners are called when event is dispatched
```

## Dispatching Events

### Basic Dispatch

```typescript
import { dispatch, useEvent } from '@stacksjs/events'

// Using dispatch
dispatch('user:logged-in', { userId: 1, timestamp: Date.now() })

// Using useEvent (alias)
useEvent('cart:updated', { items: 3, total: 99.99 })
```

### Dispatching Without Data

```typescript
import { dispatch } from '@stacksjs/events'

// Some events don't need payload data
dispatch('cache:cleared', undefined)
dispatch('maintenance:started', undefined)
```

### Typed Events

```typescript
import { dispatch, listen } from '@stacksjs/events'

interface OrderEvent {
  orderId: number
  userId: number
  total: number
  items: Array<{ productId: number; quantity: number }>
}

// TypeScript ensures correct payload structure
listen('order:placed', (order: OrderEvent) => {
  processOrder(order)
})

dispatch('order:placed', {
  orderId: 123,
  userId: 1,
  total: 299.99,
  items: [{ productId: 1, quantity: 2 }]
})
```

## Removing Event Listeners

### Remove Specific Listener

```typescript
import { listen, off } from '@stacksjs/events'

// Define handler as named function
function handleUserCreated(user: any) {
  console.log('User created:', user)
}

// Add listener
listen('user:created', handleUserCreated)

// Remove specific listener
off('user:created', handleUserCreated)
```

### Remove All Listeners for Event

```typescript
import { off } from '@stacksjs/events'

// Remove all listeners for a specific event
off('user:created')
```

### Remove Wildcard Listener

```typescript
import { listen, off } from '@stacksjs/events'

function logger(type: any, data: any) {
  console.log(type, data)
}

listen('*', logger)
off('*', logger)
```

## Event Emitter Instance

### Direct Emitter Access

```typescript
import { events, emitter, useEvents } from '@stacksjs/events'

// All three are the same emitter instance
events.on('event', handler)
emitter.emit('event', data)
useEvents.off('event', handler)

// Access all registered handlers
console.log(events.all) // Map of event types to handlers
```

### Using the Emitter Directly

```typescript
import { events } from '@stacksjs/events'

// Register handler
events.on('notification:received', (notification) => {
  showNotification(notification)
})

// Emit event
events.emit('notification:received', {
  title: 'New Message',
  body: 'You have a new message'
})

// Remove handler
events.off('notification:received', handler)
```

## Model Events

The events package integrates with the ORM to provide model lifecycle events:

```typescript
import { listen } from '@stacksjs/events'

// Listen for model events
listen('user:created', (user) => {
  console.log('User created:', user.id)
  // Send welcome email, create audit log, etc.
})

listen('user:updated', (user) => {
  console.log('User updated:', user.id)
  // Sync to external service, update cache, etc.
})

listen('user:deleted', (user) => {
  console.log('User deleted:', user.id)
  // Cleanup related data, send notification, etc.
})
```

### Built-in User Events

```typescript
import type { StacksEvents } from '@stacksjs/events'

// Pre-defined user events
listen('user:registered', handleRegistration)
listen('user:logged-in', handleLogin)
listen('user:logged-out', handleLogout)
listen('user:password-reset', handlePasswordReset)
listen('user:password-changed', handlePasswordChange)
```

## Creating Custom Event Types

### Extending StacksEvents

```typescript
// types/events.ts
import type { StacksEvents } from '@stacksjs/events'

// Extend the base events interface
declare module '@stacksjs/events' {
  interface StacksEvents {
    'order:placed': { orderId: number; userId: number }
    'order:shipped': { orderId: number; trackingNumber: string }
    'order:delivered': { orderId: number; deliveredAt: Date }
    'payment:failed': { orderId: number; error: string }
  }
}
```

### Type-Safe Event Handling

```typescript
import { dispatch, listen } from '@stacksjs/events'

// TypeScript will enforce correct types
listen('order:placed', (data) => {
  // data is typed as { orderId: number; userId: number }
  console.log(`Order ${data.orderId} for user ${data.userId}`)
})

// TypeScript error if payload doesn't match
dispatch('order:placed', { orderId: 1, userId: 2 }) // OK
dispatch('order:placed', { orderId: 'wrong' }) // Type error
```

## Event Bus Patterns

### Event Sourcing Pattern

```typescript
import { listen, dispatch, all } from '@stacksjs/events'

// Event store
const eventStore: Array<{ type: string; data: any; timestamp: number }> = []

// Record all events
listen('*', (type, data) => {
  eventStore.push({
    type: String(type),
    data,
    timestamp: Date.now()
  })
})

// Replay events
function replayEvents() {
  for (const event of eventStore) {
    // Process each recorded event
    processEvent(event)
  }
}
```

### Request/Response Pattern

```typescript
import { dispatch, listen, off } from '@stacksjs/events'

async function request<T>(eventName: string, data: any): Promise<T> {
  return new Promise((resolve) => {
    const responseEvent = `${eventName}:response`

    function handler(response: T) {
      off(responseEvent, handler)
      resolve(response)
    }

    listen(responseEvent, handler)
    dispatch(eventName, data)
  })
}

// Usage
const userData = await request('user:fetch', { userId: 1 })
```

### Saga Pattern

```typescript
import { listen, dispatch } from '@stacksjs/events'

// Orchestrate complex workflows
listen('checkout:started', async (data) => {
  try {
    // Step 1: Reserve inventory
    dispatch('inventory:reserve', data)

    // Step 2: Process payment
    dispatch('payment:process', data)

    // Step 3: Create order
    dispatch('order:create', data)
  } catch (error) {
    // Compensating actions
    dispatch('checkout:rollback', { ...data, error })
  }
})
```

## Best Practices

### Event Naming Conventions

```typescript
// Use namespace:action format
'user:created'
'user:updated'
'user:deleted'

// Use past tense for completed actions
'order:placed'     // Not 'order:place'
'payment:completed' // Not 'payment:complete'

// Use present tense for ongoing processes
'file:uploading'
'sync:processing'
```

### Decoupling Components

```typescript
// Bad: Direct coupling
class OrderService {
  async placeOrder(order: Order) {
    await this.save(order)
    await emailService.sendConfirmation(order)  // Tight coupling
    await analyticsService.track(order)          // Tight coupling
  }
}

// Good: Event-driven decoupling
class OrderService {
  async placeOrder(order: Order) {
    await this.save(order)
    dispatch('order:placed', order)  // Let listeners handle side effects
  }
}

// Listeners in separate modules
listen('order:placed', sendOrderConfirmation)
listen('order:placed', trackOrderAnalytics)
```

### Error Handling in Listeners

```typescript
import { listen } from '@stacksjs/events'

listen('important:event', async (data) => {
  try {
    await processData(data)
  } catch (error) {
    // Log error but don't throw - other listeners should still run
    console.error('Error processing event:', error)

    // Optionally dispatch error event
    dispatch('error:occurred', { original: 'important:event', error })
  }
})
```

## Edge Cases

### Order of Listener Execution

```typescript
// Listeners are called in registration order
listen('event', () => console.log('First'))
listen('event', () => console.log('Second'))
listen('event', () => console.log('Third'))

dispatch('event', {})
// Output: First, Second, Third
```

### Async Listeners

```typescript
import { listen, dispatch } from '@stacksjs/events'

// Async listeners don't block dispatch
listen('async:event', async (data) => {
  await slowOperation()  // Takes 5 seconds
  console.log('Done')
})

dispatch('async:event', {})
console.log('Dispatched')
// Output: 'Dispatched' (immediately), then 'Done' (after 5 seconds)
```

### Memory Leaks

```typescript
import { listen, off } from '@stacksjs/events'

// Potential memory leak
function setupComponent() {
  listen('data:updated', handleUpdate)  // Never removed!
}

// Proper cleanup
function setupComponent() {
  listen('data:updated', handleUpdate)

  return () => {
    off('data:updated', handleUpdate)  // Cleanup on unmount
  }
}
```

### Dispatching During Listener Execution

```typescript
import { listen, dispatch } from '@stacksjs/events'

// Safe: Dispatch new events within listeners
listen('step:one', () => {
  console.log('Step one')
  dispatch('step:two', {})  // Triggers step two listener
})

listen('step:two', () => {
  console.log('Step two')
})

dispatch('step:one', {})
// Output: 'Step one', 'Step two'
```

## API Reference

### Functions

| Function | Description |
|----------|-------------|
| `listen(type, handler)` | Register event listener |
| `useListen(type, handler)` | Alias for listen |
| `dispatch(type, data)` | Emit an event |
| `useEvent(type, data)` | Alias for dispatch |
| `off(type, handler?)` | Remove listener(s) |

### Objects

| Object | Description |
|--------|-------------|
| `events` | Emitter instance |
| `emitter` | Alias for events |
| `useEvents` | Alias for events |
| `all` | Map of all handlers |

### Emitter Methods

| Method | Description |
|--------|-------------|
| `on(type, handler)` | Add listener |
| `off(type, handler?)` | Remove listener |
| `emit(type, data)` | Dispatch event |
| `all` | Get handler map |

### Type Definitions

```typescript
// Event handler type
type Handler<T> = (event: T) => void

// Wildcard handler type
type WildcardHandler<T> = (type: keyof T, event: T[keyof T]) => void

// Event handler map
type EventHandlerMap<Events> = Map<
  keyof Events | '*',
  Array<Handler<Events[keyof Events]>> | Array<WildcardHandler<Events>>
>
```
