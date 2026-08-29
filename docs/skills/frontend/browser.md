---
title: "Browser skill"
description: "Use when working with browser/frontend functionality in Stacks."
---
# Browser

`stacks-browser` · Frontend · model-invoked

The browser-side surface: the `useAuth` composable, the Stripe billing helpers,
the API fetch client and browser model loading.

## When to reach for it

- The useAuth composable (login, register, logout, token management)
- Stripe billing utilities (loadCardElement, confirmPayment)
- The API fetch client
- Browser model loading
- Auto-imported browser utilities

## Covers

`@stacksjs/browser`.

## Inside the skill

The sections an agent reads once the skill loads.

- Key Paths
- Authentication Composable (useAuth)
- API Client (Fetch)
- Stripe Billing (Browser-Side)
- Browser Model Loading
- Browser Query Builder
- Utility Functions
- Guards
- Auto-Initialization
- Re-exports from Composables
- Gotchas

## Where the code lives

- Core package: `storage/framework/core/browser/src/`
- Auto-imports: `storage/framework/browser-auto-imports.json`

## Using it

This one is **model-invoked**. Your agent reaches for it on its own when the task
matches, and you can also call it by name:

```
/stacks-browser
```

Source: [`stacks-browser/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-browser/SKILL.md).
Shadow it for one project with `app/Skills/stacks-browser/SKILL.md`, then re-run
`buddy setup:ai`. See [Writing your own](/skills/writing).
