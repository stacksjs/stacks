---
title: "Office hours skill"
description: "Use for structured product brainstorming about Stacks features."
---
# Office hours

`stacks-office-hours` · Engineering craft · model-invoked

A product thinking partner that produces design documents and never code. Two
modes: a diagnostic that pushes back hard on a new idea (demand signal, existing
alternatives, the smallest useful version) and a generative one that forces three
alternatives for every design decision on an existing feature.

## When to reach for it

- Two modes
- A startup diagnostic for new ideas and a builder generative mode for existing features

## Inside the skill

The sections an agent reads once the skill loads.

- How to run it
- Determine Mode
- Startup Mode: Diagnostic
- Idea Diagnostic: [name]
- Builder Mode: Generative
- Design: [feature name]
- Rules

## Related skills

- [Domain modeling](/skills/craft/domain-modeling)
- [Grilling](/skills/craft/grilling)
- [Plan review](/skills/craft/plan-review)

## Using it

This one is **model-invoked**. Your agent reaches for it on its own when the task
matches, and you can also call it by name:

```
/stacks-office-hours
```

Source: [`stacks-office-hours/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-office-hours/SKILL.md).
Shadow it for one project with `app/Skills/stacks-office-hours/SKILL.md`, then re-run
`buddy setup:ai`. See [Writing your own](/skills/writing).
