---
name: stacks-config
description: Use when working with Stacks configuration — reading, modifying, or creating config files, understanding the configuration system, or resolving config values. Covers the @stacksjs/config package and the config/ directory with 44 configuration files.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Configuration

The `@stacksjs/config` package provides configuration helper methods, and the `config/` directory contains 44 configuration files for all framework aspects.

## Key Paths
- Core package: `storage/framework/core/config/src/`
- Configuration directory: `config/`
- Stacks config: `config/stacks.ts`
- Package: `@stacksjs/config`

## Configuration Files (44 total)
### Core App
- `config/app.ts` - Application name, description, environment, URL, timezone, locale
- `config/env.ts` - Environment variables
- `config/database.ts` - Database connections
- `config/cache.ts` - Cache configuration
- `config/stacks.ts` - Main Stacks framework config

### Authentication & Security
- `config/auth.ts` - Authentication settings
- `config/security.ts` - Security configuration
- `config/hashing.ts` - Password hashing settings

### Services & Integrations
- `config/email.ts` - Email service
- `config/sms.ts` - SMS service
- `config/notification.ts` - Notifications
- `config/payment.ts` - Payment processing
- `config/saas.ts` - SaaS features
- `config/cloud.ts` - Cloud provider
- `config/analytics.ts` - Analytics
- `config/ai.ts` - AI/LLM integration

### Development & Tooling
- `config/buddy-bot.ts` - Buddy bot configuration
- `config/cli.ts` - CLI config
- `config/lint.ts` - Linting rules
- `config/logging.ts` - Logging
- `config/commit.ts` - Commit conventions

### Domain & Infrastructure
- `config/dns.ts` - DNS
- `config/docs.ts` - Documentation
- `config/git.ts` - Git settings
- `config/ports.ts` - Development ports

### Advanced Features
- `config/blog.ts` - Blog/content
- `config/queue.ts` - Job queue
- `config/realtime.ts` - WebSocket/realtime
- `config/search-engine.ts` - Search engine
- `config/ui.ts` - UI framework
- `config/stx.ts` - STX template engine

### Data & Content
- `config/cms.ts` - CMS
- `config/team.ts` - Team/multi-tenancy
- `config/query-builder.ts` - Query builder
- `config/qb.ts` - Alternative QB config

### Infrastructure
- `config/deps.ts` - Dependencies
- `config/errors.ts` - Error handling
- `config/file-systems.ts` / `config/filesystems.ts` - File system
- `config/phone.ts` - Phone handling
- `config/library.ts` - Library settings

## Usage
```typescript
import { config } from '@stacksjs/config'
```

## Gotchas
- Config files are TypeScript — they support type-safe configuration
- All configs are in `config/` at the project root
- The `@stacksjs/env` package handles environment variable resolution
- Config changes may require a dev server restart
- Some configs have duplicate paths (e.g., `file-systems.ts` and `filesystems.ts`)
