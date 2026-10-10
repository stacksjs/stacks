---
title: "DNS skill"
description: "Use when managing DNS in a Stacks application - Route53 hosted zones, domain records, nameserver management, or DNS configuration. Covers @stacksjs/dns (AWS Route53 driver), @stacksjs/dnsx, and config/dns.ts."
---
# DNS

`stacks-dns` · Native Stacks · model-invoked

Use when managing DNS in a Stacks application - Route53 hosted zones, domain records, nameserver management, or DNS configuration. Covers @stacksjs/dns (AWS Route53 driver), @stacksjs/dnsx, and config/dns.ts.

Read the skill for the implementation workflow and its current signatures. The
[Native capabilities](/skills/platform/native) catalog maps the package to
source and retained evidence; driver limits are explicit.

## Inside the skill

- Declarative additive sync
- Native config record shapes
- Route53 zone and registrar helpers
- Boundaries and evidence

## Using it

This skill is **model-invoked**. Your agent can select it for matching tasks, and you can call it directly.

```text
/stacks-dns
```

Source: [`stacks-dns/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-dns/SKILL.md).

It ships in `@stacksjs/defaults` with its supporting files. Run
`buddy setup:ai` to refresh the agent setup. Override it per project with
`app/Skills/stacks-dns/SKILL.md`. See [Using skills](/skills/using).
