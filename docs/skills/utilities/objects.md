---
title: "Objects skill"
description: "Use when working with object manipulation in Stacks - deep merging with type safety, object mapping/transformation, strict key checking, typed entries/keys, property picking, clearing undefined values, or the DeepMerge utility type. Covers @stacksjs/objects."
---
# Objects

`stacks-objects` · Native Stacks · model-invoked

Use when working with object manipulation in Stacks - deep merging with type safety, object mapping/transformation, strict key checking, typed entries/keys, property picking, clearing undefined values, or the DeepMerge utility type. Covers @stacksjs/objects.

Read the skill for the implementation workflow and its current signatures. The
[Native capabilities](/skills/platform/native) catalog maps the package to
source and retained evidence; driver limits are explicit.

## Inside the skill

- Key Path
- Dependencies
- Functions
- Additional native transforms
- Mutation and typing gotchas

## Using it

This skill is **model-invoked**. Your agent can select it for matching tasks, and you can call it directly.

```text
/stacks-objects
```

Source: [`stacks-objects/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-objects/SKILL.md).

It ships in `@stacksjs/defaults` with its supporting files. Run
`buddy setup:ai` to refresh the agent setup. Override it per project with
`app/Skills/stacks-objects/SKILL.md`. See [Using skills](/skills/using).
