---
name: stacks-listeners
description: Use when working with event listeners in a Stacks application — creating listeners, registering listeners for events, or debugging listener execution. Covers app/Listeners/ and app/Listener.ts.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Event Listeners

Event listeners respond to events dispatched in the Stacks application.

## Key Paths
- Application listeners: `app/Listeners/`
- Listener registration: `app/Listener.ts`
- Events: `app/Events.ts`
- Events package: `storage/framework/core/events/src/`

## Architecture
- Events are defined in `app/Events.ts`
- Listeners are created in `app/Listeners/`
- Event-listener mapping is configured in `app/Listener.ts`
- Listeners can be synchronous or asynchronous

## Creating a Listener
1. Create a listener file in `app/Listeners/`
2. Define the handler method
3. Map the listener to an event in `app/Listener.ts`

## Gotchas
- Listener registration is in `app/Listener.ts` (not `app/Listeners.ts`)
- Listeners can dispatch other events (be careful of infinite loops)
- Async listeners run in the background
- Listeners can queue jobs for heavy processing
