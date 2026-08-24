---
name: stacks-events
description: Use when working with the event system in a Stacks application — dispatching events, listening for events, model events, wildcard listeners, the event emitter, or event-driven architecture. Covers @stacksjs/events, app/Events.ts, app/Listener.ts, and app/Listeners/.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Events

Tiny (~200b) functional event emitter based on mitt, with Stacks-specific model events and action-based listener resolution.

## Key Paths
- Core package: `storage/framework/core/events/src/index.ts` (single file -- entire implementation)
- Application events: `app/Events.ts`
- Listener setup: `app/Listener.ts`
- Listeners: `app/Listeners/`
- Event types: `storage/framework/types/events.ts`

## Core mitt Implementation (index.ts)

The entire event system is a single `mitt()` factory function that returns an `Emitter<Events>` object:

```typescript
export default function mitt<Events>(all?: EventHandlerMap<Events>): Emitter<Events>
```

### Emitter Interface
```typescript
interface Emitter<Events> {
  all: EventHandlerMap<Events>  // Map<keyof Events | '*', Handler[]>

  on<Key>(type: Key, handler: Handler<Events[Key]>): void
  on(type: '*', handler: WildcardHandler<Events>): void

  off<Key>(type: Key, handler?: Handler<Events[Key]>): void
  off(type: '*', handler?: WildcardHandler<Events>): void

  emit<Key>(type: Key, event?: Events[Key]): void
}
```

### How emit() Works
1. Gets handlers array from `all.get(type)` -- calls each with `handler(event)`
2. Gets wildcard handlers from `all.get('*')` -- calls each with `handler(type, event)`
3. Handlers are called via `.slice()` copy to avoid mutation during iteration
4. Each handler is wrapped in try-catch with `console.error` logging
5. Error in one handler does NOT prevent other handlers from executing
6. Both type-matched AND wildcard handlers run (wildcards run second)
7. If `event` is `undefined`, handlers are NOT called

### on() / off() Behavior
- `on(type, handler)`: pushes to handlers array (creates array if first handler)
- `off(type, handler)`: splices handler from array by index
- `off(type)` (no handler): replaces handlers array with empty `[]`
- Handler maps use `Map<string, Array<Handler>>` internally

## Stacks Event System Exports

The package creates a single `mitt<StacksEvents>()` instance and exports multiple aliases:

```typescript
import { dispatch, listen, off, emitter, events, useEvent, useListen, useEvents, all } from '@stacksjs/events'

// Dispatch an event
dispatch('user:registered', { id: 1, email: 'user@example.com' })

// Listen for an event
listen('user:registered', (data) => {
  console.log('New user:', data.email)
})

// Wildcard listener (catches ALL events)
listen('*', (type, data) => {
  console.log(`Event ${type}:`, data)
})

// Remove a specific listener
off('user:registered', handler)

// Direct emitter access
emitter.on('event', handler)
emitter.off('event', handler)
emitter.emit('event', data)
emitter.all  // Map of all handlers
```

### Export Aliases
| Export | Maps To |
|--------|---------|
| `dispatch` | `emitter.emit` |
| `useEvent` | `emitter.emit` (alias for `dispatch`) |
| `listen` | `emitter.on` |
| `useListen` | `emitter.on` (alias for `listen`) |
| `off` | `emitter.off` |
| `emitter` | the mitt instance |
| `events` | the mitt instance (alias for `emitter`) |
| `useEvents` | the mitt instance (alias for `emitter`) |
| `all` | `emitter.all` (the handler Map) |
| `mitt` | the factory function itself |

### Type Aliases
```typescript
type Dispatch = <Key extends keyof StacksEvents>(type: Key, event: StacksEvents[Key]) => void
type Listen = <Key extends keyof StacksEvents>(type: Key, handler: Handler<StacksEvents[Key]>) => void
type Off = <Key extends keyof StacksEvents>(type: Key, handler?: Handler<StacksEvents[Key]>) => void
```

## Built-in Event Types (StacksEvents)

```typescript
interface StacksEvents extends ModelEvents, Record<EventType, unknown> {
  'user:registered': Record<string, any>
  'user:logged-in': Record<string, any>
  'user:logged-out': Record<string, any>
  'user:password-reset': Record<string, any>
  'user:password-changed': Record<string, any>
}
```

The `Record<EventType, unknown>` intersection allows arbitrary event names beyond the declared ones.

## Model Events

Every model with the `observe: true` trait emits **eight** events:

| Event | When | Payload |
|---|---|---|
| `{model}:saving` | before any write | the model object |
| `{model}:creating` / `:updating` / `:deleting` | before that write | the model object |
| `{model}:created` / `:updated` / `:deleted` | after that write | the row |
| `{model}:saved` | after insert OR update | the row |

Model name is lowercased: `'user:created'`, `'post:updated'`, `'teammember:saved'`.

A **before** listener can cancel the write by returning `false`:

```ts
listen('user:deleting', (model) => {
  if (model.attributes.email.endsWith('@example.com'))
    return false   // the delete does not happen
})
```

Before-events carry the model object (`.attributes` holds the row); after-events
carry the row itself.

### The payloads are typed, and nothing generates them

`listen('user:created', user => user.emial)` is a compile error - the payload is
the User row, with the columns your model declares.

`storage/framework/types/model-events.d.ts` derives the whole map from the models
barrel with a mapped type:

```ts
type ModelAfterEvents = {
  [K in keyof Models & string as `${Lowercase<K>}:${AfterEvent}`]: ModelRow<Models[K]>
}
```

So a model existing IS its events existing - there is no generated list to keep in
agreement, and nothing to re-run after adding a model. (It replaced an 817-line
generated file, and before that a hand-maintained one that listed three events per
model and typed every payload `Record<string, any>`.)

Declare your own events by augmenting `AppEvents`:

```ts
declare module '@stacksjs/events' {
  interface AppEvents {
    'invoice:overdue': { id: number, daysLate: number }
  }
}
```

Events are dispatched via lazy `import('@stacksjs/events').then(({ dispatch }) => dispatch(...))` to avoid circular dependencies. If the import fails (e.g., browser context), errors are silently caught.

The `observe` trait can be:
- `true` -- emits all three events (create, update, delete)
- `['create', 'update']` -- emits only specified events
- `false` / undefined -- no events

There is no model list to keep here. Every model in `storage/framework/auto-imports/models.ts`
has its eight events, and that barrel is generated from disk for the runtime, so the
answer to "which models emit events" is "the ones that exist".

## Event-to-Listener Mapping (app/Events.ts)

```typescript
import type { Events } from '@stacksjs/types'

export default {
  'user:registered': ['SendWelcomeEmail'],
  'user:created': ['NotifyUser'],
} satisfies Events
```

Keys are event names (must match StacksEvents keys). Values are arrays of **Action names** -- these correspond to files in `app/Actions/`.

## Listener Resolution (app/Listener.ts)

The `handleEvents()` function sets up the entire event-to-action pipeline:

### Setup
```typescript
export async function handleEvents() {
  emitter.on('*', listenEvents as WildcardHandler<StacksEvents>)
}
```
Subscribes a single wildcard handler that intercepts ALL events.

### Event Processing Flow
1. **Fast path**: `eventTypes` Set (pre-computed from `Object.keys(events)`) provides O(1) lookup. Events not in the map are skipped immediately.
2. **Listener resolution**: For each listener name in the array, `resolveAction(listener)` is called:
   - Checks `actionCache` Map (in-memory module cache)
   - Checks `pendingImports` Map (deduplicates concurrent imports of the same action)
   - Dynamically imports `app/Actions/{listener}.ts`
   - Validates the module exports a `handle(event)` method
   - Caches the resolved module in `actionCache`
3. **Execution**: `processListeners()` iterates listeners sequentially (`for...of`), awaiting each action's `handle(event)` method
4. **Error handling**: Errors are caught per-listener via `handleError()` from `@stacksjs/error-handling` -- one listener failure does not prevent others

### Caching Details
```typescript
const actionCache = new Map<string, { handle: (event: any) => Promise<any> | any }>()
const pendingImports = new Map<string, Promise<...>>()
const eventTypes = new Set(Object.keys(events))  // pre-computed at module load
```

- `actionCache`: stores resolved action modules permanently
- `pendingImports`: prevents double-importing when multiple events fire simultaneously for the same listener
- `eventTypes`: O(1) lookup to skip events with no registered listeners

### Listener Type Support
The listener can also be a function (not just a string):
```typescript
if (typeof listener === 'function') {
  await listener(event)
  continue
}
```

## Implementation Details

### Thread Safety
- mitt handlers are stored in arrays -- `emit()` calls `.slice()` before iterating to safely handle additions/removals during iteration
- Wildcard handler registration happens once in `handleEvents()` -- the single handler routes all events

### Synchronous vs Asynchronous
- **mitt itself is synchronous**: `emit()` calls handlers directly, does not await them
- **Listener resolution is asynchronous**: `processListeners()` uses `async/await` for dynamic imports and action execution
- The wildcard handler in `app/Listener.ts` calls `processListeners()` as fire-and-forget (no await) since mitt doesn't support async wildcard handlers

### Memory
- The emitter is a module-level singleton -- created once at import time
- Action modules are cached permanently in `actionCache` -- hot-reloading new actions requires server restart
- The `pendingImports` Map entries are cleaned up in the `finally` block of each import

## Gotchas
- Events are functional, not class-based -- no need to create event classes
- The emitter is a **singleton** -- shared across the entire application process
- Wildcard `'*'` listeners receive `(type, event)` -- regular handlers receive just `(event)`
- Listeners in `app/Events.ts` are **Action names** (strings), not file paths or handler functions
- The action module must export a default with a `handle(event)` method
- Event dispatch via mitt is **synchronous** but listener action resolution (dynamic import) is **asynchronous**
- Model events only fire when the model has `observe: true` (or array) trait set
- The event system is ~200 bytes total -- it is intentionally minimal
- Listener caching means hot-reloading new actions requires server restart
- If `evt` is `undefined`, handlers are NOT called (mitt checks `if (evt !== undefined)`)
- The `'*'` event type cannot be manually emitted -- it only receives forwarded events
- `off(type)` without a handler argument clears ALL handlers for that type (sets to empty array, not delete)
- The `StacksEvents` interface extends `Record<EventType, unknown>` allowing any string as an event name
- Error logging in mitt uses `console.error` (not `@stacksjs/logging`) to avoid circular dependencies
