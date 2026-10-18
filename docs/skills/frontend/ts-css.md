---
title: "ts-css skill"
description: "Use when styling Stacks templates with ts-css utilities, configuring the ts-css engine, responsive or dark variants, theme tokens, shortcuts, safelists, or debugging generated CSS. Covers config/css.ts and @stacksjs/ts-css/engine."
---
# ts-css

`stacks-ts-css` · Frontend · model-invoked

The utility-first CSS engine that styles a Stacks app. Utility classes, theming,
responsive design, variants, custom rules and how the CSS is generated.

## When to reach for it

- Utility-first CSS classes
- Theming
- Responsive design
- Variants
- Custom rules
- CSS generation through `config/css.ts` and the published ts-css engine

## Inside the skill

The sections an agent reads once the skill loads.

- Configuration and delivery
- Template authoring
- Gotchas
- Source and evidence

## Where the code lives

- Package: `@stacksjs/ts-css/engine` (installed from `@stacksjs/ts-css`)
- CSS config: `config/css.ts`, typed with `CssOptions`
- STX config: `config/ui.ts` (view roots and state directory)
- Default styles: `storage/framework/defaults/styles/`
- Output: `storage/framework/stx/cache/cw-<hash>.css`, one file per page (stx's `stateDir`, set in `config/ui.ts`)

## Related skills

- [Brand kit](/skills/design/brandkit)
- [Design: brutalist](/skills/design/design-brutalist)
- [Design: minimalist](/skills/design/design-minimalist)
- [Design: full output](/skills/design/design-output)
- [Design: soft](/skills/design/design-soft)
- [Design taste](/skills/design/design-taste)
- [Image to code](/skills/design/image-to-code)
- [Image generation: mobile](/skills/design/imagegen-mobile)
- [Image generation: web](/skills/design/imagegen-web)
- [Redesign](/skills/design/redesign)

## Using it

This one is **model-invoked**. Your agent reaches for it on its own when the task
matches, and you can also call it by name:

```
/stacks-ts-css
```

Source: [`stacks-ts-css/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-ts-css/SKILL.md).
Shadow it for one project with `app/Skills/stacks-ts-css/SKILL.md`, then re-run
`buddy setup:ai`. See [Writing your own](/skills/writing).

## Native source verification

The skill has been checked against current source and retained tests. Read its
entrypoint and linked references for the actual contract; summaries here are
discovery pointers. [Native capabilities](/skills/platform/native) maps every
core package and records driver evidence without claiming universal parity.
