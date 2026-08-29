---
title: "Redesign skill"
description: "Use when auditing and upgrading an existing Stacks UI to premium quality."
---
# Redesign

`stacks-redesign` · Design · model-invoked

The audit-first companion to [Design taste](/skills/design/design-taste). It
finds the generic patterns and AI slop in existing stx templates, then fixes
layout, spacing, hierarchy, type, colour, states and copy without breaking what
works or migrating the stack.

## When to reach for it

- Finding AI-slop and generic patterns in stx templates
- Then fixing layout
- Spacing
- Hierarchy
- Type
- Color
- States
- Copy without breaking functionality
- Migrating the stack

## Inside the skill

The sections an agent reads once the skill loads.

- How This Works
- Design Audit
- Upgrade Techniques
- Fix Priority
- Rules

## Related skills

- [Composables](/skills/frontend/composables)
- [Crosswind](/skills/frontend/crosswind)
- [Design: brutalist](/skills/design/design-brutalist)
- [Design: minimalist](/skills/design/design-minimalist)
- [Design: soft](/skills/design/design-soft)
- [Design taste](/skills/design/design-taste)
- [stx](/skills/frontend/stx)
- [UI](/skills/frontend/ui)

## Using it

This one is **model-invoked**. Your agent reaches for it on its own when the task
matches, and you can also call it by name:

```
/stacks-redesign
```

Source: [`stacks-redesign/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-redesign/SKILL.md).
Shadow it for one project with `app/Skills/stacks-redesign/SKILL.md`, then re-run
`buddy setup:ai`. See [Writing your own](/skills/writing).
