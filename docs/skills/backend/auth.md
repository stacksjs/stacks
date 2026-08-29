---
title: "Auth skill"
description: "Use when implementing authentication, authorization, passkeys, TOTP/2FA, RBAC, gates, policies, session auth, token management, email verification, password resets, or rate limiting in a Stacks application."
---
# Auth

`stacks-auth` · Backend and API · model-invoked

Authentication and authorization end to end: passkeys, TOTP and 2FA, RBAC, gates
in `app/Gates.ts`, policies, sessions, tokens, email verification, password
resets and rate limiting.

## Covers

@stacksjs/auth package, `config/auth.ts`, `app/Gates.ts`, `app/Middleware/`.

## Inside the skill

The sections an agent reads once the skill loads.

- Key Paths
- Source Files
- Auth Class (authentication.ts) — Static Methods
- Token System (tokens.ts)
- Two-Factor Authentication (authenticator.ts)
- Authorization Gates (gate.ts)
- RBAC System (rbac.ts)
- Session Auth (session-auth.ts)
- Email Verification (email-verification.ts)
- Password Reset (password/reset.ts)
- Registration (register.ts)
- User Helpers (user.ts)
- Passkey/WebAuthn (passkey.ts)
- Auth Middleware (middleware.ts)
- Rate Limiter (rate-limiter.ts)
- Authorizable Mixin (authorizable.ts)
- Configuration
- Middleware Aliases (app/Middleware.ts)
- Application Gates (app/Gates.ts)
- Default API Routes
- User Model Traits
- Gotchas
- Build

## Where the code lives

- Core package source: `storage/framework/core/auth/src/`
- Configuration: `config/auth.ts`
- Security config: `config/security.ts`
- Hashing config: `config/hashing.ts`
- Application gates: `app/Gates.ts`
- Application middleware: `app/Middleware/`
- Middleware aliases: `app/Middleware.ts`
- Auth types: `storage/framework/core/types/src/auth.ts`

## Related skills

- [Middleware](/skills/backend/middleware)

## Using it

This one is **model-invoked**. Your agent reaches for it on its own when the task
matches, and you can also call it by name:

```
/stacks-auth
```

Source: [`stacks-auth/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-auth/SKILL.md).
Shadow it for one project with `app/Skills/stacks-auth/SKILL.md`, then re-run
`buddy setup:ai`. See [Writing your own](/skills/writing).
