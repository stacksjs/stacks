---
title: "Env skill"
description: "Use when working with environment variables in Stacks - the typed env proxy with auto-coercion, .env file loading, X25519 and AES-256-GCM encryption/decryption of env values, runtime/platform detection, CI provider detection, or the env CLI commands. Covers @stacksjs/env, config/env.ts, and .env files."
---
# Env

`stacks-env` · Native Stacks · model-invoked

Use when working with environment variables in Stacks - the typed env proxy with auto-coercion, .env file loading, X25519 and AES-256-GCM encryption/decryption of env values, runtime/platform detection, CI provider detection, or the env CLI commands. Covers @stacksjs/env, config/env.ts, and .env files.

Read the skill for the implementation workflow and its current signatures. The
[Native capabilities](/skills/platform/native) catalog maps the package to
source and retained evidence; driver limits are explicit.

## Inside the skill

- Key Paths
- Source Files
- Typed Environment Proxy
- StacksEnv Type (100+ typed variables)
- Adding your own variables
- Runtime Detection
- CI Provider Detection
- Remote integration environments
- .env File Loading
- .env Parser
- Encryption (X25519 + AES-256-GCM)
- CLI Commands
- Tenant isolation on a shared box
- Dashboard environment editor
- Gotchas

## Using it

This skill is **model-invoked**. Your agent can select it for matching tasks, and you can call it directly.

```text
/stacks-env
```

Source: [`stacks-env/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-env/SKILL.md).

It ships in `@stacksjs/defaults` with its supporting files. Run
`buddy setup:ai` to refresh the agent setup. Override it per project with
`app/Skills/stacks-env/SKILL.md`. See [Using skills](/skills/using).
