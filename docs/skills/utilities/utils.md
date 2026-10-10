---
title: "Utils skill"
description: "Use when needing general utility functions in Stacks - deep merge, debounce/throttle, color output, byte formatting, markdown tables, YAML parsing, Pipeline class, ResizeObserver, Macroable, project initialization, indentation detection, or the comprehensive utility toolkit. Covers @stacksjs/utils."
---
# Utils

`stacks-utils` · Native Stacks · model-invoked

Use when needing general utility functions in Stacks - deep merge, debounce/throttle, color output, byte formatting, markdown tables, YAML parsing, Pipeline class, ResizeObserver, Macroable, project initialization, indentation detection, or the comprehensive utility toolkit. Covers @stacksjs/utils.

Read the skill for the implementation workflow and its current signatures. The
[Native capabilities](/skills/platform/native) catalog maps the package to
source and retained evidence; driver limits are explicit.

## Inside the skill

- Key Paths
- Architecture
- Deep Merge (`merge.ts`)
- Debounce & Throttle (`debounce.ts`)
- Color Output (`colors.ts`)
- Byte Formatting (`bytes.ts`)
- Export Size Calculation (`size.ts`)
- Pipeline (`pipeline.ts`)
- Markdown Tables (`markdown.ts`)
- YAML (`helpers.ts`)
- Macroable (`macroable.ts`)
- ResizeObserver (`observer.ts`)
- Deep Equality (`equal.ts`)
- Version Comparison (`versions.ts`)
- Detection Utilities (`detect.ts`)
- Project Utilities (`helpers.ts`)
- Find Stacks Projects (`find.ts`)
- Git Utilities (`git.ts`)
- Clean Project (`clean.ts`)
- Config Builders (re-exported from `@stacksjs/config`)
- Hash Utilities (`hash.ts`)
- Glob boundary
- Safe serialization and typed composition
- Gotchas

## Using it

This skill is **model-invoked**. Your agent can select it for matching tasks, and you can call it directly.

```text
/stacks-utils
```

Source: [`stacks-utils/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-utils/SKILL.md).

It ships in `@stacksjs/defaults` with its supporting files. Run
`buddy setup:ai` to refresh the agent setup. Override it per project with
`app/Skills/stacks-utils/SKILL.md`. See [Using skills](/skills/using).
