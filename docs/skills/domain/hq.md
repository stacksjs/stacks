---
title: "HQ skill"
description: "Use when metering usage against a plan allowance, answering the X-HQ-Usage header, mounting an HQ service's connect and usage endpoints, connecting an app with buddy hq:connect, or reading an HQ service from an app. Covers @stacksjs/hq (meter, service, client, testing), the HQ entries in config/services.ts and buddy hq:status."
---
# HQ

`stacks-hq` · Native Stacks · model-invoked

Use when metering usage against a plan allowance, answering the X-HQ-Usage header, mounting an HQ service's connect and usage endpoints, connecting an app with buddy hq:connect, or reading an HQ service from an app. Covers @stacksjs/hq (meter, service, client, testing), the HQ entries in config/services.ts and buddy hq:status.

Read the skill for the implementation workflow and its current signatures. The
[Native capabilities](/skills/platform/native) catalog maps the package to
source and retained evidence; driver limits are explicit.

## Inside the skill

- Meter
- The usage header
- Service contract
- Client
- Connecting an app
- Limits

## Using it

This skill is **model-invoked**. Your agent can select it for matching tasks, and you can call it directly.

```text
/stacks-hq
```

Source: [`stacks-hq/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-hq/SKILL.md).

It ships in `@stacksjs/defaults` with its supporting files. Run
`buddy setup:ai` to refresh the agent setup. Override it per project with
`app/Skills/stacks-hq/SKILL.md`. See [Using skills](/skills/using).
