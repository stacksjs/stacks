---
title: "Security skill"
description: "Use when implementing security in Stacks - password hashing (bcrypt/argon2), app key generation, AES encryption/decryption, hash verification, rehashing detection, security configuration (firewall, rate limiting, IP allowlists), or GDPR data-subject requests (access export, erasure, retention, the processing register). Covers @stacksjs/security, config/security.ts and the GDPR layer in @stacksjs/orm."
---
# Security

`stacks-security` · Native Stacks · model-invoked

Use when implementing security in Stacks - password hashing (bcrypt/argon2), app key generation, AES encryption/decryption, hash verification, rehashing detection, security configuration (firewall, rate limiting, IP allowlists), or GDPR data-subject requests (access export, erasure, retention, the processing register). Covers @stacksjs/security, config/security.ts and the GDPR layer in @stacksjs/orm.

Read the skill for the implementation workflow and its current signatures. The
[Native capabilities](/skills/platform/native) catalog maps the package to
source and retained evidence; driver limits are explicit.

## Inside the skill

- Key Paths
- Source Files
- App Key Generation
- Encryption / Decryption
- Password Hashing
- HashMakeOptions
- config/hashing.ts
- config/security.ts
- Personal data and GDPR
- Gotchas
- Encryption and webhook contracts

## Using it

This skill is **model-invoked**. Your agent can select it for matching tasks, and you can call it directly.

```text
/stacks-security
```

Source: [`stacks-security/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-security/SKILL.md).

It ships in `@stacksjs/defaults` with its supporting files. Run
`buddy setup:ai` to refresh the agent setup. Override it per project with
`app/Skills/stacks-security/SKILL.md`. See [Using skills](/skills/using).
