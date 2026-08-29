---
title: "Utils skill"
description: "Use when needing general utility functions in Stacks."
---
# Utils

`stacks-utils` · Utilities · model-invoked

The general toolkit: deep merge, debounce and throttle, byte formatting, markdown
tables, YAML parsing, the `Pipeline` class and a good deal more.

## When to reach for it

- Deep merge
- debounce/throttle
- Color output
- Byte formatting
- Markdown tables
- YAML parsing
- Pipeline class
- ResizeObserver
- Macroable
- Project initialization
- Indentation detection
- The comprehensive utility toolkit

## Covers

`@stacksjs/utils`.

## Inside the skill

The sections an agent reads once the skill loads.

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
- Glob (re-export)
- Gotchas

## Where the code lives

- Core package: `storage/framework/core/utils/src/`
- Package: `@stacksjs/utils`

## Using it

This one is **model-invoked**. Your agent reaches for it on its own when the task
matches, and you can also call it by name:

```
/stacks-utils
```

Source: [`stacks-utils/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-utils/SKILL.md).
Shadow it for one project with `app/Skills/stacks-utils/SKILL.md`, then re-run
`buddy setup:ai`. See [Writing your own](/skills/writing).
