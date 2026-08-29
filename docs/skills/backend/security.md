---
title: "Security skill"
description: "Use when implementing security in Stacks."
---
# Security

`stacks-security` · Backend and API · model-invoked

The primitives underneath auth: password hashing, app key generation, AES
encryption, hash verification and rehashing, plus the firewall, rate limit and IP
allowlist configuration.

## When to reach for it

- Password hashing (bcrypt/argon2)
- App key generation
- AES encryption/decryption
- Hash verification
- Rehashing detection
- Security configuration (firewall, rate limiting, IP allowlists)

## Covers

`@stacksjs/security`, `config/security.ts`.

## Inside the skill

The sections an agent reads once the skill loads.

- Key Paths
- Source Files
- App Key Generation
- Encryption / Decryption
- Password Hashing
- HashMakeOptions
- config/hashing.ts
- config/security.ts
- Gotchas

## Where the code lives

- Core package: `storage/framework/core/security/src/`
- Security config: `config/security.ts`
- Hashing config: `config/hashing.ts`

## Using it

This one is **model-invoked**. Your agent reaches for it on its own when the task
matches, and you can also call it by name:

```
/stacks-security
```

Source: [`stacks-security/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-security/SKILL.md).
Shadow it for one project with `app/Skills/stacks-security/SKILL.md`, then re-run
`buddy setup:ai`. See [Writing your own](/skills/writing).
