---
name: stacks-ui
description: Use when composing Stacks UI components, web fonts, pagination controls, accessibility, or choosing frontend primitives. Covers @stacksjs/ui, its components subpath, the STX component plugin, and native frontend skill discovery.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks UI

Start with the package boundary. Templates use STX signals and Crosswind utilities;
the CSS implementation in this checkout is `@stacksjs/ts-css/engine`. Read
`stacks-stx` for template behavior, `stacks-composables` for browser delivery
and reactive contracts, and `stacks-crosswind` for actual CSS configuration.
For visually important work also read `stacks-design-taste` and the matching
aesthetic skill. Native applications pair with `stacks-mobile` or
`stacks-desktop`; admin pages pair with `stacks-dashboard`.

## Package and component resolution

- `@stacksjs/ui` exports `CssEngine`, `ui`, font helpers, and pagination
  helpers. It does not re-export the STX engine or headless components.
- Headless components are exported from `@stacksjs/ui/components`, forwarding
  `@stacksjs/components`. Use that subpath for explicit TypeScript imports.
- STX tags such as `<Button />` and `<Sidebar />` resolve through the plugin
  in `config/ui.ts`, `storage/framework/defaults/stx-components-plugin.ts`.
  Application `resources/components/` overrides are handled by STX. Plugin
  roots contain the component library, framework defaults, then package roots.
  Installed packages contribute additive roots through `packageComponentRoots()`;
  inspect that resolver before changing precedence.
- `STX_COMPONENTS_DIR` explicitly selects a library source directory. The
  plugin otherwise tries a local STX development checkout and the installed
  library. A missing component warning is a resolution problem, not proof
  that a tag is a globally registered Vue component.

```ts
import { Dialog, DialogPanel, Switch, Tabs } from '@stacksjs/ui/components'
import { renderFontHead, buildPageSequence, urlForPage } from '@stacksjs/ui'
```

## Fonts

`renderFontPreloads(fonts)`, `renderFontFaceCss(fonts)`, and
`renderFontHead(fonts)` return HTML/CSS strings for a layout head.
`FontEntry` carries family, src, format, weight, style, display, preload and
unicodeRange. The default format is woff2, the default display is swap, and
each entry preloads unless `preload: false` is set. Keep preload lists small.
Own the list in application config; importing a helper does not load a font.
Render these trusted helper outputs with STX raw HTML syntax, not escaped text.

## Pagination controls

Use the bundled `<Pagination>` component with canonical full, simple, or
cursor paginator results. For a custom control:

- `buildPageSequence(current, last, window?)` returns page numbers and ellipses.
- `urlForPage(paginator, page)` preserves the existing URL's filter parameters.
- `paginatorVariant(paginator)` selects full, simple, or cursor behavior.

Full pagination provides counts and page jumps. Simple/cursor results do not
have a last page; render previous/next controls using their URLs/cursors.
Outside a request, missing URL context is normal rather than a broken query.

## Gotchas

- `config/ui.ts` configures STX topology; `config/css.ts` configures utilities.
- Module-level STX `Ref` helpers and browser callable signals are distinct.
  Prefer `state`, `derived`, and `effect` in templates. Imported TypeScript
  modules explicitly import every binding they use.
- Native components can have web fallbacks; verify the relevant platform
  implementation rather than promising native parity from a component name.
- Resolve Iconify classes through the existing icon pipeline; use semantic
  controls, associated labels, keyboard behavior and reduced-motion signals.
- A typecheck does not verify client delivery. Render and exercise the page.

## Source and evidence

Public boundaries: `core/ui/src/index.ts`, `core/ui/src/components.ts`,
`core/ui/package.json`. Component plugin:
`storage/framework/defaults/stx-components-plugin.ts`. Helpers:
`core/ui/src/fonts.ts`, `core/ui/src/pagination.ts`. Retained tests:
`core/ui/tests/fonts.test.ts`, `core/ui/tests/modal.test.ts`, and
`tests/unit/default-component-names.test.ts` (all core paths are relative
to `storage/framework/`).
