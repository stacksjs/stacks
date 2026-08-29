---
title: "TDD skill"
description: "Use when building a feature or fixing a bug test-first in a Stacks project, when the user mentions red-green-refactor or vertical slices, or when deciding which seam a test belongs at."
---
# TDD

`stacks-tdd` · Engineering craft · model-invoked

The red-green discipline, as opposed to the test utilities that
[Testing](/skills/toolchain/testing) documents. It names the four seams a Stacks
app has and which one a given behaviour belongs at, and it is blunt about the
database: the framework hands you a real one, so a test that mocks the ORM is
testing the mock.

## Covers

red-green loop over bun test, `@stacksjs/testing`, seam selection, the test anti-patterns.

## Inside the skill

The sections an agent reads once the skill loads.

- What a good test is
- Seams: where tests go
- The database is not a boundary to mock
- Anti-patterns
- Rules of the loop
- Model-first order

## Supporting files

Reference and scripts the skill reaches for on demand, rather than loading up front.

- [`EXAMPLES.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-tdd/EXAMPLES.md)

## Related skills

- [Browse](/skills/craft/browse)
- [Codebase design](/skills/craft/codebase-design)
- [Migrations](/skills/data/migrations)
- [New feature](/skills/craft/new-feature)
- [Review](/skills/craft/review)
- [Testing](/skills/toolchain/testing)

## Using it

This one is **model-invoked**. Your agent reaches for it on its own when the task
matches, and you can also call it by name:

```
/stacks-tdd
```

Source: [`stacks-tdd/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-tdd/SKILL.md).
Shadow it for one project with `app/Skills/stacks-tdd/SKILL.md`, then re-run
`buddy setup:ai`. See [Writing your own](/skills/writing).
