---
title: "To Questionnaire skill"
description: "Turn a decision you can't fully answer into a questionnaire for someone else to fill in."
---
# To Questionnaire

`stacks-to-questionnaire` · Productivity and writing · user-invoked

Turn a decision you can't fully answer into a questionnaire for someone else to fill in.

Adapted from [mattpocock/skills](https://github.com/mattpocock/skills/tree/49dd158d1076134a641b33efb035946536778336/skills/productivity/to-questionnaire).
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
/stacks-to-questionnaire
```

Source: [`stacks-to-questionnaire/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-to-questionnaire/SKILL.md).

The skill and all supporting files ship in `@stacksjs/defaults`. New apps and
framework upgrades receive them through the managed defaults sync. Run
`buddy setup:ai` to refresh the agent setup. Override this skill per project
with `app/Skills/stacks-to-questionnaire/SKILL.md`.

See [Flow](/skills/craft/flow) and [Using skills](/skills/using).
