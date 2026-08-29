---
title: "Retro skill"
description: "Use for a retrospective on Stacks work."
---
# Retro

`stacks-retro` · Engineering craft · model-invoked

A retrospective that proposes changes to the environment rather than to the
person. Navigation pointers, automated checks, review rules, `AGENTS.md` no-ops,
tool economy, information access. The git-derived session data is the evidence
behind each candidate, not the point of the exercise.

## When to reach for it

- Proposing concrete improvements to the agent's environment (navigation pointers, automated checks, AGENTS.md, skills, tool economy) from what actually went wrong
- Backed by git-derived session data

## Inside the skill

The sections an agent reads once the skill loads.

- Pass 1: environment improvements
- Pass 2: the data
- Output
- Improvements
- Data
- Next session
- Rules

## Related skills

- [Review](/skills/craft/review)
- [TDD](/skills/craft/tdd)
- [Writing for agents](/skills/craft/writing-for-agents)

## Using it

This one is **model-invoked**. Your agent reaches for it on its own when the task
matches, and you can also call it by name:

```
/stacks-retro
```

Source: [`stacks-retro/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-retro/SKILL.md).
Shadow it for one project with `app/Skills/stacks-retro/SKILL.md`, then re-run
`buddy setup:ai`. See [Writing your own](/skills/writing).
