---
name: stacks-sms
description: Use when implementing SMS messaging in a Stacks application — sending text messages, SMS templates, or SMS provider configuration. Covers @stacksjs/sms and config/sms.ts.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks SMS

The `@stacksjs/sms` package provides SMS integration for creating, managing templates, and sending text messages.

## Key Paths
- Core package: `storage/framework/core/sms/src/`
- Configuration: `config/sms.ts`
- Package: `@stacksjs/sms`

## CLI Commands
- `buddy sms` - SMS management commands

## Features
- SMS template management
- SMS sending with provider abstraction
- Phone number handling
- SMS notification channel

## Configuration
Edit `config/sms.ts` for SMS provider settings and defaults.

## Integration
- Works as a channel within `@stacksjs/notifications`
- Phone number utilities via `config/phone.ts`
- Can be triggered from events, jobs, or actions

## Gotchas
- SMS provider API keys go in `.env`
- Phone configuration is in `config/phone.ts`
- For email, use `@stacksjs/email` instead
- SMS is one notification channel — use `@stacksjs/notifications` for multi-channel
