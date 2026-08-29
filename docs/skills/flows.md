---
title: Skill flows
description: "The routes the engineering craft skills form: idea to shipped, the on-ramps that feed into it, and where to cut a session."
---
# Flows

A **flow** is a path through the skills. Most work travels one main route, two
on-ramps merge onto it, and a few skills run underneath the rest as shared
vocabulary. This page is the human version of [Flow](/skills/craft/flow), the
router skill you can invoke to be asked the same questions in a session.

## The main flow: idea to shipped

```
office-hours → prototype? → plan-review → new-feature ⇄ tdd → review → browse → retro
```

1. **[Office hours](/skills/craft/office-hours)** turns an idea into a design
   document. It runs the [Grilling](/skills/craft/grilling) interview underneath,
   so vague answers get pushed on. Start here when the question is still "should
   we build this, and what exactly".
2. **Can every question be settled in conversation?** If one needs a runnable
   answer, a state model that only feels wrong once you push data through it, or
   a UI direction you have to see, detour through
   **[Prototype](/skills/craft/prototype)** and come back with the verdict.
3. **[Plan review](/skills/craft/plan-review)** turns the design into scope, data
   flow, architecture, a test matrix and a phased plan. This is where
   [Codebase design](/skills/craft/codebase-design) earns its keep, because the
   plan is where seams get chosen and a seam in the wrong place is expensive
   later.
4. **[New feature](/skills/craft/new-feature)** slices the plan into tracer
   bullets and builds them in the model to migration to action to route to test
   order, one vertical slice at a time, driving **[TDD](/skills/craft/tdd)**
   inside each.
5. **[Review](/skills/craft/review)** reviews the diff on two axes, standards and
   spec, before anything merges.
6. **[Browse](/skills/craft/browse)** QAs the result in a real browser when the
   slice has a UI.
7. **[Retro](/skills/craft/retro)** looks back and improves the environment the
   next session runs in.

Keep steps 1 to 4 in one unbroken context where you can, so the grilling, the
plan and the slicing all build on the same thinking. Each slice in step 4 can
then start fresh from its own ticket.

## On-ramps

A starting situation that generates work, then merges onto the main flow.

**Something is broken** goes to **[Investigate](/skills/craft/investigate)**. It
refuses to theorise until it has a tight feedback loop, one command that already
goes red on *this* bug, then fixes with a regression test. When the real finding
is that there is no good seam to lock the bug down, that is a
[Codebase design](/skills/craft/codebase-design) problem, not a testing one.

**A visual surface needs building or lifting** goes to
**[Design taste](/skills/design/design-taste)**, or
**[Redesign](/skills/design/redesign)** when the UI already exists and needs
auditing first. Those two carry their own flow, including the aesthetic presets
and the image-first pipeline.

**Something needs a human's hands** goes to **[Wizard](/skills/craft/wizard)**,
which turns the manual procedure into a script the human runs once instead of a
conversation you repeat every time.

## Vocabulary underneath

Two model-invoked references run beneath the others, each the single source of
truth for its words. Reach for them when the **words**, not the process, are the
problem.

- **[Domain modeling](/skills/craft/domain-modeling)** sharpens the project's
  *domain* language. In a Stacks app that language becomes model names, table
  names, route URIs and event names, so it is load-bearing rather than
  decorative.
- **[Codebase design](/skills/craft/codebase-design)** is the deep-module
  vocabulary for a module's *shape*: module, interface, depth, seam, adapter,
  leverage, locality.

## Where to cut a session

Every flow eventually runs into the question of what to do at a **phase
boundary**, the gap between two chunks of work. There are five options, and the
first yes wins:

| Option | Take it when |
|---|---|
| **Continue** | The next phase needs this one verbatim, or the window has room. Costs nothing, loses nothing, so rule it out first. |
| **Clear** | Everything here is disposable. The cheapest move on the board, and the most expensive to get wrong. |
| **Handoff** | Something is actually travelling: a different agent, a different repo, a colleague. [Handoff](/skills/craft/handoff) writes the file. |
| **Subagent** | The task is scoped tightly enough to run with you away from the keyboard. Automated review is the standard case. |
| **Compact** | Relevant context, same harness, and you need to stay in the loop. The default, at the bottom rather than the first reach. |

Make the decision **at** a boundary. Mid-phase there is nothing to decide:
continue, or split what is left into subagents. The full tree, and why every move
except Continue turns a primary source into a lossy secondary one, is in
[`PHASE-BOUNDARIES.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-flow/PHASE-BOUNDARIES.md).

## Codebase health

Not feature work, upkeep. [Codebase design](/skills/craft/codebase-design) is the
bench you redesign a module on. [Security audit](/skills/craft/security-audit)
covers OWASP, STRIDE and attack surface.
[Guard](/skills/craft/guard) installs the hook that stops a destructive command
before it runs. [Writing for agents](/skills/craft/writing-for-agents) keeps the
documents themselves from silting up.
