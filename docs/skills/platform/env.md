---
title: "Env skill"
description: "Use when working with environment variables in Stacks."
---
# Env

`stacks-env` · Platform · model-invoked

The typed env proxy with automatic coercion, `.env` loading, encryption and
decryption of individual values, runtime and CI detection, and the `buddy env:*`
commands.

## When to reach for it

- The typed env proxy with auto-coercion
- .env file loading
- X25519 and AES-256-GCM encryption/decryption of env values
- runtime/platform detection
- CI provider detection
- The env CLI commands

## Covers

`@stacksjs/env`, `config/env.ts`, .env files.

## Inside the skill

The sections an agent reads once the skill loads.

- Key Paths
- Source Files
- Typed Environment Proxy
- StacksEnv Type (100+ typed variables)
- Adding your own variables
- Runtime Detection
- CI Provider Detection
- .env File Loading
- .env Parser
- Encryption (X25519 + AES-256-GCM)
- CLI Commands
- Tenant isolation on a shared box
- Dashboard environment editor
- Gotchas

## Where the code lives

- Core package: `storage/framework/core/env/src/`
- Environment config: `config/env.ts`
- Environment file: `.env`
- Example: `.env.example`
- Type definitions: `storage/framework/env.d.ts`

## Using it

This one is **model-invoked**. Your agent reaches for it on its own when the task
matches, and you can also call it by name:

```
/stacks-env
```

Source: [`stacks-env/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-env/SKILL.md).
Shadow it for one project with `app/Skills/stacks-env/SKILL.md`, then re-run
`buddy setup:ai`. See [Writing your own](/skills/writing).
