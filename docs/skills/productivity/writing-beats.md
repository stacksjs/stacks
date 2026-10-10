---
title: "Writing Beats skill"
description: "Writing, exploit; assemble raw material into a journey of beats, grounding each term before a beat leans on it."
---
# Writing Beats

`stacks-writing-beats` · Productivity and writing · user-invoked

Writing, exploit; assemble raw material into a journey of beats, grounding each term before a beat leans on it.

Adapted from [mattpocock/skills](https://github.com/mattpocock/skills/tree/49dd158d1076134a641b33efb035946536778336/skills/in-progress/writing-beats).
Source revisions and adaptation details are recorded in the bundled notice.

## Workflow

Read the skill entrypoint and the branch-specific playbook or references it
points to. It keeps Stacks APIs, TypeScript/Bun tooling, and existing user
authorization in scope. Preserve established project conventions and distinguish
a draft or recommendation from a change already applied.

Engineering work uses the existing glossary, specs, ADRs, and tracker convention.
Local Markdown is a usable fallback. Commit, push, and tracker mutations require
authorization for that action. User decisions are never supplied by an agent.

## Using it

This skill is **user-invoked**. Call it explicitly when you want this workflow.

```text
/stacks-writing-beats
```

Source: [`stacks-writing-beats/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-writing-beats/SKILL.md).

The skill and all supporting files ship in `@stacksjs/defaults`. New apps and
framework upgrades receive them through the managed defaults sync. Run
`buddy setup:ai` to refresh the agent setup. Override this skill per project
with `app/Skills/stacks-writing-beats/SKILL.md`.

See [Flow](/skills/craft/flow) and [Using skills](/skills/using).
