---
title: "Arrays skill"
description: "Use when working with array utilities in Stacks - statistical operations (average, median, mode, standard deviation, z-score, percentile, covariance), array manipulation (unique, flatten, partition, shuffle, sample, move), containment checks, or the Arr facade. Covers @stacksjs/arrays."
---
# Arrays

`stacks-arrays` · Native Stacks · model-invoked

Use when working with array utilities in Stacks - statistical operations (average, median, mode, standard deviation, z-score, percentile, covariance), array manipulation (unique, flatten, partition, shuffle, sample, move), containment checks, or the Arr facade. Covers @stacksjs/arrays.

Read the skill for the implementation workflow and its current signatures. The
[Native capabilities](/skills/platform/native) catalog maps the package to
source and retained evidence; driver limits are explicit.

## Inside the skill

- Key Paths
- Architecture
- Array Manipulation (`helpers.ts`)
- Containment Checks (`contains.ts`)
- Statistical Functions (`math.ts`)
- Arr Facade (`macro.ts`)
- Typed transformations
- Type example
- Gotchas

## Using it

This skill is **model-invoked**. Your agent can select it for matching tasks, and you can call it directly.

```text
/stacks-arrays
```

Source: [`stacks-arrays/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-arrays/SKILL.md).

It ships in `@stacksjs/defaults` with its supporting files. Run
`buddy setup:ai` to refresh the agent setup. Override it per project with
`app/Skills/stacks-arrays/SKILL.md`. See [Using skills](/skills/using).
