---
name: stacks-docs
description: Use when building or configuring documentation for a Stacks project — BunPress setup, doc generation, navigation, sidebar structure, or documentation meta/SEO. Covers @stacksjs/docs and config/docs.ts.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Documentation

## Key Paths
- Core package: `storage/framework/core/docs/src/`
- Doc content: `docs/`
- Config: `config/docs.ts`
- Output: `storage/framework/docs/dist/`
- Package: `@stacksjs/docs`

## Source Files
```
docs/src/
├── index.ts              # frameworkDefaults + merged docsConfig
└── meta.ts               # CDN URLs, social links, PWA patterns
```

## API

```typescript
import { frameworkDefaults, docsConfig } from '@stacksjs/docs'

// Framework defaults
const frameworkDefaults: BunPressOptions = {
  docsDir: path.projectPath('docs'),
  outDir: path.frameworkPath('docs/dist'),
}

// Merged config (framework defaults + user config from config/docs.ts)
const docsConfig: BunPressOptions = { ...frameworkDefaults, ...userConfig }
```

## Meta Exports

```typescript
import { googleapis, gstatic, font, ogUrl, ogImage, github, releases, contributing, discord, twitter, pwaFontsRegex, pwaFontStylesRegex } from '@stacksjs/docs'
```

Social and CDN constants used in documentation templates and PWA configuration.

## Configuration (config/docs.ts)

```typescript
import type { BunPressOptions } from '@stacksjs/docs'

export default {
  // Navigation
  nav: [
    { text: 'Changelog', link: 'https://github.com/stacksjs/stacks/blob/main/CHANGELOG.md' },
    { text: 'Blog', link: 'https://updates.stacksjs.org' },
  ],

  // Markdown settings
  markdown: {
    title: 'Stacks.js',
    syntaxHighlighting: { theme: 'material-theme-palenight' },
    toc: { depth: 2 },
  },

  // Sidebar structure
  sidebar: {
    '/prologue/': [/* ... */],
    '/get-started/': [/* ... */],
    '/basics/': [/* ... */],
    '/digging-deeper/': [/* ... */],
    '/cloud/': [/* ... */],
    '/cli/': [/* ... */],
    '/packages/': [/* ... */],
    '/testing/': [/* ... */],
    '/project/': [/* ... */],
  },

  // Theme
  theme: {
    logo: '/images/logos/logo-transparent.svg',
    footer: { message: 'Released under the MIT License.', copyright: 'Copyright © 2025' },
    socialLinks: [
      { icon: 'twitter', link: 'https://twitter.com/stacksjs' },
      { icon: 'github', link: 'https://github.com/stacksjs/stacks' },
      { icon: 'discord', link: 'https://discord.gg/stacksjs' },
    ],
  },

  // SEO
  sitemap: { hostname: 'https://stacksjs.com/docs' },
  robotsTxt: { enabled: true },
} satisfies BunPressOptions
```

## CLI Commands

```bash
buddy dev:docs          # Start docs dev server
buddy build:docs        # Build documentation site
```

## Gotchas
- **BunPress, not VitePress** — the docs engine is BunPress (Stacks' own documentation tool)
- **Config merging** — `docsConfig` merges framework defaults with user config from `config/docs.ts`
- **Sidebar is section-based** — organized by URL prefix (prologue, get-started, basics, etc.)
- **SEO built-in** — sitemap and robots.txt generation enabled by default
- **Output goes to `storage/framework/docs/dist/`** — not the `docs/` source directory
