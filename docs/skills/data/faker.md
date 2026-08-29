---
title: "Faker skill"
description: "Use when working with fake data generation in a Stacks application."
---
# Faker

`stacks-faker` · Data layer · model-invoked

Fake data generation for seeders and tests, wrapping `ts-mocker`. The per-attribute
`factory` functions in a model definition are driven from here, which is what
makes `buddy seed` produce realistic rows.

## When to reach for it

- Seeding databases
- Generating test data
- Model factories
- Using faker utilities

## Covers

`@stacksjs/faker` (wrapper around ts-mocker), its integration with the database seeder.

## Inside the skill

The sections an agent reads once the skill loads.

- Key Paths
- Usage
- Modules
- Seeder Integration
- Gotchas

## Where the code lives

- Core package: `storage/framework/core/faker/src/`
- Source: `storage/framework/core/faker/src/index.ts`
- Tests: `storage/framework/core/faker/tests/faker.test.ts`
- Seeder integration: `storage/framework/core/database/src/seeder.ts`

## Using it

This one is **model-invoked**. Your agent reaches for it on its own when the task
matches, and you can also call it by name:

```
/stacks-faker
```

Source: [`stacks-faker/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-faker/SKILL.md).
Shadow it for one project with `app/Skills/stacks-faker/SKILL.md`, then re-run
`buddy setup:ai`. See [Writing your own](/skills/writing).
