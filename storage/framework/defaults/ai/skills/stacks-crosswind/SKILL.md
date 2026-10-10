---
name: stacks-crosswind
description: Use when styling Stacks templates with Crosswind utilities, configuring the ts-css engine, responsive or dark variants, theme tokens, shortcuts, safelists, or debugging generated CSS. Covers config/css.ts and @stacksjs/ts-css/engine.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks utility CSS

Use Crosswind utility classes in STX. The current framework implements this
through `@stacksjs/ts-css/engine`, the successor package used by STX and
`@stacksjs/ui`; do not copy an old `@cwcss/crosswind` import into this checkout.
Pair visually important work with `stacks-design-taste`.

## Configuration and delivery

`config/css.ts` is the authoritative application config, typed as
`CssOptions` from `@stacksjs/ts-css/engine`. `config/ui.ts` instead configures
STX, including its root and stateDir. STX's loader accepts a legacy crosswind
config as a deprecated fallback; prefer the css name for new projects.

```ts
import type { CssOptions } from '@stacksjs/ts-css/engine'

export default {
  content: ['./resources/**/*.{stx,html}'],
  minify: false,
} satisfies CssOptions
```

The default config also includes framework component/view roots. Preserve those
when replacing application content globs. The STX server generates CSS for
the page's extracted classes and caches it under
`storage/framework/stx/cache/cw-<hash>.css`. The historical cw prefix does not
mean that the old package is loaded. Cache output is runtime state, not source.

For engine-level work, inspect the installed `CssOptions` and exports rather
than copying a handwritten interface. The engine exposes `CSSGenerator`:

```ts
import { CSSGenerator, defaultConfig } from '@stacksjs/ts-css/engine'

const generator = new CSSGenerator(defaultConfig)
generator.generate('hover:bg-blue-600')
const css = generator.toCSS()
```

## Template authoring

Use static complete class names so extraction can find the selected utilities.
For stateful classes use literal branches, for example
`:class="active() ? 'bg-blue-600' : 'bg-gray-200'"`, rather than assembling
`'bg-' + color`. If a class only exists in runtime data, deliberately safelist
it in the engine config after checking the config's actual type.

Responsive variants (`md:`, `lg:`), state variants (`hover:`, `focus-visible:`),
`dark:`, arbitrary values and `motion-reduce:` are ordinary utilities. Theme,
shortcut and custom-rule support belongs in css config. Validate an uncommon
utility by checking emitted CSS in the installed engine; familiar Tailwind
syntax alone does not establish support.

## Gotchas

- Preflight configuration uses `preflights` objects. A top-level boolean
  `preflight` is not the engine option; the base reset already ships.
- Dark utilities require the appropriate root appearance state. Use
  `useColorMode()` and STX `@appearanceBootstrap` for persisted pre-paint setup.
- Keep fonts and colors in application tokens/config; a utility does not
  download a font or introduce an icon dependency.
- Use CSS transitions/keyframes and scroll-driven CSS for motion. Browser
  observation and reduced-motion helpers are documented in
  `stacks-composables`, including cleanup and client-delivery boundaries.
- Content hashes include config/class inputs. A cache file should never be
  hand-edited to fix a source class or token.

## Source and evidence

`config/css.ts`, `config/ui.ts`, `core/ui/src/index.ts` and
`core/ui/package.json` establish the framework boundary. The installed STX
`dev-server/ts-css` module establishes loader precedence, class extraction
and cache behavior. Relevant upstream tests include
`test/dev-server/ts-css-extraction.test.ts` and
`test/ts-css-shortcut-precedence.test.ts`. Core paths are relative to
`storage/framework/`.
