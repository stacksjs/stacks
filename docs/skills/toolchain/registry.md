---
title: "Registry skill"
description: "Use when working with the Stacks extension registry - framework extension metadata, package discovery, or the registry system. Covers @stacksjs/registry."
---
# Registry

`stacks-registry` · Native Stacks · model-invoked

Use when working with the Stacks extension registry - framework extension metadata, package discovery, or the registry system. Covers @stacksjs/registry.

Read the skill for the implementation workflow and its current signatures. The
[Native capabilities](/skills/platform/native) catalog maps the package to
source and retained evidence; driver limits are explicit.

## Inside the skill



## Using it

This skill is **model-invoked**. Your agent can select it for matching tasks, and you can call it directly.

```text
/stacks-registry
```

Source: [`stacks-registry/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-registry/SKILL.md).

It ships in `@stacksjs/defaults` with its supporting files. Run
`buddy setup:ai` to refresh the agent setup. Override it per project with
`app/Skills/stacks-registry/SKILL.md`. See [Using skills](/skills/using).
