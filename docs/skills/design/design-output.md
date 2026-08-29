---
title: "Design: full output skill"
description: "Use when generating stx components or design deliverables in a Stacks app and completeness matters."
---
# Design: full output

`stacks-design-output` · Design · model-invoked

An enforcement layer for when an agent keeps truncating. It bans placeholder
comments and elisions so you get whole, runnable stx files rather than skeletons
with "rest of the component here" in them.

## When to reach for it

- Banning placeholder comments and truncation so you ship whole
- Runnable stx files instead of skeletons

## Inside the skill

The sections an agent reads once the skill loads.

- Baseline
- Banned Output Patterns
- Execution Process
- Handling Long Outputs
- Quick Check

## Related skills

- [Composables](/skills/frontend/composables)
- [Crosswind](/skills/frontend/crosswind)
- [Design: brutalist](/skills/design/design-brutalist)
- [Design: minimalist](/skills/design/design-minimalist)
- [Design: soft](/skills/design/design-soft)
- [Design taste](/skills/design/design-taste)
- [Redesign](/skills/design/redesign)
- [stx](/skills/frontend/stx)

## Using it

This one is **model-invoked**. Your agent reaches for it on its own when the task
matches, and you can also call it by name:

```
/stacks-design-output
```

Source: [`stacks-design-output/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-design-output/SKILL.md).
Shadow it for one project with `app/Skills/stacks-design-output/SKILL.md`, then re-run
`buddy setup:ai`. See [Writing your own](/skills/writing).
