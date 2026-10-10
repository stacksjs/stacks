---
title: "Wayfinder skill"
description: "Plan a huge chunk of work (more than one agent session can hold) as a shared map of decision tickets on your issue tracker, and resolve them one at a time until the way to the destination is clear."
---
# Wayfinder

`stacks-wayfinder` · Engineering craft · user-invoked

Plan a huge chunk of work (more than one agent session can hold) as a shared map of decision tickets on your issue tracker, and resolve them one at a time until the way to the destination is clear.

Adapted from [mattpocock/skills](https://github.com/mattpocock/skills/tree/49dd158d1076134a641b33efb035946536778336/skills/engineering/wayfinder).
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
/stacks-wayfinder
```

Source: [`stacks-wayfinder/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-wayfinder/SKILL.md).

The skill and all supporting files ship in `@stacksjs/defaults`. New apps and
framework upgrades receive them through the managed defaults sync. Run
`buddy setup:ai` to refresh the agent setup. Override this skill per project
with `app/Skills/stacks-wayfinder/SKILL.md`.

See [Flow](/skills/craft/flow) and [Using skills](/skills/using).
