---
name: stacks-ui
description: Use when working with UI in a Stacks application — components, composables, reactivity (refs/watch/computed), Craft native components, Headwind CSS, Crosswind utility framework, accessibility, or the STX templating engine. Covers @stacksjs/ui, @stacksjs/stx, and related UI tooling.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks UI

## Key Paths
- Core package: `storage/framework/core/ui/src/`
- Components: `storage/framework/core/ui/src/components/`
- UI config: `config/ui.ts` (Headwind)
- STX config: `config/stx.ts`
- STX engine: `node_modules/@stacksjs/stx/`
- Crosswind: `node_modules/@cwcss/crosswind/`
- Component types: `storage/framework/types/components.d.ts`

## Source Files
```
ui/src/
├── index.ts              # Re-exports from @stacksjs/stx
├── components.ts         # Component re-exports
└── components/
    ├── autocomplete.ts   # Combobox, ComboboxInput, ComboboxOption, ComboboxOptions
    ├── disclosure.ts     # Disclosure, DisclosureButton, DisclosurePanel
    ├── menu.ts           # Menu, MenuButton, MenuItem, MenuItems
    ├── modal.ts          # Dialog, DialogDescription, DialogPanel, DialogTitle
    ├── popover.ts        # Popover, PopoverButton, PopoverPanel
    ├── radio-group.ts    # RadioGroup, RadioGroupLabel, RadioGroupOption
    ├── select.ts         # Combobox-based select
    ├── tabs.ts           # Tab, TabGroup, TabList, TabPanel, TabPanels
    ├── toggle.ts         # Switch
    └── transition.ts     # TransitionChild, TransitionRoot
```

## Headless Components

```typescript
import { Combobox, ComboboxInput, ComboboxOption, ComboboxOptions } from '@stacksjs/ui'
import { Dialog, DialogDescription, DialogPanel, DialogTitle } from '@stacksjs/ui'
import { Menu, MenuButton, MenuItem, MenuItems } from '@stacksjs/ui'
import { Tab, TabGroup, TabList, TabPanel, TabPanels } from '@stacksjs/ui'
import { Switch } from '@stacksjs/ui'
import { TransitionChild, TransitionRoot } from '@stacksjs/ui'
```

## Craft Native Components

Built-in components with native HTML fallbacks:

| Component | Fallback | Key Props |
|-----------|----------|-----------|
| `craft-button` | `<button>` | variant (primary/secondary/outline) |
| `craft-text-input` | `<input>` | placeholder, value, type, disabled |
| `craft-textarea` | `<textarea>` | placeholder, value, rows |
| `craft-checkbox` | `<input type="checkbox">` | checked, disabled, label |
| `craft-select` | `<select>` | value, options, placeholder |
| `craft-modal` | `<dialog>` | open, title, closable, size |
| `craft-tabs` | `<div>` | activeTab, tabs |
| `craft-table` | `<table>` | columns, rows, sortable, selectable |
| `craft-card` | `<div>` | title, subtitle, variant |
| `craft-alert` | `<div>` | variant, title, dismissible |
| `craft-toast` | `<div>` | variant, duration, position |
| `craft-tooltip` | `<span>` | content, position |
| `craft-pagination` | `<nav>` | total, page, pageSize |
| `craft-code-editor` | `<textarea>` | value, language, theme, lineNumbers |
| `craft-date-picker` | `<input type="date">` | value, min, max, format |
| `craft-color-picker` | `<input type="color">` | value, format |
| `craft-badge` | `<span>` | variant, size |
| `craft-avatar` | `<div>` | src, alt, size, fallback |
| `craft-progress` | `<div>` | value, max, variant |
| `craft-spinner` | `<div>` | size |
| `craft-accordion` | `<details>` | open, title |
| `craft-divider` | `<hr>` | orientation, variant |
| `craft-breadcrumb` | `<nav>` | items, separator |
| `craft-menu` | `<nav>` | items, orientation |
| `craft-tree` | `<div>` | nodes, expandable, selectable |
| `craft-list` | `<ul>` | items, selectable |
| `craft-slider` | `<input type="range">` | value, min, max, step |
| `craft-radio` | `<input type="radio">` | checked, name, value, label |
| `craft-file-browser` | `<div>` | path, showHidden, selectable |

## Reactivity System

```typescript
import { ref, namedRef, computed, watch } from '@stacksjs/stx'

const count = ref(0)
count.value = 5

const doubled = computed(() => count.value * 2)

const stop = watch(
  () => count.value,
  (newVal, oldVal) => console.log(`${oldVal} → ${newVal}`),
  { immediate: false }
)
stop()  // cleanup
```

### Types
```typescript
interface Ref<T> { value: T | null, readonly current: T | null }

interface ComponentInstance {
  id: string, element: Element | null
  mountHooks: LifecycleHook[], destroyHooks: CleanupFn[], updateHooks: LifecycleHook[]
  refs: Map<string, Ref<any>>, watchers: Array<{ stop: () => void }>
  isMounted: boolean
}
```

## Lifecycle Hooks

```typescript
import { onMount, onDestroy, onUpdate } from '@stacksjs/stx'
// Aliases: onMounted, onUnmounted, onUpdated

onMount(() => {
  console.log('mounted')
  return () => console.log('cleanup')  // optional
})
onDestroy(() => console.log('destroyed'))
onUpdate(() => console.log('updated'))
```

## Dependency Injection

```typescript
import { provide, inject, createInjectionKey, withInjectionScope } from '@stacksjs/stx'

const ThemeKey = createInjectionKey<string>('theme')
provide(ThemeKey, 'dark')
const theme = inject(ThemeKey)             // 'dark'
const theme = inject(ThemeKey, 'light')    // with default
```

## Browser Composables

```typescript
import {
  useLocalStorage, useSessionStorage, useEventListener,
  useClickOutside, useWindowSize, useMediaQuery,
  usePrefersDark, useOnline
} from '@stacksjs/stx'

const { value, remove } = useLocalStorage('key', defaultValue)
const { width, height } = useWindowSize()
const isDark = usePrefersDark()
const isOnline = useOnline()
const cleanup = useClickOutside(elementRef, handler)
```

## Headwind Configuration (config/ui.ts)

```typescript
export default {
  content: [
    './resources/**/*.{html,js,ts,jsx,tsx,stx}',
    './storage/framework/defaults/**/*.{html,js,ts,jsx,tsx,stx}',
    './storage/framework/views/**/*.{html,js,ts,jsx,tsx,stx}',
  ],
  output: './storage/framework/assets/headwind.css',
  minify: false,
} satisfies HeadwindOptions
```

## STX Configuration (config/stx.ts)

```typescript
export default {
  componentsDir: 'resources/components',
  layoutsDir: 'resources/layouts',
  partialsDir: 'resources/partials',
} satisfies StxOptions
```

### Full StxConfig
```typescript
interface StxConfig {
  enabled: boolean, debug: boolean
  templatesDir?, componentsDir, partialsDir, layoutsDir?, defaultLayout?
  ssr?: boolean, cache?: boolean, cachePath: string
  i18n?: Partial<I18nConfig>
  webComponents?: Partial<WebComponentConfig>
  streaming?: Partial<StreamingConfig>
  hydration?: Partial<HydrationConfig>
  a11y?: Partial<A11yConfig>
  seo?: Partial<SeoFeatureConfig>
  animation?: Partial<AnimationConfig>
  markdown?: Partial<MarkdownConfig>
  pwa?: Partial<PwaConfig>
  strict?: boolean | StrictModeConfig
}
```

## Accessibility

```typescript
import { checkA11y, autoFixA11y, scanA11yIssues } from '@stacksjs/stx'

const violations = await checkA11y(html, filePath)
const result = autoFixA11y(html, config)
const issues = await scanA11yIssues('./resources', { recursive: true })
```

```typescript
interface A11yConfig {
  enabled: boolean, addSrOnlyStyles: boolean
  level: 'AA' | 'AAA', ignoreChecks?: string[], autoFix: boolean
}
```

## Crosswind CSS Framework

Utility-first CSS (like Tailwind), built into Stacks:

```typescript
import { buildCrosswindCSS, extractClassNames, generateCrosswindCSS } from '@stacksjs/stx'

const css = await buildCrosswindCSS(cwd)
const classNames = extractClassNames(htmlContent)
```

Features: theme config, 40+ variant modifiers, custom rules, shortcuts, attributify mode, bracket syntax, presets.

## Gotchas
- **@stacksjs/ui re-exports from @stacksjs/stx** — the UI package is thin, the engine is in STX
- **Craft components use native fallbacks** — `preferNative: true` renders plain HTML
- **Refs are not Vue refs** — similar API but custom reactive implementation
- **Lifecycle hooks require component context** — must be called within `setupComponent()`
- **Headwind is not Tailwind** — Stacks' own CSS utility implementation
- **Crosswind is the utility engine** — handles class extraction, CSS generation, purging
- **STX is the templating engine** — handles `.stx` files, SSR, streaming, hydration
- **Two CSS systems coexist** — Headwind (config) and Crosswind (engine)
- **150+ globally registered Vue components** — no imports needed
