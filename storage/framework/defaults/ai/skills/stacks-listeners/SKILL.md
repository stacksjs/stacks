---
name: stacks-listeners
description: Use when creating event listeners in app/Listeners/ — the listener file structure, registering listeners in app/Events.ts, the listener-to-action mapping pattern, CLI event listeners in Console.ts, or debugging listener execution. For the event system API (dispatch, listen, emitter, model events), see stacks-events.
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
export default {
  'user:registered': ['SendWelcomeEmail'],    // triggers app/Actions/SendWelcomeEmail.ts
  'user:created': ['NotifyUser'],             // triggers app/Actions/NotifyUser.ts
  'order:created': ['ProcessPayment', 'SendOrderConfirmation'],  // multiple listeners
} satisfies Events
```

Keys are event names. Values are arrays of Action names from `app/Actions/`.

## How Listeners Work

1. Events are dispatched: `dispatch('user:registered', { id: 1 })`
2. The wildcard handler in `app/Listener.ts` catches ALL events
3. Checks if the event has registered listeners in `app/Events.ts`
4. For each listener, dynamically imports `app/Actions/{listener}.ts`
5. Calls `action.handle(eventData)`
6. Action modules are cached after first import

## Creating a Listener Action

```typescript
// app/Actions/SendWelcomeEmail.ts
export default {
  name: 'SendWelcomeEmail',

  async handle(event: { id: number; email: string; name: string }) {
    // event contains the data passed to dispatch()
    await sendWelcomeEmail({ to: event.email, name: event.name })
    return { success: true }
  }
}
```

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
