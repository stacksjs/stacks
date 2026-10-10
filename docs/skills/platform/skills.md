---
title: "Skills skill"
description: "Use when discovering, validating, overriding, or distributing Stacks agent skills. Covers @stacksjs/skills, app/Skills, bundled defaults and buddy setup:ai."
---
# Skills

`stacks-skills` · Native Stacks · model-invoked

Use when discovering, validating, overriding, or distributing Stacks agent skills. Covers @stacksjs/skills, app/Skills, bundled defaults and buddy setup:ai.

Read the skill for the implementation workflow and its current signatures. The
[Native capabilities](/skills/platform/native) catalog maps the package to
source and retained evidence; driver limits are explicit.

## Inside the skill



## Using it

This skill is **model-invoked**. Your agent can select it for matching tasks, and you can call it directly.

```text
/stacks-skills
```

Source: [`stacks-skills/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-skills/SKILL.md).

It ships in `@stacksjs/defaults` with its supporting files. Run
`buddy setup:ai` to refresh the agent setup. Override it per project with
`app/Skills/stacks-skills/SKILL.md`. See [Using skills](/skills/using).
