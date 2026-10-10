---
title: "WHOIS skill"
description: "Use when performing WHOIS lookups in Stacks - domain queries, batch lookups, SOCKS proxy support, TLD server discovery, response parsing, the WhoIsParser class, or the built-in SocksClient. Covers @stacksjs/whois."
---
# WHOIS

`stacks-whois` · Native Stacks · model-invoked

Use when performing WHOIS lookups in Stacks - domain queries, batch lookups, SOCKS proxy support, TLD server discovery, response parsing, the WhoIsParser class, or the built-in SocksClient. Covers @stacksjs/whois.

Read the skill for the implementation workflow and its current signatures. The
[Native capabilities](/skills/platform/native) catalog maps the package to
source and retained evidence; driver limits are explicit.

## Inside the skill

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
- Lookup evidence

## Using it

This skill is **model-invoked**. Your agent can select it for matching tasks, and you can call it directly.

```text
/stacks-whois
```

Source: [`stacks-whois/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-whois/SKILL.md).

It ships in `@stacksjs/defaults` with its supporting files. Run
`buddy setup:ai` to refresh the agent setup. Override it per project with
`app/Skills/stacks-whois/SKILL.md`. See [Using skills](/skills/using).
