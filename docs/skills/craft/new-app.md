---
title: "New app skill"
description: "Use when starting a Stacks app with buddy new or structuring one in its first days - feature bundles, free dev ports, layouts, partials, components and page data, theme tokens, plan limits, and the first verification loop."
---
# New app

`stacks-new-app` · Engineering craft · model-invoked

The path from an empty directory to an app with a shape worth building on. Each
step ends on something you can observe: a scaffold commit, a boot with no
warnings, a starter page read before it is replaced, one real file of each kind
under `resources/`, a `CONTEXT.md` before the first model, and a verification
loop that ends in a real browser.

## When to reach for it

- Running `buddy new`, with or without `--minimal`, and choosing feature bundles
- Picking dev ports another project does not already hold
- Laying out layouts, partials, components and `resources/data` modules
- Setting theme tokens once so one class follows light and dark
- Placing plan limits where the pricing page and the enforcing action share them

## Inside the skill

The sections an agent reads once the skill loads.

- Scaffold
- Pick ports, then boot
- Read the starter before replacing it
- Give the app its structure
- Name the domain before the first model
- Verify, every time
- Ship
- Gotchas

## Related skills

- [Development](/skills/toolchain/development)
- [stx](/skills/frontend/stx)
- [Domain modeling](/skills/craft/domain-modeling)
- [New feature](/skills/craft/new-feature)
- [Upstream](/skills/craft/upstream)

## Using it

This one is **model-invoked**. Your agent reaches for it on its own when the task
matches, and you can also call it by name:

```
/stacks-new-app
```

Source: [`stacks-new-app/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-new-app/SKILL.md).
Shadow it for one project with `app/Skills/stacks-new-app/SKILL.md`, then re-run
`buddy setup:ai`. See [Writing your own](/skills/writing).

## Native source verification

The skill has been checked against current source and retained tests. Read its
entrypoint and linked references for the actual contract; summaries here are
discovery pointers. [Native capabilities](/skills/platform/native) maps every
core package and records driver evidence without claiming universal parity.
