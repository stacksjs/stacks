---
title: "CMS skill"
description: "Use when working with Stacks CMS posts, authors, block-document pages, revisions, menus, redirects, scheduled publishing, blog feeds, or public page serving. Covers @stacksjs/cms, site-scoped CMS models, routes, and actions."
---
# CMS

`stacks-cms` · Native Stacks · model-invoked

Use when working with Stacks CMS posts, authors, block-document pages, revisions, menus, redirects, scheduled publishing, blog feeds, or public page serving. Covers @stacksjs/cms, site-scoped CMS models, routes, and actions.

Read the skill for the implementation workflow and its current signatures. The
[Native capabilities](/skills/platform/native) catalog maps the package to
source and retained evidence; driver limits are explicit.

## Inside the skill

- Key Paths
- Source Files
- CMS Namespace
- Models
- Posts API
- Authors API
- Tags API
- Comments API
- Routes
- Post Bodies: Images, Grids, Zoom and Embeds
- Blog Configuration (config/blog.ts)
- Database Tables
- Gotchas

## Supporting references

- [PAGES.md](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-cms/PAGES.md)

## Using it

This skill is **model-invoked**. Your agent can select it for matching tasks, and you can call it directly.

```text
/stacks-cms
```

Source: [`stacks-cms/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-cms/SKILL.md).

It ships in `@stacksjs/defaults` with its supporting files. Run
`buddy setup:ai` to refresh the agent setup. Override it per project with
`app/Skills/stacks-cms/SKILL.md`. See [Using skills](/skills/using).
