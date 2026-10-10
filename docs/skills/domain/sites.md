---
title: "Sites skill"
description: "Use when resolving multi-site tenants by host, provisioning sites, scoping queries, or authorizing site-owned content. Covers @stacksjs/sites and config/sites.ts."
---
# Sites

`stacks-sites` · Native Stacks · model-invoked

Use when resolving multi-site tenants by host, provisioning sites, scoping queries, or authorizing site-owned content. Covers @stacksjs/sites and config/sites.ts.

Read the skill for the implementation workflow and its current signatures. The
[Native capabilities](/skills/platform/native) catalog maps the package to
source and retained evidence; driver limits are explicit.

## Inside the skill

- Resolution and explicit scoping
- Provisioning

## Using it

This skill is **model-invoked**. Your agent can select it for matching tasks, and you can call it directly.

```text
/stacks-sites
```

Source: [`stacks-sites/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-sites/SKILL.md).

It ships in `@stacksjs/defaults` with its supporting files. Run
`buddy setup:ai` to refresh the agent setup. Override it per project with
`app/Skills/stacks-sites/SKILL.md`. See [Using skills](/skills/using).
