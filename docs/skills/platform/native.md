---
title: "Native skill"
description: "Use when planning or implementing a Stacks feature, choosing a native API, or checking which framework capability already solves a task. A verified cheat sheet of the idiomatic call for every subsystem (models, queries, actions, routes, auth, jobs, events, mail, cache, storage, search, CMS, commerce, AI, stx, CLI, tests, deploy) plus the native package catalog, driver evidence and cross-package gotchas."
---
# Native

`stacks-native` · Native Stacks · model-invoked

Use when planning or implementing a Stacks feature, choosing a native API, or checking which framework capability already solves a task. A verified cheat sheet of the idiomatic call for every subsystem (models, queries, actions, routes, auth, jobs, events, mail, cache, storage, search, CMS, commerce, AI, stx, CLI, tests, deploy) plus the native package catalog, driver evidence and cross-package gotchas.

Read the skill for a verified cheat sheet: the idiomatic call for each subsystem, the gotcha it most often causes, and the skill to read next. The
[Native capabilities](/skills/platform/native) catalog maps the package to
source and retained evidence; driver limits are explicit.

## Inside the skill

- Ten rules that prevent the most common mistakes
- Data: models, queries, transactions, pagination, migrations
- HTTP: actions, routes, middleware, responses, validation
- Auth and access: sessions, tokens, 2FA, passkeys, gates, policies
- Background work: jobs, scheduler, events and listeners
- Messaging: mail, notifications, SMS, push, chat, realtime
- Platform services: cache, storage, search, logging, env, i18n, feature flags
- Domains: CMS, payments, commerce, AI, sites, analytics, images
- Utilities, stx frontend, CLI commands, tests, dev and deploy
- Cross-cutting boundaries and keeping it current

## Supporting references

- [RECIPES.md](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-native/RECIPES.md)
- [CAPABILITIES.md](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-native/CAPABILITIES.md)
- [CATALOG.md](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-native/CATALOG.md)

## Using it

This skill is **model-invoked**. Your agent can select it for matching tasks, and you can call it directly.

```text
/stacks-native
```

Source: [`stacks-native/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-native/SKILL.md).

It ships in `@stacksjs/defaults` with its supporting files. Run
`buddy setup:ai` to refresh the agent setup. Override it per project with
`app/Skills/stacks-native/SKILL.md`. See [Using skills](/skills/using).
