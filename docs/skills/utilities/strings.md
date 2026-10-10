---
title: "Strings skill"
description: "Use when working with string utilities in Stacks - case conversion (camelCase, PascalCase, snake_case, kebab-case, CONSTANT_CASE, Train-Case, etc.), pluralization, string validation (email, URL, UUID, credit card, etc.), slug generation, random strings, template interpolation, or the Str facade. Covers @stacksjs/strings."
---
# Strings

`stacks-strings` · Native Stacks · model-invoked

Use when working with string utilities in Stacks - case conversion (camelCase, PascalCase, snake_case, kebab-case, CONSTANT_CASE, Train-Case, etc.), pluralization, string validation (email, URL, UUID, credit card, etc.), slug generation, random strings, template interpolation, or the Str facade. Covers @stacksjs/strings.

Read the skill for the implementation workflow and its current signatures. The
[Native capabilities](/skills/platform/native) catalog maps the package to
source and retained evidence; driver limits are explicit.

## Inside the skill

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

## Using it

This skill is **model-invoked**. Your agent can select it for matching tasks, and you can call it directly.

```text
/stacks-strings
```

Source: [`stacks-strings/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-strings/SKILL.md).

It ships in `@stacksjs/defaults` with its supporting files. Run
`buddy setup:ai` to refresh the agent setup. Override it per project with
`app/Skills/stacks-strings/SKILL.md`. See [Using skills](/skills/using).
