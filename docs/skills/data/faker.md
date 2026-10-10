---
title: "Faker skill"
description: "Use when working with fake data generation in a Stacks application - seeding databases, generating test data, model factories, or using faker utilities. Covers @stacksjs/faker (wrapper around ts-mocker) and its integration with the database seeder."
---
# Faker

`stacks-faker` · Native Stacks · model-invoked

Use when working with fake data generation in a Stacks application - seeding databases, generating test data, model factories, or using faker utilities. Covers @stacksjs/faker (wrapper around ts-mocker) and its integration with the database seeder.

Read the skill for the implementation workflow and its current signatures. The
[Native capabilities](/skills/platform/native) catalog maps the package to
source and retained evidence; driver limits are explicit.

## Inside the skill

- Key Paths
- Usage
- Modules
- Seeder Integration
- Gotchas

## Using it

This skill is **model-invoked**. Your agent can select it for matching tasks, and you can call it directly.

```text
/stacks-faker
```

Source: [`stacks-faker/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-faker/SKILL.md).

It ships in `@stacksjs/defaults` with its supporting files. Run
`buddy setup:ai` to refresh the agent setup. Override it per project with
`app/Skills/stacks-faker/SKILL.md`. See [Using skills](/skills/using).
