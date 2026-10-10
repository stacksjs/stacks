---
title: "To Spec skill"
description: "Turn the current conversation into a spec and publish it to the project issue tracker - no interview, just synthesis of what you've already discussed."
---
# To Spec

`stacks-to-spec` · Engineering craft · user-invoked

Turn the current conversation into a spec and publish it to the project issue tracker - no interview, just synthesis of what you've already discussed.

Adapted from [mattpocock/skills](https://github.com/mattpocock/skills/tree/49dd158d1076134a641b33efb035946536778336/skills/engineering/to-spec).
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
/stacks-to-spec
```

Source: [`stacks-to-spec/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-to-spec/SKILL.md).

The skill and all supporting files ship in `@stacksjs/defaults`. New apps and
framework upgrades receive them through the managed defaults sync. Run
`buddy setup:ai` to refresh the agent setup. Override this skill per project
with `app/Skills/stacks-to-spec/SKILL.md`.

See [Flow](/skills/craft/flow) and [Using skills](/skills/using).
