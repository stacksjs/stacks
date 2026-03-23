---
name: stacks-crosswind
description: Use when styling components in a Stacks application — utility-first CSS classes, theming, responsive design, variants, custom rules, or CSS generation. Crosswind is the CSS utility engine powering Stacks' Headwind config.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Crosswind CSS Framework

Crosswind (`@cwcss/crosswind`) is the utility-first CSS engine for Stacks — similar to Tailwind CSS but built for Bun.

## Key Paths
- Package: `node_modules/@cwcss/crosswind/`
- UI config: `config/ui.ts` (Headwind options referencing Crosswind)
- Default styles: `storage/framework/defaults/styles/`
- Output: `storage/framework/assets/headwind.css`

## Core API

### CSSGenerator

```typescript
import { CSSGenerator } from '@cwcss/crosswind'

const generator = new CSSGenerator(config: CrosswindConfig)
generator.generate(className: string): void    // Process a single class
generator.toCSS(includePreflight?, minify?): string  // Output CSS
generator.reset(): void                        // Clear generated CSS
```

### Parser

```typescript
import { parseClass, expandBracketSyntax, extractClasses, extractAttributifyClasses } from '@cwcss/crosswind'

parseClass('hover:bg-blue-500'): ParsedClass
// { raw: 'hover:bg-blue-500', variants: ['hover'], utility: 'bg-blue-500', important: false, arbitrary: false }

extractClasses(htmlContent: string, options?): Set<string>
expandBracketSyntax('text-[#1a1a1a]', config?): string[]
extractAttributifyClasses(content, config?): Set<string>
```

### Scanner

```typescript
import { Scanner } from '@cwcss/crosswind'

const scanner = new Scanner(patterns: string[], transformer?, extractOptions?)
await scanner.scan(): Promise<ScanResult>
await scanner.scanFile(filePath: string): Promise<Set<string>>
scanner.scanContent(content: string): Set<string>
```

### Build Functions

```typescript
import { build, writeCSS, buildAndWrite } from '@cwcss/crosswind'

const result = await build(config: CrosswindConfig): Promise<BuildResult>
await writeCSS(css: string, outputPath: string): Promise<void>
await buildAndWrite(config: CrosswindConfig): Promise<BuildResult>

interface BuildResult {
  css: string
  classes: Set<string>
  duration: number
  compiledClasses?: Map<string, { className: string, utilities: string[] }>
  transformedFiles?: Map<string, string>
}
```

### Bun Plugin

```typescript
import { plugin } from '@cwcss/crosswind'

const bunPlugin = plugin(options?: CrosswindPluginOptions): BunPlugin
```

## Configuration

```typescript
interface CrosswindConfig {
  content: string[]                    // Glob patterns for source files
  output: string                       // Output CSS file path
  minify: boolean
  watch: boolean
  verbose?: boolean
  theme: Theme
  shortcuts: Record<string, string | string[]>
  rules: CustomRule[]
  variants: VariantConfig
  safelist: string[]                   // Always include these classes
  blocklist: string[]                  // Never include these classes
  preflights: Preflight[]
  presets: Preset[]
  compileClass?: CompileClassConfig
  attributify?: AttributifyConfig
  bracketSyntax?: BracketSyntaxConfig
  cssVariables?: boolean
}
```

### Theme

```typescript
interface Theme {
  colors: Record<string, string | Record<string, string>>
  spacing: Record<string, string>
  fontSize: Record<string, [string, { lineHeight: string }]>
  fontFamily: Record<string, string[]>
  screens: Record<string, string>
  borderRadius: Record<string, string>
  boxShadow: Record<string, string>
  extend?: Partial<Omit<Theme, 'extend'>>
}
```

### Variants (40+ built-in)

```
responsive, hover, focus, active, disabled, dark, group, peer,
before, after, marker, first, last, odd, even, first-of-type,
last-of-type, visited, checked, focus-within, focus-visible,
placeholder, selection, file, required, valid, invalid, read-only,
autofill, open, closed, empty, enabled, only, target, indeterminate,
default, optional, print, rtl, ltr, motion-safe, motion-reduce,
contrast-more, contrast-less
```

### Parsed Class Structure

```typescript
interface ParsedClass {
  raw: string              // Original class string
  variants: string[]       // Applied variants (hover, focus, etc.)
  utility: string          // Core utility name
  value?: string           // Arbitrary value if present
  important: boolean       // Has ! prefix
  arbitrary: boolean       // Uses [] brackets
  typeHint?: string        // Type hint for arbitrary values
}
```

## Usage in Templates

```html
<div class="flex items-center justify-between p-4 bg-white rounded-lg shadow">
  <h1 class="text-2xl font-bold text-gray-900">Title</h1>
  <button class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
    Click me
  </button>
</div>

<!-- Arbitrary values -->
<div class="text-[#1a1a1a] w-[calc(100%-2rem)] grid-cols-[1fr_2fr]">

<!-- Dark mode -->
<div class="bg-white dark:bg-gray-900 text-black dark:text-white">

<!-- Responsive -->
<div class="w-full md:w-1/2 lg:w-1/3">
```

## Built-in Utility Categories
- Display (flex, grid, block, hidden, container)
- Flexbox (direction, wrap, justify, align, gap)
- Spacing (margin, padding)
- Sizing (width, height, min/max)
- Typography (font-size, font-weight, line-height, text-align, text-color)
- Colors (background, text, border, ring)
- Borders (width, radius, style)
- Effects (shadow, opacity)
- Transitions & animations

## Gotchas
- **Not Tailwind** — Crosswind is a separate implementation with Tailwind-compatible syntax
- **Stacks uses Headwind config** — `config/ui.ts` defines Headwind options which feed Crosswind
- **Output goes to `storage/framework/assets/headwind.css`** — not a typical `dist/` directory
- **Bun plugin available** — can be used as a Bun build plugin for automatic CSS generation
- **Attributify mode** — optional mode where utilities can be written as HTML attributes instead of classes
- **Bracket syntax** — `text-[#custom]` for arbitrary values, same as Tailwind JIT
- **Custom rules** — defined as `[RegExp, (match) => Record<string, string>]` tuples
- **Presets** — extensible via presets for shared configurations
