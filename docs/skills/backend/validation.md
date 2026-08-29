---
title: "Validation skill"
description: "Use when implementing validation in Stacks."
---
# Validation

`stacks-validation` · Backend and API · model-invoked

Type guards, numeric checks, and the schema builder that model attributes and
request validation are both written against.

## When to reach for it

- Type guards (isString, isNumber, isBoolean, isObject, isArray, isFunction, etc.)
- Numeric checks (isPositive, isEven, isInteger)
- The schema builder for model attribute validation
- Request validation

## Covers

`@stacksjs/validation`.

## Inside the skill

The sections an agent reads once the skill loads.

- Key Paths
- Architecture
- Type Guards (`index.ts`)
- Extended Type Guards (`is.ts`)
- Numeric Checks (`is.ts`)
- Schema Builder (`schema.ts`)
- Model Validation (`validator.ts`)
- Error Reporter (`reporter.ts`)
- Error Reporter Contract (from `rules.ts`)
- Re-exports from @stacksjs/ts-validation
- Validation Types (`types/index.ts`)
- Gotchas

## Where the code lives

- Core package: `storage/framework/core/validation/src/`
- Package: `@stacksjs/validation`

## Using it

This one is **model-invoked**. Your agent reaches for it on its own when the task
matches, and you can also call it by name:

```
/stacks-validation
```

Source: [`stacks-validation/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-validation/SKILL.md).
Shadow it for one project with `app/Skills/stacks-validation/SKILL.md`, then re-run
`buddy setup:ai`. See [Writing your own](/skills/writing).
