---
title: "Design: minimalist skill"
description: "Use when a Stacks UI should feel editorial and minimalist (Notion/Linear vibe)."
---
# Design: minimalist

`stacks-design-minimalist` · Design · model-invoked

An aesthetic preset for editorial and minimalist surfaces, the Notion and Linear
register: restrained warm monochrome, typographic contrast, flat bento grids,
muted accents, no gradients and no heavy shadows.

## When to reach for it

- Designing a docs site
- Dashboard
- Landing page
- Content surface that needs restrained warm monochrome
- Typographic contrast
- Flat bento grids
- Muted pastel accents
- No gradients
- Heavy shadows

## Inside the skill

The sections an agent reads once the skill loads.

- 1. Protocol Overview
- 2. Absolute Negative Constraints (Banned Elements)
- 3. Typographic Architecture
- 4. Color Palette (Warm Monochrome + Spot Pastels)
- 5. Component Specifications
- 6. Iconography & Imagery Directives
- 7. Subtle Motion & Micro-Animations
- 8. Execution Protocol

## Related skills

- [Composables](/skills/frontend/composables)
- [Crosswind](/skills/frontend/crosswind)
- [Design taste](/skills/design/design-taste)
- [stx](/skills/frontend/stx)
- [UI](/skills/frontend/ui)

## Using it

This one is **model-invoked**. Your agent reaches for it on its own when the task
matches, and you can also call it by name:

```
/stacks-design-minimalist
```

Source: [`stacks-design-minimalist/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-design-minimalist/SKILL.md).
Shadow it for one project with `app/Skills/stacks-design-minimalist/SKILL.md`, then re-run
`buddy setup:ai`. See [Writing your own](/skills/writing).
