---
title: "Codebase design skill"
description: "Use when designing or restructuring code in a Stacks project."
---
# Codebase design

`stacks-codebase-design` · Engineering craft · model-invoked

The shared vocabulary for designing deep modules: a lot of behaviour behind a
small interface, at a clean seam, testable through that interface. Stacks is
already built this way, which is why the words matter. The driver packages are
ports with two or more adapters each, the `app/` override model is a seam the
framework hands you, and `useApi` is the canonical deep interface.

## When to reach for it

- Shaping an action
- Package interface
- Deciding where a seam goes
- Choosing between a trait and a helper
- Making code testable
- Navigable
- When another skill needs the deep-module vocabulary (module, interface, depth, seam, adapter, leverage, locality)

## Inside the skill

The sections an agent reads once the skill loads.

- Glossary
- Deep versus shallow
- Principles
- Designing for testability
- Relationships
- Rejected framings
- Going deeper

## Supporting files

Reference and scripts the skill reaches for on demand, rather than loading up front.

- [`DEEPENING.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-codebase-design/DEEPENING.md)
- [`DESIGN-IT-TWICE.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-codebase-design/DESIGN-IT-TWICE.md)

## Related skills

- [Domain modeling](/skills/craft/domain-modeling)
- [TDD](/skills/craft/tdd)

## Using it

This one is **model-invoked**. Your agent reaches for it on its own when the task
matches, and you can also call it by name:

```
/stacks-codebase-design
```

Source: [`stacks-codebase-design/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-codebase-design/SKILL.md).
Shadow it for one project with `app/Skills/stacks-codebase-design/SKILL.md`, then re-run
`buddy setup:ai`. See [Writing your own](/skills/writing).
