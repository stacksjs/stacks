---
title: "Types skill"
description: "Use when working with TypeScript type definitions in a Stacks application - model types, request types, environment variables, event types, billing types, attribute types, or auto-imported globals. Covers storage/framework/types/ and storage/framework/core/types/src/."
---
# Types

`stacks-types` · Native Stacks · model-invoked

Use when working with TypeScript type definitions in a Stacks application - model types, request types, environment variables, event types, billing types, attribute types, or auto-imported globals. Covers storage/framework/types/ and storage/framework/core/types/src/.

Read the skill for the implementation workflow and its current signatures. The
[Native capabilities](/skills/platform/native) catalog maps the package to
source and retained evidence; driver limits are explicit.

## Inside the skill

- Model and query types
- Requests, actions and registries
- Events and environment
- Browser globals and component metadata
- Source and checks

## Using it

This skill is **model-invoked**. Your agent can select it for matching tasks, and you can call it directly.

```text
/stacks-types
```

Source: [`stacks-types/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-types/SKILL.md).

It ships in `@stacksjs/defaults` with its supporting files. Run
`buddy setup:ai` to refresh the agent setup. Override it per project with
`app/Skills/stacks-types/SKILL.md`. See [Using skills](/skills/using).
