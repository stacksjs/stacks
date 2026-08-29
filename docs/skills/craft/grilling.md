---
title: "Grilling skill"
description: "Use when a plan, design or decision needs stress-testing before any code is written, when the user asks to be grilled or to have their thinking challenged, or when another skill needs the round-and-frontier interview primitive. Produces a shared understanding, never code."
---
# Grilling

`stacks-grilling` · Engineering craft · model-invoked

A relentless interview that stress-tests a plan before any code exists. It works
the decision tree in rounds: ask every question whose prerequisites are settled,
recommend an answer to each, then wait. Finding facts is the agent's job and the
decisions are yours, and the session ends when nothing is left silently assumed.

## Inside the skill

The sections an agent reads once the skill loads.

- Rounds and the frontier
- Facts are your job, decisions are the user's
- Done
- Do not build

## Related skills

- [New feature](/skills/craft/new-feature)
- [Office hours](/skills/craft/office-hours)
- [Plan review](/skills/craft/plan-review)
- [Prototype](/skills/craft/prototype)
- [Redesign](/skills/design/redesign)

## Using it

This one is **model-invoked**. Your agent reaches for it on its own when the task
matches, and you can also call it by name:

```
/stacks-grilling
```

Source: [`stacks-grilling/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-grilling/SKILL.md).
Shadow it for one project with `app/Skills/stacks-grilling/SKILL.md`, then re-run
`buddy setup:ai`. See [Writing your own](/skills/writing).
