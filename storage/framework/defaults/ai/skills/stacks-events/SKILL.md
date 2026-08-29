---
name: stacks-events
description: Use when working with the event system in a Stacks application - dispatching events, listening for events, model events, wildcard listeners, the event emitter, or event-driven architecture. Covers @stacksjs/events, app/Events.ts, app/Listener.ts, and app/Listeners/.
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
// @stacksjs/events
interface AuthEvents {
  'user:registered': UserRegisteredEvent
  'user:logged-in': UserLoggedInEvent
  'user:logged-out': UserLoggedOutEvent
  'user:password-reset': UserPasswordEvent
  'user:password-changed': UserPasswordEvent
}

// Augmentation target - model events land here, and so do yours.
interface AppEvents {}

type StacksEvents = AppEvents & AuthEvents
type EventName = keyof StacksEvents & string
```

There is **no** trailing index signature, deliberately: an arbitrary event name is
what made `dispatch('user:creatd', …)` compile and reach nobody. Declare an
application's own events on `AppEvents` and the typo becomes a compile error.

```typescript
declare module '@stacksjs/events' {
  interface AppEvents {
    'invoice:settled': { id: number, total: number }
  }
}
```

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
import { defineEvents } from '@stacksjs/events'

export default defineEvents({
  'user:registered': ['SendWelcomeEmail'],
  'user:created': ['NotifyUser'],
})
```

Both halves are checked. A key must be an event that exists (`EventName`, above);
a value must name a listener that is on disk (`ListenerName`, generated into
`storage/framework/types/actions.d.ts` from `app/Listeners/`, `app/Actions/` and
the framework defaults behind them). `satisfies Events` is equivalent and still
supported; `defineEvents` is preferred because it also keeps the literal types,
so `keyof typeof events` is the two names the file declares rather than `string`.

## Listener Resolution (app/Listener.ts)

`handleEvents()` delegates to `registerAppListeners()`, which registers both
conventions and is idempotent:

```typescript
import { registerAppListeners } from '@stacksjs/events'
import { path as p } from '@stacksjs/path'

export async function handleEvents(): Promise<number> {
  return registerAppListeners({ base: p.projectPath() })
}
```

Names in the map resolve against `app/Listeners/`, `app/Actions/`, then the same
two directories under the framework defaults - first match wins.

### Registration Flow
1. **The map**: `registerFromMap()` imports `app/Events.ts` and, for each name,
   resolves a module with a `handle` method out of `app/Listeners/`,
   `app/Actions/` or the framework defaults, then subscribes it to that event
   directly. A name that resolves to nothing is warned about by name.
2. **The scan**: `discoverListeners()` walks `app/Listeners/` and registers any
   default export shaped `{ listensTo, handle }`. `listensTo` may be an array.
3. **Dedup**: every `(event, module)` pair is claimed once per process, so a
   listener that appears in both conventions - or a dev server that re-runs
   boot - registers once rather than twice.
4. **Payload check**: if the resolved action declares `validations`, a dispatched
   payload that does not match them is warned about. It is not thrown: the
   dispatcher has already committed the thing the event announces.

### Where it is called from
- `injectGlobalAutoImports()` (`@stacksjs/server`), so every path that dispatches -
  HTTP, `buddy seed`, a scheduled job, a console command - has listeners on the bus
- `handleEvents()` in `app/Listener.ts`, the app's own override hook

Both on the same boot in dev. The claim registry is what keeps that from being
two of every listener.

## Implementation Details

### Thread Safety
- handlers are stored in arrays -- `emit()` calls `.slice()` before iterating to safely handle additions/removals during iteration

### Synchronous vs Asynchronous
- **`emit` is synchronous**: it calls handlers directly and does not await them; an async handler's rejection is logged rather than lost
- **`emitAsync` / `dispatchAsync` awaits** every matching handler and resolves with their results
- **Registration is asynchronous**: resolving a listener name imports a module

### Memory
- The emitter is one per *process*, keyed on `Symbol.for('stacks.events.emitter')` rather than per copy of the package -- two installed copies would otherwise be two separate buses, and a dispatch into the wrong one looks exactly like a dispatch nobody listened for
- Resolved listener modules are held by the closures registered on the emitter, so adding an action requires a restart

## Gotchas
- Events are functional, not class-based -- no need to create event classes
- The emitter is a **singleton** -- shared across the entire application process
- Wildcard `'*'` listeners receive `(type, event)` -- regular handlers receive just `(event)`
- Listeners in `app/Events.ts` are **names** (strings), not file paths or handler functions -- resolved against `app/Listeners/`, `app/Actions/`, then the framework defaults
- The listener module must export a default with a `handle(event)` method
- Event dispatch is **synchronous** but listener resolution (dynamic import) happens once, at boot
- Model events only fire when the model has `observe: true` (or array) trait set
- The event system is ~200 bytes total -- it is intentionally minimal
- Listeners are resolved once at boot, so adding an action requires a server restart
- If `evt` is `undefined`, handlers are NOT called (`emit` checks `if (evt !== undefined)`)
- The `'*'` event type cannot be manually emitted -- it only receives forwarded events
- `off(type)` without a handler argument clears ALL handlers for that type (sets to empty array, not delete)
- `StacksEvents` has **no** index signature: an undeclared event name is a compile error, not a dispatch into the void. Declare your own on `AppEvents`
- Error logging in mitt uses `console.error` (not `@stacksjs/logging`) to avoid circular dependencies
