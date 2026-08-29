---
title: "Email skill"
description: "Use when working with email in a Stacks application."
---
# Email

`stacks-email` · Messaging · model-invoked

The email framework: SES, SendGrid, Mailgun, Mailtrap and SMTP drivers, the
`Mail` singleton, stx email templates, inbox management and inbound MIME parsing.

## When to reach for it

- Sending emails via SES/SendGrid/Mailgun/Mailtrap/SMTP
- Email templates with STX
- Email drivers
- The Mail singleton
- The EmailSDK for inbox management
- Inbound MIME parsing
- Email configuration

## Covers

`@stacksjs/email`, `config/email.ts`, `app/Mail/`.

## Inside the skill

The sections an agent reads once the skill loads.

- Key Paths
- Source Files
- Mail Singleton
- Email Class
- Template Rendering
- EmailSDK (Inbox Management via S3)
- Built-in Drivers
- Environment-backed configuration
- Driver Interface
- config/email.ts
- Application Mail Example
- Delivery persistence models
- Inbound MIME and attachment storage
- CLI Commands
- Gotchas

## Where the code lives

- Core package: `storage/framework/core/email/src/`
- Configuration: `config/email.ts`
- Application mail: `app/Mail/`
- Persistence models: `storage/framework/defaults/app/Models/EmailSuppression.ts`, `EmailIdempotency.ts`, `EmailWebhookEvent.ts`
- Email layouts: `storage/framework/defaults/resources/emails/layouts/`
- Email resources: `storage/framework/defaults/resources/emails/`

## Using it

This one is **model-invoked**. Your agent reaches for it on its own when the task
matches, and you can also call it by name:

```
/stacks-email
```

Source: [`stacks-email/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-email/SKILL.md).
Shadow it for one project with `app/Skills/stacks-email/SKILL.md`, then re-run
`buddy setup:ai`. See [Writing your own](/skills/writing).
