---
name: stacks-stx
description: Use when working with STX templates in a Stacks application — template syntax, components, directives, signals, reactivity, SSR, streaming, hydration, or debugging STX rendering. STX is the ONLY templating system for Stacks.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# STX Templating Engine

STX is the full-stack templating and component framework for Stacks. It handles template rendering, reactivity, SSR, streaming, hydration, and more.

## Key Paths
- STX config: `config/stx.ts`
- STX plugin: `bun-plugin-stx` (loaded via bunfig.toml)
- STX state: `.stx/`
- Components: `resources/components/`
- Layouts: `resources/layouts/`
- Partials: `resources/partials/`
- Views: `resources/views/`
- Package: `@stacksjs/stx`

## CRITICAL Rules
1. **ALWAYS use STX** for templating — never write vanilla JS
2. **NEVER use** `var`, `document.*`, `window.*` in STX templates
3. STX `<script>` tags should ONLY contain stx-compatible code (signals, composables, directives)

## Template Structure

```html
<template>
  <div class="container">
    <h1>{{ title }}</h1>
    <p x-if="showDescription">{{ description }}</p>
    <button @click="increment">Count: {{ count }}</button>
  </div>
</template>

<script>
import { ref, computed } from '@stacksjs/composables'

const count = ref(0)
const title = ref('Hello STX')
const showDescription = ref(true)

function increment() {
  count.value++
}
</script>

<style>
/* Use crosswind utility classes or custom CSS */
.container { max-width: 1200px; margin: 0 auto; }
</style>
```

## Configuration (config/stx.ts)

```typescript
import type { StxOptions } from '@stacksjs/stx'

export default {
  componentsDir: 'resources/components',
  layoutsDir: 'resources/layouts',
  partialsDir: 'resources/partials',
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
- **`.stx/` directory** — contains STX-specific state and cache
- **Reactivity is custom** — `ref()` and `computed()` from STX are not Vue's implementation
- **Crosswind for styling** — use utility classes, not inline styles
- **Script block restrictions** — only stx-compatible code (signals, composables, directives), no vanilla DOM APIs
- **Components go in `resources/`** — not in `app/` or `storage/`
- **118+ modules** — STX is a comprehensive framework covering rendering, routing, forms, i18n, SEO, PWA, and more
