---
title: "Crosswind skill"
description: "Use when styling components in a Stacks application."
---
# Crosswind

`stacks-crosswind` · Frontend · model-invoked

The utility-first CSS engine that styles a Stacks app. Utility classes, theming,
responsive design, variants, custom rules and how the CSS is generated.

## When to reach for it

- Utility-first CSS classes
- Theming
- Responsive design
- Variants
- Custom rules
- CSS generation. Crosswind is the CSS utility engine powering Stacks' Crosswind config

## Inside the skill

The sections an agent reads once the skill loads.

- Design & anti-slop skills
- Key Paths
- Core API
- Configuration
- Usage in Templates
- Built-in Utility Categories
- Gotchas

## Where the code lives

- Package: `node_modules/@cwcss/crosswind/`
- UI config: `config/ui.ts` (Crosswind options referencing Crosswind)
- Default styles: `storage/framework/defaults/styles/`
- Output: `storage/framework/stx/cache/cw-<hash>.css`, one file per page (stx's `stateDir`, set in `config/ui.ts`)

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
/stacks-crosswind
```

Source: [`stacks-crosswind/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-crosswind/SKILL.md).
Shadow it for one project with `app/Skills/stacks-crosswind/SKILL.md`, then re-run
`buddy setup:ai`. See [Writing your own](/skills/writing).
