---
title: "Validation skill"
description: "Use when implementing validation in Stacks - type guards (isString, isNumber, isBoolean, isObject, isArray, isFunction, etc.), numeric checks (isPositive, isEven, isInteger), the schema builder for model attribute validation, or request validation. Covers @stacksjs/validation."
---
# Validation

`stacks-validation` · Native Stacks · model-invoked

Use when implementing validation in Stacks - type guards (isString, isNumber, isBoolean, isObject, isArray, isFunction, etc.), numeric checks (isPositive, isEven, isInteger), the schema builder for model attribute validation, or request validation. Covers @stacksjs/validation.

Read the skill for the implementation workflow and its current signatures. The
[Native capabilities](/skills/platform/native) catalog maps the package to
source and retained evidence; driver limits are explicit.

## Inside the skill

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
- Request, conditional and file validation

## Using it

This skill is **model-invoked**. Your agent can select it for matching tasks, and you can call it directly.

```text
/stacks-validation
```

Source: [`stacks-validation/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-validation/SKILL.md).

It ships in `@stacksjs/defaults` with its supporting files. Run
`buddy setup:ai` to refresh the agent setup. Override it per project with
`app/Skills/stacks-validation/SKILL.md`. See [Using skills](/skills/using).
