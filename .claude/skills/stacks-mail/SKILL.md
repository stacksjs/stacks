---
name: stacks-mail
description: Use when creating mail classes and templates in a Stacks application — defining email content, email layouts, or mail configuration. Covers app/Mail/ and email template system.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Mail

Mail classes define email content and templates in a Stacks application.

## Key Paths
- Application mail: `app/Mail/`
- Email config: `config/email.ts`
- Email layouts: `storage/framework/defaults/layouts/emails/`
- Email resources: `storage/framework/defaults/resources/emails/`
- Email package: `storage/framework/core/email/src/`

## Architecture
- Mail classes in `app/Mail/` define email structure
- Email layouts provide base HTML structure
- Templates support dynamic content
- Configured providers handle sending

## Creating Mail
1. Create a mail class in `app/Mail/`
2. Define subject, recipients, and body
3. Use email layouts for consistent branding
4. Send via actions, listeners, or scheduled tasks

## Gotchas
- Mail classes go in `app/Mail/`
- Layouts are in `storage/framework/defaults/layouts/emails/`
- Email provider configuration is in `config/email.ts`
- Use `@stacksjs/notifications` for multi-channel messaging
