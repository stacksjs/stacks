---
title: Functions
description: "Functions in Stacks are the reusable TypeScript modules under resources/functions - auto-imported into stx templates and publishable as their own npm package."
---
# Functions

Functions live in `resources/functions/`. They are plain TypeScript modules that
Stacks does two things with: auto-imports them into stx templates, and builds
them into a publishable npm package.

::: warning Not server handlers
Functions are **not** API endpoints. There is no `app/Functions/` directory, no
`FunctionContext`, and no `/api/functions/:name` route - this page described all
three for a long time, and none of them has ever existed
([#2581](https://github.com/stacksjs/stacks/issues/2581)).

Server-side request handling is [Actions](/basics/actions), in `app/Actions/`,
reached through [routes](/basics/routing). If you came here looking for "where
does my endpoint logic go", that is the page you want.
:::

## Overview

Functions help you:

- **Share logic across templates** - one implementation, auto-imported everywhere
- **Hold client state** - stx signals that several views read and write
- **Ship a library** - publish `resources/functions/` to npm as its own package

## Quick Start

### Creating a Function

```typescript
// resources/functions/counter.ts
export const count = state(0)

export function increment(): void {
  count.update((n: number) => n + 1)
}

export function reset(): void {
  count.set(0)
}
```

`state` has no import because it is an stx ambient global, along with `derived`,
`effect` and the 27 `use*` composables. See [stx](/packages/stx).

### Using a Function

Every export under `resources/functions/` is auto-imported into stx templates.
No import statement:

```html
<!-- resources/views/counter.stx -->
<template>
  <p>{{ count }}</p>
  <button type="button" @click="increment()">+1</button>
  <button type="button" @click="reset()">Reset</button>
</template>
```

Auto-imports reach the stx script entry only. A TypeScript module imported BY
that script has to import what it uses explicitly:

```typescript
// resources/functions/report.ts
import { count } from './counter'

export function describeCount(): string {
  return `count is ${count()}`
}
```

Run `buddy generate` after adding a file, so the generated declarations pick it
up and your editor stops complaining.

## Composables

A function module is the natural home for state several views share, because the
module is evaluated once:

```typescript
// resources/functions/dark.ts
export const isDark = useDark()
export const preferredDark = usePreferredDark()

export function toggleDark(): void {
  isDark.set(!isDark())
}
```

Two views importing `isDark` get the same signal, so toggling in a header
updates a sidebar with no wiring between them.

That also means module-level state is global to the page. State that belongs to
one component belongs in that component's `<script>`, not here.

## Building a Function Library

`resources/functions/` can be published to npm. Declare the package in
`config/library.ts`:

```typescript
// config/library.ts
export default {
  packages: [
    {
      name: 'hello-world-fx',
      kind: 'functions',
      description: 'Your function library description.',
      keywords: ['functions', 'composables', 'library', 'typescript'],
      include: ['*.ts'],

      // These call stx's ambient globals (`state`, `useDark`), which no module
      // exports. Declaring the runtime is what lets them ship: without it the
      // build refuses them, because a consumer importing the published package
      // would hit `ReferenceError: state is not defined`.
      runtime: 'stx',
    },
  ],
}
```

One `resources/` tree can produce any number of packages. Each entry claims a
slice by glob and gets its own name, manifest, dist and version; slices may
overlap, so one function can ship in a bundle package and in a focused one.

```bash
buddy build:functions   # build the function library
buddy libs              # show what each package resolved to
buddy build:libs        # build every package in config/library.ts
buddy libs:publish      # publish them
```

## Testing Functions

A function is a module, so test it as one - there is no context to construct:

```typescript
// tests/unit/counter.test.ts
import { beforeEach, describe, expect, it } from 'bun:test'
import { count, increment, reset } from '../../resources/functions/counter'

describe('counter', () => {
  // Module state is shared, so reset it rather than relying on test order.
  beforeEach(() => reset())

  it('increments', () => {
    increment()
    expect(count()).toBe(1)
  })
})
```

A function that calls an stx ambient global (`state`, `useDark`, ...) has no
module to import it from, so a plain `bun test` will not resolve it. Test those
through the template that uses them, or extract the logic into a function that
takes the value as an argument.

## Related

- [Actions](/basics/actions) - server-side request handling, in `app/Actions/`
- [Routing](/basics/routing) - how a request reaches an action
- [stx](/packages/stx) - templates, signals, and the ambient globals
- [Components](/basics/components) - the other half of `resources/`
- [Libraries](/guide/libraries) - publishing what you build
