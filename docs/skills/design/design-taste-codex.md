---
title: "Design taste (Codex) skill"
description: "Use when you need the stricter, Codex-oriented variant of stacks-design-taste for premium / anti-slop Stacks frontend work."
---
# Design taste (Codex)

`stacks-design-taste-codex` · Design · model-invoked

The stricter variant of [Design taste](/skills/design/design-taste), tuned for
award-level work and for the OpenAI Codex CLI as well as Claude Code. Higher
layout variance, deterministic scroll-driven motion, strict AIDA structure, wide
editorial typography and gapless bento grids.

## When to reach for it

- Award-level landing pages
- Portfolios
- Heroes
- Marketing sections that demand high layout variance
- Deterministic scroll-driven motion
- Strict AIDA structure
- Wide editorial typography
- Gapless bento grids. Ships stx + Crosswind + composables
- Tuned for the OpenAI Codex CLI as well as Claude Code

## Inside the skill

The sections an agent reads once the skill loads.

- 0. CORE DIRECTIVE: BREAK THE STATISTICAL DEFAULTS
- 1. DIALS (Codex clamp)
- 2. DETERMINISTIC LAYOUT VARIANCE (BREAKING THE LOOP)
- 3. AIDA STRUCTURE AND SPACING (strict)
- 4. THE GAPLESS BENTO GRID (strict)
- 5. SCROLL-DRIVEN MOTION AND HOVER PHYSICS (deterministic, no library)
- 6. COMPONENT ARSENAL AND CREATIVITY
- 7. CONTENT, ASSETS AND STRICT BANS
- 8. MANDATORY PRE-FLIGHT `<design_plan>` (binding gate)
- 9. FINAL PRE-FLIGHT CHECK

## Related skills

- [Composables](/skills/frontend/composables)
- [Crosswind](/skills/frontend/crosswind)
- [Design: brutalist](/skills/design/design-brutalist)
- [Design: minimalist](/skills/design/design-minimalist)
- [Design: soft](/skills/design/design-soft)
- [Design taste](/skills/design/design-taste)
- [Image to code](/skills/design/image-to-code)
- [stx](/skills/frontend/stx)
- [UI](/skills/frontend/ui)

## Using it

This one is **model-invoked**. Your agent reaches for it on its own when the task
matches, and you can also call it by name:

```
/stacks-design-taste-codex
```

Source: [`stacks-design-taste-codex/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-design-taste-codex/SKILL.md).
Shadow it for one project with `app/Skills/stacks-design-taste-codex/SKILL.md`, then re-run
`buddy setup:ai`. See [Writing your own](/skills/writing).
