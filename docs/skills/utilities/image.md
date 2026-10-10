---
title: "Image skill"
description: "Use when generating responsive image variants, selecting image formats, signing transforms, or building native social cards and app imagery. Covers @stacksjs/image and its delivery/generation APIs."
---
# Image

`stacks-image` · Native Stacks · model-invoked

Use when generating responsive image variants, selecting image formats, signing transforms, or building native social cards and app imagery. Covers @stacksjs/image and its delivery/generation APIs.

Read the skill for the implementation workflow and its current signatures. The
[Native capabilities](/skills/platform/native) catalog maps the package to
source and retained evidence; driver limits are explicit.

## Inside the skill

- Responsive variants
- Generated assets

## Using it

This skill is **model-invoked**. Your agent can select it for matching tasks, and you can call it directly.

```text
/stacks-image
```

Source: [`stacks-image/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-image/SKILL.md).

It ships in `@stacksjs/defaults` with its supporting files. Run
`buddy setup:ai` to refresh the agent setup. Override it per project with
`app/Skills/stacks-image/SKILL.md`. See [Using skills](/skills/using).
