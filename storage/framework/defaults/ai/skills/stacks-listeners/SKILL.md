---
name: stacks-listeners
description: Use when creating event listeners in app/Listeners/ - the listener file structure, registering listeners in app/Events.ts, the listener-to-action mapping pattern, CLI event listeners in Console.ts, or debugging listener execution. For the event system API (dispatch, listen, emitter, model events), see stacks-events.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Event Listeners

Application-level event listeners in `app/Listeners/`.

## Key Paths
- Listeners: `app/Listeners/`
- Event mapping: `app/Events.ts`
- Listener setup: `app/Listener.ts`

## Event → Listener Mapping (app/Events.ts)

```typescript
import { defineEvents } from '@stacksjs/events'

export default defineEvents({
  'user:registered': ['SendWelcomeEmail'],    // triggers app/Actions/SendWelcomeEmail.ts
  'user:created': ['NotifyUser'],             // triggers app/Actions/NotifyUser.ts
  'order:created': ['ProcessPayment', 'SendOrderConfirmation'],  // multiple listeners
})
```

Keys must be event names that exist; values must name listeners that exist. Both
are compile errors otherwise, which matters here more than most places: a name
that resolves to nothing produces one line in boot output and then behaves
exactly like an event nobody cared about.

## How Listeners Work

1. Events are dispatched: `dispatch('user:registered', { id: 1 })`
2. At boot, `registerAppListeners()` reads `app/Events.ts` and subscribes each
   named listener to its event directly
3. Each name resolves against `app/Listeners/`, then `app/Actions/`, then the
   same two under the framework defaults - first match wins
4. Modules under `app/Listeners/` that declare their own `listensTo` are
   registered by the same call, from a directory scan
5. A listener that appears in both is registered once

## Creating a Listener Action

```typescript
// app/Actions/SendWelcomeEmail.ts
export default {
  name: 'SendWelcomeEmail',

  async handle(event: { id: number, email: string, name: string }) {
    // event contains the data passed to dispatch()
    await sendWelcomeEmail({ to: event.email, name: event.name })
    return { success: true }
  }
}
```

## Creating a Standalone Listener

A module under `app/Listeners/` that declares its own `listensTo` is registered
by the boot scan, with no entry in `app/Events.ts`. Use `defineListener` so the
event name is checked and the payload is inferred from it:

```typescript
// app/Listeners/SendWelcomeEmail.ts
import { defineListener } from '@stacksjs/events'

export default defineListener({
  listensTo: 'user:registered',        // or ['user:created', 'user:updated']
  handle: async (user, event) => {     // `user` is typed from the event name
    await sendWelcomeEmail({ to: user.email })
    void event                         // which event fired, for multi-event listeners
  },
})
```

A glob (`'user:*'`, `'*'`) is a legal subscription and receives the union of
what the bus carries. A listener that appears here *and* in `app/Events.ts` is
registered once.

## CLI Event Listeners (app/Listeners/Console.ts)

For CLI-specific events (not HTTP):

```typescript
export default function(cli: CLI) {
  // Specific command
  cli.on('inspire:three', () => {
    console.log(getThreeQuotes())
  })

  // Default handler (unknown commands)
  cli.on('inspire:!', () => {
    console.log('Unknown inspire command')
  })

  // Wildcard (matches inspire:anything)
  cli.on('inspire:*', () => {
    console.log('Some inspire variant')
  })
}
```

## Multiple Listeners Per Event

```typescript
// app/Events.ts
{
  'order:created': [
    'ProcessPayment',          // runs first
    'SendOrderConfirmation',   // runs second
    'UpdateInventory',         // runs third
    'NotifyWarehouse'          // runs fourth
  ]
}
```

Listeners execute sequentially (not in parallel) — each awaits completion.

## Gotchas
- Listeners are Action names, not file paths — `'SendWelcomeEmail'` resolves to `app/Actions/SendWelcomeEmail.ts`
- The action must have a `handle(event)` method
- Listeners run sequentially per event — order in the array matters
- Action modules are cached after first load — no hot-reload for listeners
- CLI listeners are separate from HTTP event listeners
- For the event API (dispatch, listen, emitter), see the `stacks-events` skill
