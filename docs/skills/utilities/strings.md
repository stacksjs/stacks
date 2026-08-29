---
title: "Strings skill"
description: "Use when working with string utilities in Stacks."
---
# Strings

`stacks-strings` · Utilities · model-invoked

Case conversion in every direction, pluralization, validation helpers, slug
generation, random strings and template interpolation, behind the `Str` facade.

## When to reach for it

- Case conversion (camelCase, PascalCase, snake_case, kebab-case, CONSTANT_CASE, Train-Case, etc.)
- Pluralization
- String validation (email, URL, UUID, credit card, etc.)
- Slug generation
- Random strings
- Template interpolation
- The Str facade

## Covers

`@stacksjs/strings`.

## Inside the skill

The sections an agent reads once the skill loads.

- Key Paths
- Architecture
- Case Conversion Functions
- Pluralization
- Slug Generation
- String Utilities
- String Validators
- Newline & Indentation Detection
- Str Facade Object
- Exported Constants
- Exported Types
- Gotchas

## Where the code lives

- Core package: `storage/framework/core/strings/src/`
- Package: `@stacksjs/strings`
- Entry: `storage/framework/core/strings/src/string.ts` (re-exports all submodules)

## Using it

This one is **model-invoked**. Your agent reaches for it on its own when the task
matches, and you can also call it by name:

```
/stacks-strings
```

Source: [`stacks-strings/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-strings/SKILL.md).
Shadow it for one project with `app/Skills/stacks-strings/SKILL.md`, then re-run
`buddy setup:ai`. See [Writing your own](/skills/writing).
