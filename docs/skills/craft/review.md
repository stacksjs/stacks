---
title: "Review skill"
description: "Use when reviewing code changes in a Stacks project."
---
# Review

`stacks-review` · Engineering craft · model-invoked

Two-axis review of a diff. Standards asks whether the code follows this repo's
rules and stays clear of the Fowler smell baseline. Spec asks whether it does
what was actually asked. The two are reported separately and never merged,
because code can follow every rule while implementing the wrong thing.

## When to reach for it

- A PR
- A branch
- Staged work
- The diff since a fixed point. Reviews on two axes
- Standards (does it follow this repo's rules and avoid the smell baseline) and Spec (does it do what was asked)
- Plus a test coverage audit and an auto-fix pass

## Inside the skill

The sections an agent reads once the skill loads.

- 1. Pin the scope
- 2. Identify the spec source
- 3. Run both axes
- 4. Test coverage audit
- Test coverage
- 5. Auto-fix
- Output
- Standards
- Spec
- Test coverage
- Summary
- Rules

## Related skills

- [Browse](/skills/craft/browse)
- [Models](/skills/data/models)
- [Office hours](/skills/craft/office-hours)
- [Plan review](/skills/craft/plan-review)
- [Retro](/skills/craft/retro)
- [Router](/skills/backend/router)
- [TDD](/skills/craft/tdd)

## Using it

This one is **model-invoked**. Your agent reaches for it on its own when the task
matches, and you can also call it by name:

```
/stacks-review
```

Source: [`stacks-review/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-review/SKILL.md).
Shadow it for one project with `app/Skills/stacks-review/SKILL.md`, then re-run
`buddy setup:ai`. See [Writing your own](/skills/writing).
