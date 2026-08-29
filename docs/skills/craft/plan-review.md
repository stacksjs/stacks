---
title: "Plan review skill"
description: "Use for architecture review of Stacks changes."
---
# Plan review

`stacks-plan-review` · Engineering craft · model-invoked

Architecture review at two levels: are we building the right thing, and are we
building it right. Scope expansion and reduction, data flow through the request
and build pipelines, dependency and interface analysis, a test matrix, and a
phased implementation plan where each phase is independently mergeable.

## When to reach for it

- Scope review
- Data flow analysis
- Dependency and interface analysis
- Test matrices
- An implementation plan sliced into tracer bullets

## Inside the skill

The sections an agent reads once the skill loads.

- Upstream Context
- Vocabulary
- Step 1: Scope Review
- Step 2: Data Flow Analysis
- Step 3: Architecture Review
- Step 4: Test Matrix
- Step 5: Implementation Plan
- Output
- Scope Assessment
- Data Flow
- Architecture Review
- Test Matrix
- Implementation Plan
- Summary
- Rules

## Related skills

- [Browse](/skills/craft/browse)
- [Codebase design](/skills/craft/codebase-design)
- [Grilling](/skills/craft/grilling)
- [New feature](/skills/craft/new-feature)
- [Office hours](/skills/craft/office-hours)
- [Review](/skills/craft/review)
- [Security audit](/skills/craft/security-audit)
- [TDD](/skills/craft/tdd)

## Using it

This one is **model-invoked**. Your agent reaches for it on its own when the task
matches, and you can also call it by name:

```
/stacks-plan-review
```

Source: [`stacks-plan-review/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-plan-review/SKILL.md).
Shadow it for one project with `app/Skills/stacks-plan-review/SKILL.md`, then re-run
`buddy setup:ai`. See [Writing your own](/skills/writing).
