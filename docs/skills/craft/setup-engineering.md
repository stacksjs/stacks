---
title: "Setup Engineering skill"
description: "Configure tracker conventions, triage roles, and domain documentation for Stacks workflows."
---
# Setup Engineering

`stacks-setup-engineering` · Engineering craft · user-invoked

Configure tracker conventions, triage roles, and domain documentation when the
project needs them. Existing local Markdown workflows can proceed without setup.

Adapted from [mattpocock/skills](https://github.com/mattpocock/skills/tree/49dd158d1076134a641b33efb035946536778336/skills/engineering/setup-matt-pocock-skills).
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
/stacks-setup-engineering
```

Source: [`stacks-setup-engineering/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-setup-engineering/SKILL.md).

The skill and all supporting files ship in `@stacksjs/defaults`. New apps and
framework upgrades receive them through the managed defaults sync. Run
`buddy setup:ai` to refresh the agent setup. Override this skill per project
with `app/Skills/stacks-setup-engineering/SKILL.md`.

See [Flow](/skills/craft/flow) and [Using skills](/skills/using).
