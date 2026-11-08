---
name: stacks-docs
description: Use when auditing, writing, building or configuring Stacks documentation - source accuracy, generated references, snippets, links, BunPress navigation, metadata or SEO. Covers @stacksjs/docs and config/docs.ts.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Documentation

## Source and configuration

Read `config/docs.ts`, `storage/framework/core/docs/src/index.ts`, and the
implementation behind the topic before editing its docs. `@stacksjs/docs`
exports `frameworkDefaults`, `docsConfig`, and the constants in `src/meta.ts`.
The config type is `BunPressOptions` from `@stacksjs/bunpress`, not a type export
from `@stacksjs/docs`.

The package defaults to `docs/` and `storage/framework/docs/dist/`, then shallow
merges user configuration over those defaults. The repository's `config/docs.ts`
sets `outDir: './dist/docs'`. The Buddy build action invokes BunPress in the
project root; inspect the loaded BunPress config and the deploy consumer before
choosing an output path. BunPress renders HTML under the output directory's
`.bunpress/` subdirectory. This repository deploys `dist/docs/.bunpress`.
A nested config object replaces that defaults object;
do not assume a recursive merge.

BunPress reads this configuration shape:

```typescript
import type { BunPressOptions } from '@stacksjs/bunpress'

export default {
  docsDir: './docs',
  outDir: './dist/docs',
  nav: [{ text: 'Skills', link: '/skills' }],
  markdown: {
    title: 'Project documentation',
    meta: { description: 'Guides and API reference for this project.' },
    syntaxHighlightTheme: 'github-dark',
    toc: { enabled: true, minDepth: 2, maxDepth: 3 },
    sidebar: {
      '/': [{ text: 'Getting started', items: [{ text: 'Introduction', link: '/guide/intro' }] }],
    },
  },
} satisfies BunPressOptions
```

Keep links aligned with actual Markdown paths. Check the installed BunPress
options before adding theme, sitemap, robots or SEO settings; a configuration
example is not evidence that those features are enabled.

## Accuracy and editing

1. Read each affected public API, runtime command or configuration registry.
   Record any limits, provider differences and failure behavior in the guide.
2. Lead with the behavior a reader needs. Include a runnable example and the
   next step. Keep package-managed and vendored upgrade contracts explicit.
3. Use valid YAML frontmatter with a concrete title and description. Quote
   descriptions containing punctuation such as `: `. Preserve inline code's
   words in metadata; removing markup must not remove the command or package.
4. Regenerate source-derived references rather than editing their rendered
   inventories by hand. Keep authored explanation beside the generated block.
5. Read the final prose, check internal links and compile documented imports.
   The import check does not execute examples or verify every API claim.

Read `stacks-writing-for-agents` for bundled skill edits. Each bundled skill
also has a page under `docs/skills/`; keep its summary and invocation current.
Application skills belong under `app/Skills/` and override bundled names.

## Framework repository checks

The framework provides these freshness checks. They are contributor tooling;
an application need not carry the framework's documentation inventory.

```bash
buddy docs:buddy:check
buddy docs:artifacts:check
buddy docs:capabilities:check
buddy docs:desktop-matrix:check
buddy docs:links:check
buddy docs:snippets:check
buddy docs:agent-counts:check
buddy docs:native-skills:check
```

The corresponding command without `:check` regenerates an inventory where
supported. `docs:links` reports links. `docs:snippets` writes an exception
baseline, so fix broken examples instead of using it to accept regressions.

In a fresh contributor checkout, install the frozen dependency graph and build
the packages listed by `.github/scripts/subpath-packages.ts`, as CI does, before
running checks that import built subpaths. Run the documentation/skill contract
tests when editing those surfaces, and lint through `buddy lint` (pickier).

## Build and verify

```bash
buddy dev:docs
buddy build:docs
```

Build the actual site after content or navigation changes. Confirm generated
pages have their title, description, code blocks, navigation and valid links,
including a changed guide and a skill page. A successful build alone does not
prove the prose or API examples are correct. For deployment work, read
`stacks-deploy` and verify the CI run for the pushed commit plus the live docs.
