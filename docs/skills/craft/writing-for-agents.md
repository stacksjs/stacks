---
title: "Writing for agents skill"
description: "Use when writing or editing any document an agent reads."
---
# Writing for agents

`stacks-writing-for-agents` · Engineering craft · model-invoked

The skill for writing skills, and for every other document an agent reads. It
covers context pointers (why a weakly worded description is a variance bug), the
information hierarchy, completion criteria, leading words, and the pruning
discipline that keeps a document from silting up. Read it before you add
anything to `app/Skills/`.

## When to reach for it

- A SKILL.md under app/Skills
- storage/framework/defaults/ai/skills
- The project AGENTS.md
- A reference file a skill points at

## Covers

context pointers, information hierarchy, completion criteria, leading words, pruning, the skill mechanics behind app/Skills, buddy setup:ai.

## Inside the skill

The sections an agent reads once the skill loads.

- Context pointers
- The two loads
- Information hierarchy
- Steps and completion criteria
- When to split
- Leading words
- Pruning
- Before you finish

## Supporting files

Reference and scripts the skill reaches for on demand, rather than loading up front.

- [`MECHANICS.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-writing-for-agents/MECHANICS.md)

## Related skills

- [Flow](/skills/craft/flow)
- [Investigate](/skills/craft/investigate)
- [New feature](/skills/craft/new-feature)
- [ORM](/skills/data/orm)
- [Queue](/skills/backend/queue)
- [Retro](/skills/craft/retro)
- [Technical diagrams](/skills/design/technical-diagrams)

## Using it

This one is **model-invoked**. Your agent reaches for it on its own when the task
matches, and you can also call it by name:

```
/stacks-writing-for-agents
```

Source: [`stacks-writing-for-agents/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-writing-for-agents/SKILL.md).
Shadow it for one project with `app/Skills/stacks-writing-for-agents/SKILL.md`, then re-run
`buddy setup:ai`. See [Writing your own](/skills/writing).
