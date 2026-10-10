---
title: "SMS skill"
description: "Use when implementing SMS in Stacks - sending text messages, the SmsBuilder fluent API, SMS templates, phone verification (OTP/2FA), bulk sending, Twilio/Vonage drivers, E.164 formatting, or the SMS facade. Covers @stacksjs/sms and config/sms.ts."
---
# SMS

`stacks-sms` · Native Stacks · model-invoked

Use when implementing SMS in Stacks - sending text messages, the SmsBuilder fluent API, SMS templates, phone verification (OTP/2FA), bulk sending, Twilio/Vonage drivers, E.164 formatting, or the SMS facade. Covers @stacksjs/sms and config/sms.ts.

Read the skill for the implementation workflow and its current signatures. The
[Native capabilities](/skills/platform/native) catalog maps the package to
source and retained evidence; driver limits are explicit.

## Inside the skill

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
- Native inbound compliance and helpers

## Using it

This skill is **model-invoked**. Your agent can select it for matching tasks, and you can call it directly.

```text
/stacks-sms
```

Source: [`stacks-sms/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-sms/SKILL.md).

It ships in `@stacksjs/defaults` with its supporting files. Run
`buddy setup:ai` to refresh the agent setup. Override it per project with
`app/Skills/stacks-sms/SKILL.md`. See [Using skills](/skills/using).
