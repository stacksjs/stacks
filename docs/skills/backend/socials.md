---
title: "Socials skill"
description: "Use when implementing social sign-in, Apple callbacks, PKCE/session handoff, named publishing identities, or publishing through native platform drivers. Covers @stacksjs/socials and config/socials.ts."
---
# Socials

`stacks-socials` · Native Stacks · model-invoked

Use when implementing social sign-in, Apple callbacks, PKCE/session handoff, named publishing identities, or publishing through native platform drivers. Covers @stacksjs/socials and config/socials.ts.

Read the skill for the implementation workflow and its current signatures. The
[Native capabilities](/skills/platform/native) catalog maps the package to
source and retained evidence; driver limits are explicit.

## Inside the skill

- Social sign-in
- Session handoff
- Named publishing identities
- Authorization and operational limits
- Source and evidence

## Using it

This skill is **model-invoked**. Your agent can select it for matching tasks, and you can call it directly.

```text
/stacks-socials
```

Source: [`stacks-socials/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-socials/SKILL.md).

It ships in `@stacksjs/defaults` with its supporting files. Run
`buddy setup:ai` to refresh the agent setup. Override it per project with
`app/Skills/stacks-socials/SKILL.md`. See [Using skills](/skills/using).
