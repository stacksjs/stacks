---
title: "Prototype skill"
description: "Use when a design question needs a runnable answer rather than an argument."
---
# Prototype

`stacks-prototype` · Engineering craft · model-invoked

Throwaway code that answers exactly one design question. Two branches: a single
shareable HTML file that lets a non-developer drive a state model by clicking
buttons, or several radically different stx variants of one view. The answer
folds into the real code and the prototype itself is kept on a branch, out of
`main`.

## When to reach for it

- Does this state model hold up
- What should this page look like
- Is this API shape right. Builds throwaway code that answers one question
- Either a single shareable HTML demo
- Several stx view variants

## Inside the skill

The sections an agent reads once the skill loads.

- Pick a branch
- Rules that apply to both
- What a prototype is not

## Supporting files

Reference and scripts the skill reaches for on demand, rather than loading up front.

- [`LOGIC.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-prototype/LOGIC.md)
- [`UI.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-prototype/UI.md)

## Related skills

- [Design taste](/skills/design/design-taste)
- [New feature](/skills/craft/new-feature)
- [Plan review](/skills/craft/plan-review)

## Using it

This one is **model-invoked**. Your agent reaches for it on its own when the task
matches, and you can also call it by name:

```
/stacks-prototype
```

Source: [`stacks-prototype/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-prototype/SKILL.md).
Shadow it for one project with `app/Skills/stacks-prototype/SKILL.md`, then re-run
`buddy setup:ai`. See [Writing your own](/skills/writing).
