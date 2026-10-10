---
title: "Test Fixtures skill"
description: "Replace unsafe assertions with valid typed fixtures while preserving malformed-input tests."
---
# Test Fixtures

`stacks-test-fixtures` · Engineering craft · model-invoked

Replace unsafe assertions with valid typed fixtures while preserving malformed-input tests.

Adapted from [mattpocock/skills](https://github.com/mattpocock/skills/tree/49dd158d1076134a641b33efb035946536778336/skills/misc/migrate-to-shoehorn).
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

This skill is **model-invoked**. Your agent can select it when the task matches, and you can call it directly.

```text
/stacks-test-fixtures
```

Source: [`stacks-test-fixtures/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-test-fixtures/SKILL.md).

The skill and all supporting files ship in `@stacksjs/defaults`. New apps and
framework upgrades receive them through the managed defaults sync. Run
`buddy setup:ai` to refresh the agent setup. Override this skill per project
with `app/Skills/stacks-test-fixtures/SKILL.md`.

See [Flow](/skills/craft/flow) and [Using skills](/skills/using).
