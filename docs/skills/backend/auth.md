---
title: "Auth skill"
description: "Use when implementing authentication, authorization, passkeys, TOTP/2FA, RBAC, gates, policies, session auth, token management, email verification, password resets, or rate limiting in a Stacks application. Covers the @stacksjs/auth package, config/auth.ts, app/Gates.ts, and app/Middleware/."
---
# Auth

`stacks-auth` · Native Stacks · model-invoked

Use when implementing authentication, authorization, passkeys, TOTP/2FA, RBAC, gates, policies, session auth, token management, email verification, password resets, or rate limiting in a Stacks application. Covers the @stacksjs/auth package, config/auth.ts, app/Gates.ts, and app/Middleware/.

Read the skill for the implementation workflow and its current signatures. The
[Native capabilities](/skills/platform/native) catalog maps the package to
source and retained evidence; driver limits are explicit.

## Inside the skill

- Key Paths
- Source Files
- Auth Class (authentication.ts) - Static Methods
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
- Native account workflows
- Provider and entrypoint boundaries

## Supporting references

- [ACCOUNT-WORKFLOWS.md](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-auth/ACCOUNT-WORKFLOWS.md)

## Using it

This skill is **model-invoked**. Your agent can select it for matching tasks, and you can call it directly.

```text
/stacks-auth
```

Source: [`stacks-auth/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-auth/SKILL.md).

It ships in `@stacksjs/defaults` with its supporting files. Run
`buddy setup:ai` to refresh the agent setup. Override it per project with
`app/Skills/stacks-auth/SKILL.md`. See [Using skills](/skills/using).
