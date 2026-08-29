---
title: "stx skill"
description: "Use when working with STX templates in a Stacks application."
---
# stx

`stacks-stx` · Frontend · model-invoked

stx is the only templating system in Stacks. Single-file components with
`<script>`, `<template>` and `<style>`, Blade-style directives, signals and
filters, plus SSR, streaming and hydration. Read this before writing a template,
because the rules here are strict: no `var`, no `document.*`, no `window.*`.

## When to reach for it

- Template syntax
- Components
- Directives
- Signals
- Reactivity
- SSR
- Streaming
- Hydration
- Debugging STX rendering. STX is the ONLY templating system for Stacks

## Inside the skill

The sections an agent reads once the skill loads.

- Design & anti-slop skills
- Key Paths
- CRITICAL Rules
- Template Structure
- Configuration (config/ui.ts)
- STX Capabilities (118+ modules)
- Plugin Loading
- Scaffolding
- Gotchas

## Where the code lives

- STX config: `config/ui.ts`
- STX plugin: `bun-plugin-stx` (loaded via bunfig.toml)
- STX build cache + route manifest: `storage/framework/stx/` (stx's `stateDir`, set in `config/ui.ts`)
- Components: `resources/components/`
- Layouts: `resources/layouts/`
- Partials: `resources/partials/`
- Views: `resources/views/`
- Package: `@stacksjs/stx`

## Related skills

- [Brand kit](/skills/design/brandkit)
- [Design: brutalist](/skills/design/design-brutalist)
- [Design: minimalist](/skills/design/design-minimalist)
- [Design: full output](/skills/design/design-output)
- [Design: soft](/skills/design/design-soft)
- [Design taste](/skills/design/design-taste)
- [Image to code](/skills/design/image-to-code)
- [Image generation: mobile](/skills/design/imagegen-mobile)
- [Image generation: web](/skills/design/imagegen-web)
- [Redesign](/skills/design/redesign)

## Using it

This one is **model-invoked**. Your agent reaches for it on its own when the task
matches, and you can also call it by name:

```
/stacks-stx
```

Source: [`stacks-stx/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-stx/SKILL.md).
Shadow it for one project with `app/Skills/stacks-stx/SKILL.md`, then re-run
`buddy setup:ai`. See [Writing your own](/skills/writing).
