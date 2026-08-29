---
name: stacks-flow
description: Ask which Stacks skill or flow fits the situation. A router over the bundled skills.
disable-model-invocation: true
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks flow

Stacks ships more than a hundred skills. You do not remember them all, so ask.

Two kinds live in that set, and they are reached differently:

- **Subsystem reference**: `stacks-orm`, `stacks-router`, `stacks-queue`,
  `stacks-cms`, one per part of the framework. These are model-invoked, so the
  agent finds them on its own from the task. You rarely need to name one, and the
  full index is the feature-to-skill table in `AGENTS.md`.
- **Craft skills**: the ones below. These shape *how* the work happens, and this
  is the map of them.

Credit: the flow model here is adapted from Matt Pocock's `ask-matt` skill
(MIT), <https://github.com/mattpocock/skills>.

## The main flow: idea to shipped

The route most work travels.

1. **`/stacks-office-hours`** turns an idea into a design document. It runs the
   `stacks-grilling` interview underneath, so vague answers get pushed on. Start
   here when the question is still "should we build this, and what exactly".
2. **Branch: can every question be settled in conversation?** If one needs a
   runnable answer (a state model, a UI direction), detour through
   **`/stacks-prototype`**, then come back with the verdict.
3. **`/stacks-plan-review`** turns the design into scope, data flow,
   architecture, a test matrix and an implementation plan. This is where
   `stacks-codebase-design` gets used, because the plan is where seams are chosen.
4. **`/stacks-new-feature`** slices the plan into **tracer bullets** and builds
   them in the model to migration to action to route to test order, one vertical
   slice at a time. It drives **`/stacks-tdd`** inside each slice.
5. **`/stacks-review`** reviews the diff on two axes, standards and spec, before
   anything merges.
6. **`/stacks-browse`** QAs the result in a real browser when the slice has a UI.
7. **`/stacks-retro`** looks back at the session and improves the environment the
   next one runs in.

### Context hygiene

Keep steps 1 to 4 in one unbroken context window where you can, so the grilling,
the plan and the slicing all build on the same thinking. Each slice in step 4 can
then start fresh from its own ticket. When a session is running long, make the
cut at a phase boundary rather than mid-phase: [PHASE-BOUNDARIES.md](PHASE-BOUNDARIES.md)
has the ordered tree.

## On-ramps

A starting situation that generates work, then merges onto the main flow.

- **Something is broken** goes to **`/stacks-investigate`**. It refuses to
  theorise until it has a **tight** feedback loop, one command that already goes
  red on *this* bug, then fixes with a regression test. When the real finding is
  that there is no good seam to lock the bug down, it hands off to
  `stacks-codebase-design`.
- **A visual surface needs to be built or lifted** goes to
  **`/stacks-design-taste`**, or `/stacks-redesign` when the UI already exists
  and needs auditing first. Those two carry their own flow, including the
  aesthetic presets and the image-first pipeline.
- **Something needs a human's hands** goes to **`/stacks-wizard`**, which turns
  the manual procedure into a script the human runs once.

## Codebase health

Not feature work, upkeep.

- **`/stacks-codebase-design`** is the bench you design a module's shape on:
  module, interface, depth, seam, adapter, leverage, locality. Reach for it when
  the argument is about where a seam goes or how much a trait should hide.
- **`/stacks-security-audit`** for OWASP, STRIDE and attack-surface work.
- **`/stacks-registry`** and the other subsystem skills for the auditing patterns
  specific to one part of the framework.

## Vocabulary underneath

Two model-invoked references that run *beneath* the other skills, each the single
source of truth for its vocabulary. Reach for them directly when the **words**,
not the process, are the problem.

- **`/stacks-domain-modeling`** sharpens the project's *domain* language:
  challenge a fuzzy term, resolve an overloaded one, record a hard-to-reverse
  decision as an ADR. In a Stacks app that language becomes model names, table
  names, route URIs and event names, so it is load-bearing.
- **`/stacks-codebase-design`** is the deep-module vocabulary for a module's
  *shape*. `stacks-tdd` and `stacks-plan-review` both speak it.

## Standalone

- **`/stacks-grilling`** is the interview primitive: rounds, the frontier, facts
  are the agent's job and decisions are yours. Reach for it directly when you
  want the interview with no wrapper.
- **`/stacks-guard`** is the safety layer: destructive-command detection, freeze
  mode, and the Claude Code hook that blocks the worst of it before it runs.
- **`/stacks-handoff`** compacts the conversation into a portable document.
  Narrow: only when something is actually travelling to a new harness, a new
  directory, or a colleague.
- **`/stacks-prototype`** answers one design question with throwaway code and
  keeps the artifact on a `prototype/<name>` branch.
- **`/stacks-writing-for-agents`** is the reference for writing any document an
  agent reads, including the skills themselves. Read it before adding anything to
  `app/Skills/`.
- `/stacks-repl`, `/stacks-shell` and `/stacks-buddy` drive the toolchain
  itself.

## Precondition

Nothing to run first. `buddy setup:ai <agent>` links these into your agent's
directory, and `app/Skills/<name>/SKILL.md` shadows any of them per project.
