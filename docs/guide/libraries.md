# Libraries

Stacks enables you to build and publish reusable component and function libraries with zero configuration. Create framework-agnostic packages that work across Vue, React, and vanilla JavaScript.

## Overview

Stacks library features:

- **Auto-bundling** - Optimized builds for npm and CDN
- **Type generation** - Automatic TypeScript declarations
- **Framework agnostic** - Components work everywhere
- **Documentation** - Built-in documentation site
- **Versioning** - Semantic versioning and changelogs

## Quick Start

### Creating a Library

```bash
# Create a new library project
bunx create-stacks my-library --library

# Or add library support to existing project
buddy make:library
```

### Project Structure

```
my-library/
├── components/           # Vue components
│   ├── Button.vue
│   └── Modal.vue
├── functions/            # TypeScript functions
│   ├── useCounter.ts
│   └── formatDate.ts
├── docs/                 # Documentation
├── dist/                 # Build output
│   ├── index.mjs         # ESM bundle
│   ├── index.cjs         # CommonJS bundle
│   ├── index.d.ts        # Type declarations
│   └── components/       # Individual components
└── package.json
```

## Component Libraries

### Creating Components

```vue
<!-- components/Button.vue -->
<template>
  <button
    :class="['btn', `btn-${variant}`, { 'btn-loading': loading }]"
    :disabled="disabled || loading"
    @click="handleClick"
  >
    <slot />
  </button>
</template>

<script setup lang="ts">
export interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'danger'
  loading?: boolean
  disabled?: boolean
}

const props = withDefaults(defineProps<ButtonProps>(), {
  variant: 'primary',
  loading: false,
  disabled: false,
})

const emit = defineEmits<{
  click: [event: MouseEvent]
}>()

function handleClick(event: MouseEvent) {
  if (!props.loading && !props.disabled) {
    emit('click', event)
  }
}
</script>

<style scoped>
.btn {
  padding: 0.5rem 1rem;
  border-radius: 0.25rem;
  cursor: pointer;
}
.btn-primary { background: #3b82f6; color: white; }
.btn-secondary { background: #6b7280; color: white; }
.btn-danger { background: #ef4444; color: white; }
.btn-loading { opacity: 0.7; cursor: wait; }
</style>
```

### Exporting Components

```typescript
// index.ts
export { default as Button } from './components/Button.vue'
export { default as Modal } from './components/Modal.vue'
export { default as Input } from './components/Input.vue'

// Export types
export type { ButtonProps } from './components/Button.vue'
export type { ModalProps } from './components/Modal.vue'
```

## Function Libraries

### Creating Functions

```typescript
// functions/useCounter.ts
import { ref, computed } from 'vue'

export function useCounter(initial = 0) {
  const count = ref(initial)

  const double = computed(() => count.value * 2)

  function increment() {
    count.value++
  }

  function decrement() {
    count.value--
  }

  function reset() {
    count.value = initial
  }

  return {
    count,
    double,
    increment,
    decrement,
    reset,
  }
}
```

```typescript
// functions/formatDate.ts
export interface FormatDateOptions {
  locale?: string
  format?: 'short' | 'medium' | 'long' | 'full'
}

export function formatDate(
  date: Date | string | number,
  options: FormatDateOptions = {}
): string {
  const { locale = 'en-US', format = 'medium' } = options
  const d = new Date(date)

  const formats: Record<string, Intl.DateTimeFormatOptions> = {
    short: { month: 'numeric', day: 'numeric', year: '2-digit' },
    medium: { month: 'short', day: 'numeric', year: 'numeric' },
    long: { month: 'long', day: 'numeric', year: 'numeric' },
    full: { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' },
  }

  return new Intl.DateTimeFormat(locale, formats[format]).format(d)
}
```

### Exporting Functions

```typescript
// functions/index.ts
export { useCounter } from './useCounter'
export { formatDate } from './formatDate'
export type { FormatDateOptions } from './formatDate'
```

## Library Configuration

### Build Configuration

```typescript
// library.config.ts
export default defineLibraryConfig({
  name: 'my-library',

  // Entry points
  entries: {
    '.': './index.ts',
    './components': './components/index.ts',
    './functions': './functions/index.ts',
  },

  // Output formats
  formats: ['esm', 'cjs', 'iife'],

  // External dependencies
  external: ['vue', 'react'],

  // Global name for IIFE
  globalName: 'MyLibrary',

  // Bundle options
  bundle: {
    minify: true,
    sourcemap: true,
    dts: true,
  },
})
```

### Package.json Setup

```json
{
  "name": "my-library",
  "version": "1.0.0",
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.mjs",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.mjs",
      "require": "./dist/index.cjs",
      "types": "./dist/index.d.ts"
    },
    "./components": {
      "import": "./dist/components/index.mjs",
      "require": "./dist/components/index.cjs",
      "types": "./dist/components/index.d.ts"
    },
    "./functions": {
      "import": "./dist/functions/index.mjs",
      "require": "./dist/functions/index.cjs",
      "types": "./dist/functions/index.d.ts"
    }
  },
  "files": ["dist"],
  "sideEffects": false
}
```

## Building Libraries

### Development Build

```bash
# Watch mode for development
buddy build:lib --watch

# Build with type checking
buddy build:lib --typecheck
```

### Production Build

```bash
# Full production build
buddy build:lib

# Build specific entry
buddy build:lib --entry components
```

### Build Output

```
dist/
├── index.mjs           # ESM entry
├── index.cjs           # CommonJS entry
├── index.d.ts          # TypeScript declarations
├── index.iife.js       # Browser global
├── components/
│   ├── index.mjs
│   ├── index.cjs
│   ├── index.d.ts
│   ├── Button.vue.mjs
│   └── Button.vue.d.ts
└── functions/
    ├── index.mjs
    ├── index.cjs
    └── index.d.ts
```

## Documentation

### Auto-Generated Docs

```bash
# Generate documentation site
buddy docs:generate

# Serve documentation locally
buddy docs:dev
```

### Component Documentation

```vue
<!-- components/Button.vue -->
<docs>
# Button

A customizable button component.

## Usage

```vue
<Button variant="primary" @click="handleClick">
  Click me
</Button>
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| variant | string | 'primary' | Button style variant |
| loading | boolean | false | Show loading state |
| disabled | boolean | false | Disable the button |
</docs>

<template>
  <!-- component template -->
</template>
```

## Publishing

### Preparing for Publish

```bash
# Run checks before publishing
buddy prepublish

# This runs:
# - Type checking
# - Linting
# - Tests
# - Build
```

### Publishing to npm

```bash
# Publish to npm
buddy publish

# Publish with specific tag
buddy publish --tag beta

# Dry run
buddy publish --dry-run
```

### Automated Releases

```yaml
# .github/workflows/release.yml
name: Release

on:
  push:
    tags: ['v*']

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bun run build
      - run: npm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

## Versioning

### Semantic Versioning

```bash
# Bump patch version (1.0.0 -> 1.0.1)
buddy version patch

# Bump minor version (1.0.0 -> 1.1.0)
buddy version minor

# Bump major version (1.0.0 -> 2.0.0)
buddy version major

# Pre-release versions
buddy version prerelease --preid beta  # 1.0.0 -> 1.0.1-beta.0
```

### Changelog Generation

```bash
# Generate changelog from commits
buddy changelog

# Changelog is generated from conventional commits:
# feat: -> Features
# fix: -> Bug Fixes
# docs: -> Documentation
# perf: -> Performance
```

## Best Practices

1. **Keep components minimal** - Single responsibility principle
2. **Document props** - Clear prop documentation with types
3. **Provide defaults** - Sensible default prop values
4. **Export types** - Export TypeScript types for consumers
5. **Test thoroughly** - Unit tests for components and functions
6. **Version carefully** - Follow semantic versioning strictly

## Related

- [Components](/basics/components) - Component development guide
- [Functions](/basics/functions) - Function library guide
- [Publishing](/guide/libraries/publish) - Publishing workflow
- [Testing](/guide/testing) - Testing your library
