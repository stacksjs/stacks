---
name: stacks-email
description: Use when implementing email functionality in a Stacks application — sending emails, creating email templates, configuring email providers, or managing email lists. Covers @stacksjs/email, config/email.ts, and app/Mail/.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Email

The `@stacksjs/email` package provides email integration for creating, managing templates, and sending emails.

## Key Paths
- Core package: `storage/framework/core/email/src/`
- Configuration: `config/email.ts`
- Application mail: `app/Mail/`
- Default email layouts: `storage/framework/defaults/layouts/emails/`
- Default email resources: `storage/framework/defaults/resources/emails/`
- Email list model: `storage/framework/models/EmailList.ts`
- Package: `@stacksjs/email`

## CLI Commands
- `buddy email` - Email management commands
- `buddy mail` - Mail server commands

## Features
- Email template creation and management
- Email sending with provider abstraction
- Email list management
- HTML and text email support

## Architecture
- Email templates are defined in `app/Mail/`
- Email layouts in `storage/framework/defaults/layouts/emails/`
- Email configuration in `config/email.ts`
- Uses provider abstraction (SES, SMTP, etc.)

## Models
- `EmailList` - Email list/subscriber management

## Gotchas
- Email provider configuration is in `config/email.ts`
- Application mail classes go in `app/Mail/`
- Email layouts are separate from web layouts
- For SMS, use the separate `@stacksjs/sms` package
- For general notifications, use `@stacksjs/notifications`
