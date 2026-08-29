---
title: "New feature skill"
description: "Use when adding a new feature end-to-end in a Stacks application."
---
# New feature

`stacks-new-feature` · Engineering craft · model-invoked

The end-to-end build. Slice the work into tracer bullets first, each cutting a
narrow but complete path through model, migration, action, route and test, then
build them one at a time off the frontier. A change too wide to slice vertically
is sequenced expand, migrate, contract instead.

## When to reach for it

- Slicing the work into tracer bullets
- Then building each slice from model through migration
- Action
- Route
- Test and deploy

## Covers

recommended order of operations, blocking edges between slices, the expand-contract sequence for a wide refactor.

## Inside the skill

The sections an agent reads once the skill loads.

- Slice it first
- Workflow Overview
- Step 1: Define the Model
- Step 2: Generate & Run Migration
- Step 3: Create Actions
- Step 4: Define Routes
- Step 5: Add Event Listeners (Optional)
- Step 6: Write Tests
- Step 7: Lint & Deploy
- Common Patterns
- Gotchas

## Related skills

- [API](/skills/backend/api)
- [Plan review](/skills/craft/plan-review)
- [Review](/skills/craft/review)
- [Router](/skills/backend/router)
- [TDD](/skills/craft/tdd)

## Using it

This one is **model-invoked**. Your agent reaches for it on its own when the task
matches, and you can also call it by name:

```
/stacks-new-feature
```

Source: [`stacks-new-feature/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-new-feature/SKILL.md).
Shadow it for one project with `app/Skills/stacks-new-feature/SKILL.md`, then re-run
`buddy setup:ai`. See [Writing your own](/skills/writing).
