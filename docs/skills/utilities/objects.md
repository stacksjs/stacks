---
title: "Objects skill"
description: "Use when working with object manipulation in Stacks."
---
# Objects

`stacks-objects` · Utilities · model-invoked

Type-safe deep merging, object mapping, strict key checking, typed entries and
keys, property picking, and clearing undefined values.

## When to reach for it

- Deep merging with type safety
- Object mapping/transformation
- Strict key checking
- Typed entries/keys
- Property picking
- Clearing undefined values
- The DeepMerge utility type

## Covers

`@stacksjs/objects`.

## Inside the skill

The sections an agent reads once the skill loads.

- Key Path
- Dependencies
- Functions
- Gotchas

## Using it

This one is **model-invoked**. Your agent reaches for it on its own when the task
matches, and you can also call it by name:

```
/stacks-objects
```

Source: [`stacks-objects/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-objects/SKILL.md).
Shadow it for one project with `app/Skills/stacks-objects/SKILL.md`, then re-run
`buddy setup:ai`. See [Writing your own](/skills/writing).
