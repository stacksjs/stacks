---
title: "UI skill"
description: "Use when working with UI in a Stacks application."
---
# UI

`stacks-ui` · Frontend · model-invoked

The UI layer as a whole: components, composables, reactivity, Craft native
components, Crosswind styling and accessibility, spanning `@stacksjs/ui` and
`@stacksjs/stx`.

## When to reach for it

- Components
- Composables
- Reactivity (refs/watch/computed)
- Craft native components
- Crosswind CSS
- Crosswind utility framework
- Accessibility
- The STX templating engine

## Covers

`@stacksjs/ui`, `@stacksjs/stx`, related UI tooling.

## Inside the skill

The sections an agent reads once the skill loads.

- Design & anti-slop skills
- Key Paths
- Source Files
- Headless Components
- Craft Native Components
- Reactivity System
- Lifecycle Hooks
- Dependency Injection
- Browser Composables
- Crosswind Configuration (config/ui.ts)
- STX Configuration (config/ui.ts)
- Accessibility
- Crosswind CSS Framework
- Gotchas

## Where the code lives

- Core package: `storage/framework/core/ui/src/`
- Components: `storage/framework/core/ui/src/components/`
- UI config: `config/ui.ts` (Crosswind)
- STX config: `config/ui.ts`
- STX engine: `node_modules/@stacksjs/stx/`
- Crosswind: `node_modules/@cwcss/crosswind/`
- Editor metadata: `storage/framework/core/web-types.json`, `storage/framework/core/custom-elements.json`

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
/stacks-ui
```

Source: [`stacks-ui/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-ui/SKILL.md).
Shadow it for one project with `app/Skills/stacks-ui/SKILL.md`, then re-run
`buddy setup:ai`. See [Writing your own](/skills/writing).
