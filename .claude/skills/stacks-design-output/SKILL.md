---
name: stacks-design-output
description: Use when generating stx components or design deliverables in a Stacks app and completeness matters - banning placeholder comments and truncation so you ship whole, runnable stx files instead of skeletons. Composes with stacks-design-taste and the aesthetic-preset skills as a full-output enforcement layer.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Full-Output Enforcement (Stacks)

**Related skills:** the completeness enforcement layer for [`stacks-design-taste`](../stacks-design-taste/SKILL.md) (the flagship anti-slop skill) and the aesthetic presets [`stacks-design-soft`](../stacks-design-soft/SKILL.md), [`stacks-design-minimalist`](../stacks-design-minimalist/SKILL.md), [`stacks-design-brutalist`](../stacks-design-brutalist/SKILL.md), and [`stacks-redesign`](../stacks-redesign/SKILL.md). Deliverables are stx built with [`stacks-crosswind`](../stacks-crosswind/SKILL.md) and [`stacks-composables`](../stacks-composables/SKILL.md); see [`stacks-stx`](../stacks-stx/SKILL.md) for templating rules.

## Baseline

Treat every task as production-critical. A partial output is a broken output. Do not optimize for brevity; optimize for completeness. If the user asks for a full `.stx` file, deliver the full file. If the user asks for 5 components, deliver 5 components. No exceptions.

## Banned Output Patterns

The following patterns are hard failures. Never produce them:

**In code blocks:** `// ...`, `// rest of code`, `// implement here`, `// TODO`, `/* ... */`, `// similar to above`, `// continue pattern`, `// add more as needed`, `{{-- ... --}}` or `<!-- rest of template -->` standing in for omitted markup, bare `...` standing in for omitted code, `@foreach` bodies replaced with a comment, or `<slot />` used to paper over content you were asked to write.

**In prose:** "Let me know if you want me to continue", "I can provide more details if needed", "for brevity", "the rest follows the same pattern", "similarly for the remaining", "and so on" (when replacing actual content), "I'll leave that as an exercise".

**Structural shortcuts:** Outputting a skeleton `.stx` when the request was for a full implementation. Showing the `<script>` and `<style>` blocks while skipping the `<template>` markup (or vice versa). Replacing repeated components with one example and a description. Describing what an stx component should do instead of writing it. Emitting one card and saying "repeat for the others".

## Execution Process

1. **Scope** - Read the full request. Count how many distinct deliverables are expected (`.stx` files, components, sections, views, layouts). Lock that number.
2. **Build** - Generate every deliverable completely: every `<script>` / `<template>` / `<style>` block, every directive body (`@if`, `@foreach`, `@section`), every branch and every list item. No partial drafts, no "you can extend this later".
3. **Cross-check** - Before output, re-read the original request. Compare your deliverable count against the scope count. If anything is missing, add it before responding.

## Handling Long Outputs

When a response approaches the token limit:
- Do not compress remaining sections to squeeze them in.
- Do not skip ahead to a conclusion.
- Write at full quality up to a clean breakpoint (end of a component, end of an `.stx` file, end of a section).
- End with:

```
[PAUSED - X of Y complete. Send "continue" to resume from: next section name]
```

On "continue", pick up exactly where you stopped. No recap, no repetition.

## Quick Check

Before finalizing any response, verify:
- No banned patterns from the list above appear anywhere in the output
- Every item the user requested is present and finished
- Every `.stx` block that was asked for is complete: `<script>`, `<template>`/markup, and `<style>` as applicable
- Code blocks contain actual runnable stx + Crosswind, not descriptions of what the component would do
- No stx hard-ban leaked in while rushing: no `var`, no `document.*`, no `window.*` in `<script>` blocks; icons are Iconify `i-*` classes, never hand-rolled SVG
- Nothing was shortened to save space
