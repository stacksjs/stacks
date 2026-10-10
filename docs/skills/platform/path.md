---
title: "Path skill"
description: "Use when working with file paths in Stacks - 100+ framework-aware path builder functions for every directory in the project (actions, app, config, database, models, routes, storage, etc.), plus Node.js path utilities (join, resolve, basename, dirname, etc.). Covers @stacksjs/path."
---
# Path

`stacks-path` · Native Stacks · model-invoked

Use when working with file paths in Stacks - 100+ framework-aware path builder functions for every directory in the project (actions, app, config, database, models, routes, storage, etc.), plus Node.js path utilities (join, resolve, basename, dirname, etc.). Covers @stacksjs/path.

Read the skill for the implementation workflow and its current signatures. The
[Native capabilities](/skills/platform/native) catalog maps the package to
source and retained evidence; driver limits are explicit.

## Inside the skill

- Key Path
- Node.js Path Re-exports
- Framework Path Builders
- Path with Suffix
- Gotchas

## Using it

This skill is **model-invoked**. Your agent can select it for matching tasks, and you can call it directly.

```text
/stacks-path
```

Source: [`stacks-path/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-path/SKILL.md).

It ships in `@stacksjs/defaults` with its supporting files. Run
`buddy setup:ai` to refresh the agent setup. Override it per project with
`app/Skills/stacks-path/SKILL.md`. See [Using skills](/skills/using).
