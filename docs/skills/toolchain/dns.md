---
title: "DNS skill"
description: "Use when managing DNS in a Stacks application."
---
# DNS

`stacks-dns` · Toolchain · model-invoked

DNS through Route53: hosted zones, records and nameserver management.

## When to reach for it

- Route53 hosted zones
- Domain records
- Nameserver management
- DNS configuration

## Covers

`@stacksjs/dns` (AWS Route53 driver), `@stacksjs/dnsx`, `config/dns.ts`.

## Inside the skill

The sections an agent reads once the skill loads.

- Key Paths
- Source Files
- AWS Route53 API
- Configuration (config/dns.ts)
- CLI Commands
- Re-exports from @stacksjs/dnsx
- Gotchas

## Where the code lives

- Core package: `storage/framework/core/dns/src/`
- AWS driver: `storage/framework/core/dns/src/drivers/aws.ts`
- Config: `config/dns.ts`
- Package: `@stacksjs/dns`

## Using it

This one is **model-invoked**. Your agent reaches for it on its own when the task
matches, and you can also call it by name:

```
/stacks-dns
```

Source: [`stacks-dns/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-dns/SKILL.md).
Shadow it for one project with `app/Skills/stacks-dns/SKILL.md`, then re-run
`buddy setup:ai`. See [Writing your own](/skills/writing).
