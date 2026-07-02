# AGENTS.md

Guidance for AI coding agents (OpenAI Codex CLI, Cursor, and others) working in this Stacks
repository. Claude Code reads `CLAUDE.md` and the skills under `.claude/skills/`; this file mirrors
the essentials for agents that do not load those automatically.

Read `CLAUDE.md` first for project conventions (linting with pickier, stx templating, Crosswind,
dependencies, commit style). The rules below are the non-negotiable ones for UI work.

## Stack essentials

- **Templating:** stx (`.stx` Single File Components: `<script server|client>`, `<template>`,
  `<style>`; Blade-style directives `@if` / `@foreach` / `@layout`; interpolation `{{ x }}`; filters
  `{{ x | currency }}`). Never write vanilla JS in templates.
- **Never** use `var`, `document.*`, or `window.*` inside stx `<script>` blocks. Use signals
  (`state` / `derived` / `effect`) and composables instead.
- **CSS:** Crosswind (Tailwind-compatible utilities, `dark:` variant, arbitrary values). Dark mode via
  `dark:` + `useColorMode()` / `useDark()`.
- **Icons:** Iconify utility classes `i-{collection}-{name}` (hugeicons by default). Never hand-roll
  SVG icon paths; never add `lucide-react` / `@phosphor-icons` style npm icon packages.
- **Fonts:** the `fonts` config plus `<link>` / `@font-face` with `font-display: swap` in the layout.
  There is no `next/font`.
- **Images:** standard `<img>` plus the stx asset pipeline / `@stacksjs/storage`. There is no
  `next/image`.
- **Motion:** Stacks ships no animation library. Do NOT import `motion/react`, `framer-motion`, or
  `gsap`. Build motion with Crosswind transitions, CSS keyframes, CSS scroll-driven animations
  (`animation-timeline: view()` / `scroll()`), and composables (`useIntersectionObserver`,
  `useScroll`, `useParallax`, `useMouse`). Gate anything beyond hover with
  `usePreferredReducedMotion()` or `useMediaQuery('(prefers-reduced-motion: reduce)')`. Never attach
  `window.addEventListener('scroll', ...)` in a template.

## Design & anti-slop skills (read the SKILL.md before building UI)

For any visually important page (landing, hero, marketing, portfolio, product, redesign), read the
matching skill file under `.claude/skills/` and follow it as written. These translate premium design
discipline into stx + Crosswind + composables and are framework-correct for this repo.

| When the task is | Read |
|---|---|
| Any premium / anti-slop frontend (start here) | `.claude/skills/stacks-design-taste/SKILL.md` |
| Stricter, award-level, high-variance + deterministic motion | `.claude/skills/stacks-design-taste-codex/SKILL.md` |
| Aesthetic is already chosen: expensive/soft | `.claude/skills/stacks-design-soft/SKILL.md` |
| Aesthetic: editorial / minimalist (Notion/Linear) | `.claude/skills/stacks-design-minimalist/SKILL.md` |
| Aesthetic: industrial / brutalist | `.claude/skills/stacks-design-brutalist/SKILL.md` |
| Upgrading an existing UI (audit first) | `.claude/skills/stacks-redesign/SKILL.md` |
| Agent keeps truncating / placeholder output | `.claude/skills/stacks-design-output/SKILL.md` |
| Image-first: generate references, then implement | `.claude/skills/stacks-image-to-code/SKILL.md` |
| Need reference images only (web / mobile / brand) | `stacks-imagegen-web`, `stacks-imagegen-mobile`, `stacks-brandkit` |

The flagship (`stacks-design-taste`) carries the shared rules: brief inference, the three dials
(VARIANCE / MOTION / DENSITY), typography / color / layout discipline, the AI-Tells list, the redesign
protocol, and a binding pre-flight check. The other design skills refine it and defer to it. When two
apply, load the flagship plus the most specific one.

## Hard rule: no em-dashes

Never emit an em-dash (`—`) or a separator en-dash (`–`) in any user-visible string you generate:
headlines, body copy, labels, buttons, alt text, captions. Use a regular hyphen `-`, a comma, or two
sentences. This is the single most common AI design tell and it is a pre-flight failure.

## Before finishing UI work

Run the pre-flight check in `stacks-design-taste` (Section 14). If any box cannot be honestly ticked,
the work is not done. Lint with `bunx --bun pickier .` and fix with `--fix`.
