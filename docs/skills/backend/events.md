---
title: "Events skill"
description: "Use when working with the event system in a Stacks application."
---
# Events

`stacks-events` · Backend and API · model-invoked

Dispatching and listening: the event emitter, model events that fire on their own
when a model sets `observe: true`, wildcard listeners, and the `app/Events.ts`
registry.

## When to reach for it

- Dispatching events
- Listening for events
- Model events
- Wildcard listeners
- The event emitter
- Event-driven architecture

## Covers

`@stacksjs/events`, `app/Events.ts`, `app/Listener.ts`, `app/Listeners/`.

## Inside the skill

The sections an agent reads once the skill loads.

- Key Paths
- Core mitt Implementation (index.ts)
- Stacks Event System Exports
- Built-in Event Types (StacksEvents)
- Model Events
- Event-to-Listener Mapping (app/Events.ts)
- Listener Resolution (app/Listener.ts)
- Implementation Details
- Gotchas

## Where the code lives

- Core package: `storage/framework/core/events/src/index.ts` (single file -- entire implementation)
- Application events: `app/Events.ts`
- Listener setup: `app/Listener.ts`
- Listeners: `app/Listeners/`
- Event types: `storage/framework/types/events.ts`

## Using it

This one is **model-invoked**. Your agent reaches for it on its own when the task
matches, and you can also call it by name:

```
/stacks-events
```

Source: [`stacks-events/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-events/SKILL.md).
Shadow it for one project with `app/Skills/stacks-events/SKILL.md`, then re-run
`buddy setup:ai`. See [Writing your own](/skills/writing).
