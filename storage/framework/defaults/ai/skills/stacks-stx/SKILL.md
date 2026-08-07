---
name: stacks-stx
description: Use when working with STX templates in a Stacks application — template syntax, components, directives, signals, reactivity, SSR, streaming, hydration, or debugging STX rendering. STX is the ONLY templating system for Stacks.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# STX Templating Engine

STX is the full-stack templating and component framework for Stacks. It handles template rendering, reactivity, SSR, streaming, hydration, and more.

## Design & anti-slop skills

When the task is how a page should *look* (not just how stx renders), pair this skill with the design-taste family: `stacks-design-taste` (flagship), the aesthetic presets `stacks-design-soft` / `stacks-design-minimalist` / `stacks-design-brutalist`, `stacks-redesign`, `stacks-design-output`, and the image-first `stacks-image-to-code` / `stacks-imagegen-web` / `stacks-imagegen-mobile` / `stacks-brandkit`. They translate premium design rules into stx + Crosswind + composables.

## Key Paths
- STX config: `config/ui.ts`
- STX plugin: `bun-plugin-stx` (loaded via bunfig.toml)
- STX build cache + route manifest: `storage/framework/stx/` (stx's `stateDir`, set in `config/ui.ts`)
- Components: `resources/components/`
- Layouts: `resources/layouts/`
- Partials: `resources/partials/`
- Views: `resources/views/`
- Package: `@stacksjs/stx`

## CRITICAL Rules
1. **ALWAYS use STX** for templating — never write vanilla JS
2. **NEVER use** `var`, `document.*`, `window.*` in STX templates
3. STX `<script>` tags should ONLY contain stx-compatible code (signals, composables, directives)

### Pre-paint appearance

Use `@appearanceBootstrap({...})` when persisted appearance must be applied
before the browser parses the application shell. Do not add a raw inline
script for `localStorage`, `document`, or `matchMedia`. The directive emits the
synchronous compiler-owned guard, validates storage through explicit
allowlists, applies the root data attributes and `dark` class, and receives the
request CSP nonce when nonce support is enabled.

```stx
@appearanceBootstrap({
  storageKey: 'app-appearance',
  appearance: {
    key: 'sidebarStyle',
    attribute: 'appearance',
    allowed: ['macos', 'arc'],
    default: 'macos',
  },
  colorMode: {
    key: 'colorMode',
    attribute: 'color-mode',
    default: 'system',
  },
})
```

Persist a JSON object under `storageKey`. Invalid JSON, storage errors, unknown
appearance values, and unsupported color modes all fall back to the declared
defaults before first paint.

## Template Structure

```html
<script client>
const count = state(0)
const title = state('Hello STX')
const showDescription = state(true)

function increment(): void {
  count.update(value => value + 1)
}
</script>

<template>
  <div class="container">
    <h1>{{ title() }}</h1>
    <p :if="showDescription()">Rendered reactively</p>
    <button type="button" @click="increment()">Count: {{ count() }}</button>
  </div>
</template>

<style>
/* Use crosswind utility classes or custom CSS */
.container { max-width: 1200px; margin: 0 auto; }
</style>
```

STX signals are callable. Read with `count()`, replace with
`count.set(value)`, and update from the current value with
`count.update(value => value + 1)`. Do not use Vue-style `.value` access in
STX templates or `resources/functions`.

### Native form binding

Use `x-model` for two-way form state instead of pairing `:value` with a
manual `@input` or `@change` handler. The expression is the signal name
without parentheses:

```html
<script client>
const query = state('')
const quantity = state(1)
const enabled = state(false)
const categories = state<string[]>([])
</script>

<input x-model.trim="query" type="search">
<input x-model.number="quantity" type="number">
<input x-model="enabled" type="checkbox">
<input x-model="categories" type="checkbox" value="news">
<select x-model="query">
  <option value="">All</option>
  <option value="active">Active</option>
</select>
```

`x-model` supports text inputs, textareas, selects, radio buttons, boolean
checkboxes, and checkbox arrays. Use `.trim` when whitespace should be
removed and `.number` when the signal should receive a number. Keep a
dedicated signal for each binding. Arbitrary expressions such as
`x-model="user.name"` are not writable bindings.

## Configuration (config/ui.ts)

```typescript
import type { StxOptions } from '@stacksjs/stx'

export default {
  componentsDir: 'components',
  layoutsDir: 'layouts',
  partialsDir: 'partials',
} satisfies StxOptions
```

### Full StxConfig

```typescript
interface StxConfig {
  enabled: boolean
  debug: boolean
  componentsDir: string
  partialsDir: string
  layoutsDir?: string
  defaultLayout?: string
  templatesDir?: string
  cachePath: string
  ssr?: boolean
  cache?: boolean
  defaultTitle?: string
  defaultDescription?: string

  // Feature modules
  i18n?: Partial<I18nConfig>
  webComponents?: Partial<WebComponentConfig>
  streaming?: Partial<StreamingConfig>
  hydration?: Partial<HydrationConfig>
  a11y?: Partial<A11yConfig>
  seo?: Partial<SeoFeatureConfig>
  animation?: Partial<AnimationConfig>
  markdown?: Partial<MarkdownConfig>
  forms?: Partial<FormConfig>
  pwa?: Partial<PwaConfig>
  components?: Partial<ComponentConfig>
  media?: Partial<MediaConfig>
  strict?: boolean | StrictModeConfig
  customDirectives?: CustomDirective[]
}
```

## STX Capabilities (118+ modules)

### Core
- Template parsing and compilation
- Reactivity system (ref, computed, watch)
- Component composition and lifecycle
- Dependency injection (provide/inject)
- DOM update scheduling with the browser-auto-imported `nextTick()`

### Template refs after structural updates

Use `useRef()` with `nextTick()` when an element is inserted by `:if`, a modal, or another structural directive and must be focused or measured immediately afterward:

```ts
const open = state(false)
const searchInput = useRef('searchInput')

function showSearch(): void {
  open.set(true)
  void nextTick(() => searchInput.current?.focus())
}
```

```html
<template :if="open()">
  <input ref="searchInput" type="search">
</template>
```

`nextTick()` runs after the current synchronous signal and effect flush. Prefer it over `querySelector`, manual DOM polling, or `requestAnimationFrame` when the task is waiting for STX to materialize reactive markup.

### Rendering
- **SSR** — Server-Side Rendering
- **Streaming** — Progressive HTML streaming
- **Hydration** — Progressive and islands-based hydration
- **Suspense** — Async component loading with fallbacks
- **Error boundaries** — Graceful error handling in components

### Features
- **Router** — Client-side routing
- **Forms** — Built-in form handling and validation
- **i18n** — Internationalization support
- **SEO** — Meta tags, Open Graph, Twitter cards, structured data
- **PWA** — Progressive Web App support
- **Animation** — CSS and JS animation system
- **Markdown** — Markdown rendering with syntax highlighting
- **A11y** — Accessibility checking and auto-fixing

### Dev Tools
- **Dev server** with HMR (Hot Module Replacement)
- **Image optimization**
- **Asset pipeline**
- **Testing utilities**

## Plugin Loading

```toml
# bunfig.toml
[serve]
plugins = ["bun-plugin-stx"]
```

The STX plugin processes `.stx` files during serve and build.

## Scaffolding

```typescript
import { createProject, addComponent, addPage, addStore, addLayout } from '@stacksjs/stx'

// Create a new project
await createProject('my-app', { template: 'dashboard' })

// Add to existing project
await addComponent('UserCard', { props: true, styles: true })
await addPage('about', { layout: 'default' })
await addStore('cart', { persist: true, actions: true })
await addLayout('admin', { nav: true, footer: true })
```

### Project Templates
`default`, `minimal`, `full`, `blog`, `dashboard`, `landing`

## Gotchas
- **STX is the ONLY templating system** — do not use other template engines
- **`bun-plugin-stx` must be loaded** — without it, `.stx` files won't be processed
- **Auto-imports** — browser auto-imports defined in `storage/framework/browser-auto-imports.json`
- **Imported module dependencies** - browser auto-imports are injected into the STX script entry only; imported `.ts` modules must explicitly import every function or store they use
- **Project-root server imports** - use `~/path` or `@/path` inside `<script server>` when a layout, partial, or page needs a project file. STX resolves both aliases against the application root before executing the server script. Relative imports still resolve against the `.stx` file
- **Browser package inputs are bundled** - core browser helpers and model auto-import bootstraps are compiler bundle inputs. Rendered HTML must never contain a bare `import '@stacksjs/browser'`, because browsers cannot resolve package specifiers without an import map
- **Server-to-client values are explicit** - a JSON-serializable top-level value exported by `<script server>` can be referenced by name in `<script client>`. STX serializes only referenced values and never overwrites a client-owned declaration
- **`storage/framework/stx/`** — stx build cache and the generated route manifest. `config/ui.ts` sets stx's `stateDir` here, so nothing lands in the project root. Gitignored; safe to delete
- **Reactivity is signal-based** - use callable `state()` and `derived()` signals, not Vue-style `ref()` or `.value`
- **Component tag case is semantic** - `<Input v-model:value="query">` is a paired component, while lowercase `<input v-model="query">` is a native void element. Keep component tags PascalCase, including names that collide with native elements
- **Structural DOM timing** - use `nextTick()` with `useRef()` after opening reactive markup
- **Crosswind for styling** — use utility classes, not inline styles
- **Script block restrictions** — only stx-compatible code (signals, composables, directives), no vanilla DOM APIs
- **Pre-paint state** - use `@appearanceBootstrap`, never a raw browser script in the template
- **Components go in `resources/`** — not in `app/` or `storage/`
- **118+ modules** — STX is a comprehensive framework covering rendering, routing, forms, i18n, SEO, PWA, and more
