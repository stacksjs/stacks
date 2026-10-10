---
title: "CLI skill"
description: "Use when building CLI commands or tools with Stacks - the @stacksjs/cli package for creating commands with argument parsing, option handling, colored output, tables, progress indicators, prompts, or integrating with the buddy command system. Covers @stacksjs/cli and app/Commands/."
---
# CLI

`stacks-cli` · Native Stacks · model-invoked

Use when building CLI commands or tools with Stacks - the @stacksjs/cli package for creating commands with argument parsing, option handling, colored output, tables, progress indicators, prompts, or integrating with the buddy command system. Covers @stacksjs/cli and app/Commands/.

Read the skill for the implementation workflow and its current signatures. The
[Native capabilities](/skills/platform/native) catalog maps the package to
source and retained evidence; driver limits are explicit.

## Inside the skill

- Key Paths
- Creating Commands
- CLI Event Listeners
- Output Formatting
- config/cli.ts (BinaryConfig)
- CLI Commands
- Compiled Binaries
- Gotchas
- Native terminal primitives

## Using it

This skill is **model-invoked**. Your agent can select it for matching tasks, and you can call it directly.

```text
/stacks-cli
```

Source: [`stacks-cli/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-cli/SKILL.md).

It ships in `@stacksjs/defaults` with its supporting files. Run
`buddy setup:ai` to refresh the agent setup. Override it per project with
`app/Skills/stacks-cli/SKILL.md`. See [Using skills](/skills/using).
