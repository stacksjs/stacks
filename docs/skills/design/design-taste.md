---
title: "Design taste skill"
description: "Use when designing or building a landing page, portfolio, hero, marketing section, or redesign in a Stacks app, or when the ask is anti-slop / premium frontend work. Reads the brief, infers the right direction, and ships stx + Crosswind interfaces that do not look templated, with a strict pre-flight check."
---
# Design taste

`stacks-design-taste` · Design · model-invoked

The flagship design skill and the one to start from. It reads the brief, infers a
direction, and ships stx and Crosswind interfaces that do not look templated,
governed by three dials (variance, motion, density), an explicit list of AI tells
to avoid, and a pre-flight check that has to be honestly tickable before the work
is done.

## Inside the skill

The sections an agent reads once the skill loads.

- 0. BRIEF INFERENCE (Read the Room Before Anything Else)
- 1. THE THREE DIALS (Core Configuration)
- 2. BRIEF -> FOUNDATION MAP
- 3. DEFAULT ARCHITECTURE & CONVENTIONS
- 4. DESIGN ENGINEERING DIRECTIVES (Bias Correction)
- 5. CONTEXT-AWARE PROACTIVITY (Motion in Stacks)
- 6. PERFORMANCE & ACCESSIBILITY GUARDRAILS
- 7. DIAL DEFINITIONS (Technical Reference)
- 8. DARK MODE PROTOCOL
- 9. AI TELLS (Forbidden Patterns)
- 10. REFERENCE VOCABULARY (Pattern Names the Agent Should Know)
- 11. REDESIGN PROTOCOL
- 12. OUTPUT DISCIPLINE
- 13. OUT OF SCOPE
- 14. FINAL PRE-FLIGHT CHECK
- Appendix A - Stacks foundation note
- Appendix B - Glassmorphism: honest web approximation (pure CSS)

## Related skills

- [Composables](/skills/frontend/composables)
- [Crosswind](/skills/frontend/crosswind)
- [Dashboard](/skills/domain/dashboard)
- [Design: brutalist](/skills/design/design-brutalist)
- [Design: minimalist](/skills/design/design-minimalist)
- [Design: full output](/skills/design/design-output)
- [Design: soft](/skills/design/design-soft)
- [Redesign](/skills/design/redesign)
- [stx](/skills/frontend/stx)
- [UI](/skills/frontend/ui)

## Using it

This one is **model-invoked**. Your agent reaches for it on its own when the task
matches, and you can also call it by name:

```
/stacks-design-taste
```

Source: [`stacks-design-taste/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-design-taste/SKILL.md).
Shadow it for one project with `app/Skills/stacks-design-taste/SKILL.md`, then re-run
`buddy setup:ai`. See [Writing your own](/skills/writing).
