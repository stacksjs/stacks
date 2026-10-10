---
title: "Realtime skill"
description: "Use when implementing real-time features in Stacks - WebSocket broadcasting, public/private/presence channels, emit to users, the Channel class, broadcast discovery, server lifecycle, or realtime configuration. Covers @stacksjs/realtime and config/realtime.ts."
---
# Realtime

`stacks-realtime` · Native Stacks · model-invoked

Use when implementing real-time features in Stacks - WebSocket broadcasting, public/private/presence channels, emit to users, the Channel class, broadcast discovery, server lifecycle, or realtime configuration. Covers @stacksjs/realtime and config/realtime.ts.

Read the skill for the implementation workflow and its current signatures. The
[Native capabilities](/skills/platform/native) catalog maps the package to
source and retained evidence; driver limits are explicit.

## Inside the skill

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
- Capability evidence

## Using it

This skill is **model-invoked**. Your agent can select it for matching tasks, and you can call it directly.

```text
/stacks-realtime
```

Source: [`stacks-realtime/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-realtime/SKILL.md).

It ships in `@stacksjs/defaults` with its supporting files. Run
`buddy setup:ai` to refresh the agent setup. Override it per project with
`app/Skills/stacks-realtime/SKILL.md`. See [Using skills](/skills/using).
