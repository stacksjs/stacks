---
title: "Licensing skill"
description: "Use when selling software licenses from a Stacks app - issuing a license key from a payment webhook, device activations and limits, team seats, refund revocation, resend and transfer, the Ed25519-signed offline license token, or the desktop license client with offline grace."
---
# Licensing

`stacks-licensing` · Native Stacks · model-invoked

Use when selling software licenses from a Stacks app - issuing a license key from a payment webhook, device activations and limits, team seats, refund revocation, resend and transfer, the Ed25519-signed offline license token, or the desktop license client with offline grace. Covers the licensing module of @stacksjs/commerce and @stacksjs/commerce/licensing/client.

Read the skill for the implementation workflow and its current signatures. The
[Native capabilities](/skills/platform/native) catalog maps the package to
source and retained evidence; driver limits are explicit.

## Inside the skill

- Key paths
- Tiers
- Setup
- Selling a license
- Server functions
- Routes
- The token
- The client
- Gotchas

## Using it

This skill is **model-invoked**. Your agent can select it for matching tasks, and you can call it directly.

```text
/stacks-licensing
```

Source: [`stacks-licensing/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-licensing/SKILL.md).

It ships in `@stacksjs/defaults` with its supporting files. Run
`buddy setup:ai` to refresh the agent setup. Override it per project with
`app/Skills/stacks-licensing/SKILL.md`. See [Using skills](/skills/using).

The guide is [Software licensing](/guide/commerce/licensing).
