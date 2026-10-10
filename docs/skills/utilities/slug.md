---
title: "Slug skill"
description: "Use when generating URL slugs in Stacks - creating unique slugs with database collision detection, the uniqueSlug function with table/column configuration, or basic slugification. Covers @stacksjs/slug."
---
# Slug

`stacks-slug` · Native Stacks · model-invoked

Use when generating URL slugs in Stacks - creating unique slugs with database collision detection, the uniqueSlug function with table/column configuration, or basic slugification. Covers @stacksjs/slug.

Read the skill for the implementation workflow and its current signatures. The
[Native capabilities](/skills/platform/native) catalog maps the package to
source and retained evidence; driver limits are explicit.

## Inside the skill

- Key Paths
- Unique Slug (with Database Check)
- Basic Slugify (No Database Check)
- Model Usage
- SlugifyOptions
- Gotchas

## Using it

This skill is **model-invoked**. Your agent can select it for matching tasks, and you can call it directly.

```text
/stacks-slug
```

Source: [`stacks-slug/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-slug/SKILL.md).

It ships in `@stacksjs/defaults` with its supporting files. Run
`buddy setup:ai` to refresh the agent setup. Override it per project with
`app/Skills/stacks-slug/SKILL.md`. See [Using skills](/skills/using).
