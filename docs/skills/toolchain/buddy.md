---
title: "Buddy skill"
description: "Use when working with the Stacks CLI (buddy/bud/stacks/stx) - understanding every command with its flags and options, adding custom commands, the make:* scaffolding commands, development server commands, build commands, deployment commands, email/mail commands, environment management, or domain/DNS commands. Covers @stacksjs/buddy and all CLI command files."
---
# Buddy

`stacks-buddy` · Native Stacks · model-invoked

Use when working with the Stacks CLI (buddy/bud/stacks/stx) - understanding every command with its flags and options, adding custom commands, the make:* scaffolding commands, development server commands, build commands, deployment commands, email/mail commands, environment management, or domain/DNS commands. Covers @stacksjs/buddy and all CLI command files.

Read the skill for the implementation workflow and its current signatures. The
[Native capabilities](/skills/platform/native) catalog maps the package to
source and retained evidence; driver limits are explicit.

## Inside the skill

- Key Paths
- CLI Aliases
- Architecture
- Interactive Mode
- Development Commands
- Build Commands
- Database Commands
- Code Generation (make:*)
- Code Generation (generate)
- Environment Management
- Cloud & Deployment
- Domain & DNS
- Email / Mail Commands
- Code Quality
- Project Management
- Maintenance Mode
- Other Commands
- Adding Custom Commands
- Gotchas

## Using it

This skill is **model-invoked**. Your agent can select it for matching tasks, and you can call it directly.

```text
/stacks-buddy
```

Source: [`stacks-buddy/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-buddy/SKILL.md).

It ships in `@stacksjs/defaults` with its supporting files. Run
`buddy setup:ai` to refresh the agent setup. Override it per project with
`app/Skills/stacks-buddy/SKILL.md`. See [Using skills](/skills/using).
