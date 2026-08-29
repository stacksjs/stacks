---
title: "Handoff skill"
description: "Compact the current conversation into a portable handoff document for another agent or session to pick up."
---
# Handoff

`stacks-handoff` · Engineering craft · user-invoked

Compacts the conversation into a portable document another session can pick up,
written to the OS temp directory rather than the repo. It keeps the decisions and
the reasoning, which is the part a diff cannot recover, and redacts anything that
came out of `.env` or `config/services.ts`.

## Inside the skill

The sections an agent reads once the skill loads.

- What goes in
- What stays out
- Redact before you write
- Finish
- Before you hand off at all

## Related skills

- [Flow](/skills/craft/flow)
- [ORM](/skills/data/orm)

## Using it

This one is **user-invoked**. It carries no model-facing description, so it costs
nothing in context and only fires when you type it:

```
/stacks-handoff <What will the next session be used for?>
```

Source: [`stacks-handoff/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-handoff/SKILL.md).
Shadow it for one project with `app/Skills/stacks-handoff/SKILL.md`, then re-run
`buddy setup:ai`. See [Writing your own](/skills/writing).
