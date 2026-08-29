---
title: "Guard skill"
description: "Use for safety rails in a Stacks project."
---
# Guard

`stacks-guard` · Engineering craft · model-invoked

Safety rails, in two layers. The catalogue tells the agent which commands are
catastrophic, which merely warrant a warning, and which are worth noting. The
bundled PreToolUse hook makes it enforcement rather than advice, blocking the
unrecoverable ones before they execute while leaving `rm -rf node_modules` and a
local `migrate:fresh` alone.

## When to reach for it

- Detecting destructive commands (rm -rf, DROP TABLE, force-push, git reset --hard, migrate:fresh against production)
- Installing a PreToolUse hook that blocks them before they run
- Freeze mode for focused debugging
- A pre-commit safety scan

## Inside the skill

The sections an agent reads once the skill loads.

- Destructive Command Detection
- Freeze Mode
- Pre-Commit Safety
- Stacks-Specific Guards
- Make it enforcing
- Rules

## Supporting files

Reference and scripts the skill reaches for on demand, rather than loading up front.

- [`scripts/block-destructive.sh`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-guard/scripts/block-destructive.sh)

## Related skills

- [Retro](/skills/craft/retro)
- [Wizard](/skills/craft/wizard)

## Using it

This one is **model-invoked**. Your agent reaches for it on its own when the task
matches, and you can also call it by name:

```
/stacks-guard
```

Source: [`stacks-guard/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-guard/SKILL.md).
Shadow it for one project with `app/Skills/stacks-guard/SKILL.md`, then re-run
`buddy setup:ai`. See [Writing your own](/skills/writing).
