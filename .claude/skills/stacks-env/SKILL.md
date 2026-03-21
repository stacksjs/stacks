---
name: stacks-env
description: Use when working with environment variables in a Stacks application — reading .env files, configuring environment-specific values, or managing environment types. Covers @stacksjs/env, config/env.ts, and .env files.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Environment

The `@stacksjs/env` package provides environment variable helpers for the Stacks framework.

## Key Paths
- Core package: `storage/framework/core/env/src/`
- Environment config: `config/env.ts`
- Environment file: `.env`
- Example: `.env.example`
- Type definitions: `storage/framework/env.d.ts`, `storage/framework/env.ts`
- Package: `@stacksjs/env`

## Environment Files
- `.env` - Local environment variables (gitignored)
- `.env.example` - Template with required variables

## Type Safety
- Environment types defined in `storage/framework/env.d.ts`
- Runtime env access through `@stacksjs/env`
- Bun natively loads `.env` files

## Usage
```typescript
import { env } from '@stacksjs/env'
```

## Gotchas
- Never commit `.env` files with secrets
- `.env.example` should list all required variables without values
- Bun automatically loads `.env` — no dotenv package needed
- Environment types provide autocomplete and type checking
- Use `buddy env` CLI command for environment management
