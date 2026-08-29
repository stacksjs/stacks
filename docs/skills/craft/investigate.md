---
title: "Investigate skill"
description: "Use when debugging a Stacks issue."
---
# Investigate

`stacks-investigate` · Engineering craft · model-invoked

Root-cause debugging, structured so the hard part comes first. No hypothesis is
allowed until you have a **tight** feedback loop, one command you have already
run that goes red on this specific bug. Then minimise the repro, rank three to
five falsifiable hypotheses, instrument one variable at a time, and lock the fix
down with a regression test.

## When to reach for it

- Something broken
- Throwing
- Failing
- Flaky
- slow. Builds a tight feedback loop that goes red on the bug before any hypothesis is allowed
- Then minimises
- Tests hypotheses
- Fixes and locks it down with a regression test. Enforces no fixes without root cause

## Inside the skill

The sections an agent reads once the skill loads.

- Redact
- Phase 1: build a feedback loop
- Phase 2: reproduce and minimise
- Phase 3: hypothesise
- Phase 4: instrument
- Phase 5: fix and regression test
- Phase 6: cleanup
- Rules

## Supporting files

Reference and scripts the skill reaches for on demand, rather than loading up front.

- [`scripts/hitl-loop.template.sh`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-investigate/scripts/hitl-loop.template.sh)

## Related skills

- [Browse](/skills/craft/browse)
- [Codebase design](/skills/craft/codebase-design)
- [Retro](/skills/craft/retro)
- [Review](/skills/craft/review)
- [TDD](/skills/craft/tdd)

## Using it

This one is **model-invoked**. Your agent reaches for it on its own when the task
matches, and you can also call it by name:

```
/stacks-investigate
```

Source: [`stacks-investigate/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-investigate/SKILL.md).
Shadow it for one project with `app/Skills/stacks-investigate/SKILL.md`, then re-run
`buddy setup:ai`. See [Writing your own](/skills/writing).
