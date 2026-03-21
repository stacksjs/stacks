---
name: stacks-events
description: Use when working with the event system in a Stacks application — defining events, creating event listeners, dispatching events, or configuring the event bus. Covers @stacksjs/events, app/Events.ts, and app/Listeners/.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Events

The `@stacksjs/events` package provides functional event emitting for the Stacks framework.

## Key Paths
- Core package: `storage/framework/core/events/src/`
- Application events: `app/Events.ts`
- Application listeners: `app/Listeners/`
- Listener config: `app/Listener.ts`
- Event types: `storage/framework/types/events.ts`
- Package: `@stacksjs/events`

## Architecture
- Events are defined in `app/Events.ts`
- Listeners are created in `app/Listeners/`
- Listener registration is configured in `app/Listener.ts`
- Events can be dispatched from actions, routes, jobs, or other listeners

## Creating Events
1. Define the event in `app/Events.ts`
2. Create a listener in `app/Listeners/`
3. Register the listener in `app/Listener.ts`

## Usage
```typescript
import { dispatch, on } from '@stacksjs/events'
```

## Gotchas
- Events are functional, not class-based
- Listeners can be async
- Event types are defined in `storage/framework/types/events.ts`
- Events integrate with the queue system for async processing
- Use events for decoupled communication between components
