---
title: "Flow skill"
description: "Ask which Stacks skill or flow fits the situation. A router over the bundled skills."
---
# Flow

`stacks-flow` · Engineering craft · user-invoked

The router over every other skill. You will not remember a hundred and fifteen of
anything, so this one names the flows instead: the main route from idea to
shipped, the on-ramps that feed into it, and the vocabulary skills that run
underneath. It also carries the phase-boundary tree, which is the answer to
"should I keep going, clear, hand off, send a subagent, or compact?"

## Inside the skill

The sections an agent reads once the skill loads.

- The main flow: idea to shipped
- On-ramps
- Codebase health
- Vocabulary underneath
- Standalone
- Precondition

## Supporting files

Reference and scripts the skill reaches for on demand, rather than loading up front.

- [`PHASE-BOUNDARIES.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-flow/PHASE-BOUNDARIES.md)

## Related skills

- [Browse](/skills/craft/browse)
- [Buddy](/skills/toolchain/buddy)
- [CMS](/skills/domain/cms)
- [Codebase design](/skills/craft/codebase-design)
- [Design taste](/skills/design/design-taste)
- [Domain modeling](/skills/craft/domain-modeling)
- [Grilling](/skills/craft/grilling)
- [Guard](/skills/craft/guard)
- [Handoff](/skills/craft/handoff)
- [Investigate](/skills/craft/investigate)
- [New feature](/skills/craft/new-feature)
- [Office hours](/skills/craft/office-hours)
- [ORM](/skills/data/orm)
- [Plan review](/skills/craft/plan-review)
- [Prototype](/skills/craft/prototype)
- [Queue](/skills/backend/queue)
- [Redesign](/skills/design/redesign)
- [Registry](/skills/toolchain/registry)
- [REPL](/skills/toolchain/repl)
- [Retro](/skills/craft/retro)
- [Review](/skills/craft/review)
- [Router](/skills/backend/router)
- [Security audit](/skills/craft/security-audit)
- [Shell](/skills/toolchain/shell)
- [TDD](/skills/craft/tdd)
- [Wizard](/skills/craft/wizard)
- [Writing for agents](/skills/craft/writing-for-agents)

## Using it

This one is **user-invoked**. It carries no model-facing description, so it costs
nothing in context and only fires when you type it:

```
/stacks-flow
```

Source: [`stacks-flow/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-flow/SKILL.md).
Shadow it for one project with `app/Skills/stacks-flow/SKILL.md`, then re-run
`buddy setup:ai`. See [Writing your own](/skills/writing).
