---
title: "Realtime skill"
description: "Use when implementing real-time features in Stacks."
---
# Realtime

`stacks-realtime` · Backend and API · model-invoked

WebSocket broadcasting: public, private and presence channels, emitting to a
specific user, the `Channel` class, broadcast discovery and the server lifecycle.

## When to reach for it

- WebSocket broadcasting
- public/private/presence channels
- Emit to users
- The Channel class
- Broadcast discovery
- Server lifecycle
- Realtime configuration

## Covers

`@stacksjs/realtime`, `config/realtime.ts`.

## Inside the skill

The sections an agent reads once the skill loads.

- Key Paths
- Source Files
- Exports (from index.ts)
- Emit Functions
- Channel Class
- Server Lifecycle
- Broadcast Discovery
- Legacy/Backward Compatibility
- config/realtime.ts
- Gotchas

## Where the code lives

- Core package: `storage/framework/core/realtime/src/`
- Configuration: `config/realtime.ts`
- Application broadcasts: `app/Broadcasts/`

## Using it

This one is **model-invoked**. Your agent reaches for it on its own when the task
matches, and you can also call it by name:

```
/stacks-realtime
```

Source: [`stacks-realtime/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-realtime/SKILL.md).
Shadow it for one project with `app/Skills/stacks-realtime/SKILL.md`, then re-run
`buddy setup:ai`. See [Writing your own](/skills/writing).
