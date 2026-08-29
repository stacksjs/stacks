---
title: "CMS skill"
description: "Use when working with the CMS in a Stacks application."
---
# CMS

`stacks-cms` · Domain packages · model-invoked

The content layer: posts, authors, pages, categories, tags and comments, plus the
RSS and sitemap generation that hangs off them.

## When to reach for it

- Posts
- Authors
- Pages
- Categories
- Tags
- Comments
- Blog configuration
- RSS feeds
- Sitemaps

## Covers

`@stacksjs/cms`, CMS models, routes, actions.

## Inside the skill

The sections an agent reads once the skill loads.

- Key Paths
- Source Files
- CMS Namespace
- Models
- Posts API
- Authors API
- Tags API
- Comments API
- Routes
- Blog Configuration (config/blog.ts)
- Database Tables
- Gotchas

## Where the code lives

- Core package: `storage/framework/core/cms/src/`
- Models: `storage/framework/defaults/app/Models/Content/` (Post, Author, Page)
- Models: `storage/framework/defaults/app/Models/` (Comment, Tag)
- Actions: `storage/framework/defaults/app/Actions/Cms/`
- Routes: `routes/api.ts` (CMS and blog endpoints)
- Config: `config/blog.ts`

## Using it

This one is **model-invoked**. Your agent reaches for it on its own when the task
matches, and you can also call it by name:

```
/stacks-cms
```

Source: [`stacks-cms/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-cms/SKILL.md).
Shadow it for one project with `app/Skills/stacks-cms/SKILL.md`, then re-run
`buddy setup:ai`. See [Writing your own](/skills/writing).
