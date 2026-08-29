---
title: "Composables skill"
description: "Use when creating or using reactive composables in STX templates."
---
# Composables

`stacks-composables` · Frontend · model-invoked

The 90+ reactive composables auto-imported into stx templates: state, DOM
interaction, sensors, animation, browser APIs and async operations. The
authoritative list, which matters because the manifest and the runtime have
disagreed before.

## When to reach for it

- 90+ composables for state management
- DOM interaction
- Sensors
- Animation
- Browser APIs
- Async operations
- The complete list of auto-imported composables

## Covers

`@stacksjs/composables`.

## Inside the skill

The sections an agent reads once the skill loads.

- Key Path
- Core Reactive Primitives
- State & Reactivity
- Storage
- Time & Date
- DOM & Browser
- Mouse & Touch
- Sensors
- Observers
- Async
- Network
- Input & Focus
- Utilities
- Dark Mode
- Media
- State Patterns
- Script & Style Injection
- Math
- Gotchas

## Using it

This one is **model-invoked**. Your agent reaches for it on its own when the task
matches, and you can also call it by name:

```
/stacks-composables
```

Source: [`stacks-composables/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-composables/SKILL.md).
Shadow it for one project with `app/Skills/stacks-composables/SKILL.md`, then re-run
`buddy setup:ai`. See [Writing your own](/skills/writing).
