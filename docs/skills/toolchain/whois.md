---
title: "WHOIS skill"
description: "Use when performing WHOIS lookups in Stacks."
---
# WHOIS

`stacks-whois` · Toolchain · model-invoked

WHOIS lookups: single and batch queries, TLD server discovery, response parsing
and SOCKS proxy support.

## When to reach for it

- Domain queries
- Batch lookups
- SOCKS proxy support
- TLD server discovery
- Response parsing
- The WhoIsParser class
- The built-in SocksClient

## Covers

`@stacksjs/whois`.

## Inside the skill

The sections an agent reads once the skill loads.

- Key Paths
- Source Files
- Main Functions
- Server Discovery
- WhoIsParser
- Types
- SOCKS Proxy Support
- Built-in SocksClient (socks.ts)
- Constants
- Utility: shallowCopy (utils.ts)
- Exports from index.ts
- Dependencies
- Gotchas

## Where the code lives

- Core package: `storage/framework/core/whois/src/`

## Using it

This one is **model-invoked**. Your agent reaches for it on its own when the task
matches, and you can also call it by name:

```
/stacks-whois
```

Source: [`stacks-whois/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-whois/SKILL.md).
Shadow it for one project with `app/Skills/stacks-whois/SKILL.md`, then re-run
`buddy setup:ai`. See [Writing your own](/skills/writing).
