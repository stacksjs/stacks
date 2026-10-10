---
title: "Events skill"
description: "Use when working with the event system in a Stacks application - dispatching events, listening for events, model events, wildcard listeners, the event emitter, or event-driven architecture. Covers @stacksjs/events, app/Events.ts, app/Listener.ts, and app/Listeners/."
---
# Events

`stacks-events` · Native Stacks · model-invoked

Use when working with the event system in a Stacks application - dispatching events, listening for events, model events, wildcard listeners, the event emitter, or event-driven architecture. Covers @stacksjs/events, app/Events.ts, app/Listener.ts, and app/Listeners/.

Read the skill for the implementation workflow and its current signatures. The
[Native capabilities](/skills/platform/native) catalog maps the package to
source and retained evidence; driver limits are explicit.

## Inside the skill

- Dispatch and completion
- Typed application events
- Application listeners
- Model lifecycle
- Isolation and cleanup
- Source and verification

## Using it

This skill is **model-invoked**. Your agent can select it for matching tasks, and you can call it directly.

```text
/stacks-events
```

Source: [`stacks-events/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-events/SKILL.md).

It ships in `@stacksjs/defaults` with its supporting files. Run
`buddy setup:ai` to refresh the agent setup. Override it per project with
`app/Skills/stacks-events/SKILL.md`. See [Using skills](/skills/using).
