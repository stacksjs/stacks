---
title: "Slug skill"
description: "Use when generating URL slugs in Stacks."
---
# Slug

`stacks-slug` · Utilities · model-invoked

URL slugs, including unique ones that check the database for collisions before
returning.

## When to reach for it

- Creating unique slugs with database collision detection
- The uniqueSlug function with table/column configuration
- Basic slugification

## Covers

`@stacksjs/slug`.

## Inside the skill

The sections an agent reads once the skill loads.

- Key Paths
- Unique Slug (with Database Check)
- Basic Slugify (No Database Check)
- Model Usage
- SlugifyOptions
- Gotchas

## Where the code lives

- Core package: `storage/framework/core/slug/src/`

## Using it

This one is **model-invoked**. Your agent reaches for it on its own when the task
matches, and you can also call it by name:

```
/stacks-slug
```

Source: [`stacks-slug/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-slug/SKILL.md).
Shadow it for one project with `app/Skills/stacks-slug/SKILL.md`, then re-run
`buddy setup:ai`. See [Writing your own](/skills/writing).
