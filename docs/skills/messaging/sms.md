---
title: "SMS skill"
description: "Use when implementing SMS in Stacks."
---
# SMS

`stacks-sms` · Messaging · model-invoked

Text messages through Twilio or Vonage: the fluent builder, templates, phone
verification with one-time codes, bulk sending and E.164 formatting.

## When to reach for it

- Sending text messages
- The SmsBuilder fluent API
- SMS templates
- Phone verification (OTP/2FA)
- Bulk sending
- Twilio/Vonage drivers
- E.164 formatting
- The SMS facade

## Covers

`@stacksjs/sms`, `config/sms.ts`.

## Inside the skill

The sections an agent reads once the skill loads.

- Key Paths
- Package Exports
- SMS Facade Object
- SmsBuilder (Fluent API)
- Direct Send Functions
- Message Status & Info
- Phone Verification (OTP/2FA)
- SMS Templates
- Phone Number Utilities
- Twilio Driver
- Vonage Driver
- Other Drivers (Commented Out / Placeholder)
- config/sms.ts
- Type Interfaces (from @stacksjs/types)
- Gotchas

## Where the code lives

- Core package: `storage/framework/core/sms/src/`
- SMS facade and builder: `storage/framework/core/sms/src/sms.ts`
- Twilio driver: `storage/framework/core/sms/src/drivers/twilio.ts`
- Vonage driver: `storage/framework/core/sms/src/drivers/vonage.ts`
- Drivers index: `storage/framework/core/sms/src/drivers/index.ts`
- Configuration: `config/sms.ts`

## Using it

This one is **model-invoked**. Your agent reaches for it on its own when the task
matches, and you can also call it by name:

```
/stacks-sms
```

Source: [`stacks-sms/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-sms/SKILL.md).
Shadow it for one project with `app/Skills/stacks-sms/SKILL.md`, then re-run
`buddy setup:ai`. See [Writing your own](/skills/writing).
