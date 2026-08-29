---
title: "Arrays skill"
description: "Use when working with array utilities in Stacks."
---
# Arrays

`stacks-arrays` · Utilities · model-invoked

Statistical operations (average, median, mode, standard deviation, z-score,
percentile, covariance) and array manipulation (unique, flatten, partition,
shuffle, sample, move), behind the `Arr` facade.

## When to reach for it

- Statistical operations (average, median, mode, standard deviation, z-score, percentile, covariance)
- Array manipulation (unique, flatten, partition, shuffle, sample, move)
- Containment checks
- The Arr facade

## Covers

`@stacksjs/arrays`.

## Inside the skill

The sections an agent reads once the skill loads.

- Key Paths
- Architecture
- Array Manipulation (`helpers.ts`)
- Containment Checks (`contains.ts`)
- Statistical Functions (`math.ts`)
- Arr Facade (`macro.ts`)
- Exported Types
- Gotchas

## Where the code lives

- Core package: `storage/framework/core/arrays/src/`
- Package: `@stacksjs/arrays`

## Using it

This one is **model-invoked**. Your agent reaches for it on its own when the task
matches, and you can also call it by name:

```
/stacks-arrays
```

Source: [`stacks-arrays/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-arrays/SKILL.md).
Shadow it for one project with `app/Skills/stacks-arrays/SKILL.md`, then re-run
`buddy setup:ai`. See [Writing your own](/skills/writing).
