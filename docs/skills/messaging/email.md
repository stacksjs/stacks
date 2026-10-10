---
title: "Email skill"
description: "Use when working with email in a Stacks application - sending emails via SES/SendGrid/Mailgun/Mailtrap/SMTP, email templates with STX, email drivers, the Mail singleton, the EmailSDK for inbox management, inbound MIME parsing, or email configuration. Covers @stacksjs/email, config/email.ts, and app/Mail/."
---
# Email

`stacks-email` · Native Stacks · model-invoked

Use when working with email in a Stacks application - sending emails via SES/SendGrid/Mailgun/Mailtrap/SMTP, email templates with STX, email drivers, the Mail singleton, the EmailSDK for inbox management, inbound MIME parsing, or email configuration. Covers @stacksjs/email, config/email.ts, and app/Mail/.

Read the skill for the implementation workflow and its current signatures. The
[Native capabilities](/skills/platform/native) catalog maps the package to
source and retained evidence; driver limits are explicit.

## Inside the skill

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
- Delivery controls and provider evidence

## Supporting references

- [DELIVERY-CONTROLS.md](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-email/DELIVERY-CONTROLS.md)

## Using it

This skill is **model-invoked**. Your agent can select it for matching tasks, and you can call it directly.

```text
/stacks-email
```

Source: [`stacks-email/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-email/SKILL.md).

It ships in `@stacksjs/defaults` with its supporting files. Run
`buddy setup:ai` to refresh the agent setup. Override it per project with
`app/Skills/stacks-email/SKILL.md`. See [Using skills](/skills/using).
