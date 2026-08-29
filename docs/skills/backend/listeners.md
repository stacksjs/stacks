---
title: "Listeners skill"
description: "Use when creating event listeners in app/Listeners/."
---
# Listeners

`stacks-listeners` · Backend and API · model-invoked

The other half of events: writing listeners in `app/Listeners/`, registering them,
the listener-to-action mapping, and how to tell whether one actually ran.

## When to reach for it

- The listener file structure
- Registering listeners in app/Events.ts
- The listener-to-action mapping pattern
- CLI event listeners in Console.ts
- Debugging listener execution

## Inside the skill

The sections an agent reads once the skill loads.

- Key Paths
- Event → Listener Mapping (app/Events.ts)
- How Listeners Work
- Creating a Listener Action
- Creating a Standalone Listener
- CLI Event Listeners (app/Listeners/Console.ts)
- Multiple Listeners Per Event
- Gotchas

## Where the code lives

- Listeners: `app/Listeners/`
- Event mapping: `app/Events.ts`
- Listener setup: `app/Listener.ts`

## Related skills

- [Events](/skills/backend/events)

## Using it

This one is **model-invoked**. Your agent reaches for it on its own when the task
matches, and you can also call it by name:

```
/stacks-listeners
```

Source: [`stacks-listeners/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-listeners/SKILL.md).
Shadow it for one project with `app/Skills/stacks-listeners/SKILL.md`, then re-run
`buddy setup:ai`. See [Writing your own](/skills/writing).
