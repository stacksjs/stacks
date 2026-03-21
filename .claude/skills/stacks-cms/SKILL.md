---
name: stacks-cms
description: Use when building content management features in a Stacks application — pages, posts, content types, or CMS configuration. Covers the @stacksjs/cms package and config/cms.ts.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks CMS

The `@stacksjs/cms` package provides content management system utilities for Stacks applications.

## Key Paths
- Core package: `storage/framework/core/cms/src/`
- Configuration: `config/cms.ts`
- Blog configuration: `config/blog.ts`
- Content models: `storage/framework/models/Page.ts`, `storage/framework/models/Post.ts`
- Default CMS functions: `storage/framework/defaults/functions/cms/`
- Package: `@stacksjs/cms`

## Features
- Page and post management
- Content type definitions
- Blog functionality (configured via `config/blog.ts`)
- Content templating and rendering

## Models
- `Page` - Static page content
- `Post` - Blog/dynamic post content
- `Comment` - User comments on content
- `Author` - Content author profiles
- `Category` - Content categorization

## Gotchas
- CMS models are auto-generated in `storage/framework/models/`
- Blog config is separate from CMS config
- Content rendering uses the STX templating engine
- Use `buddy make:migration` when modifying content schemas
