---
title: Getting Started with Libraries
description: "This guide walks you through creating, developing, and publishing your first Stacks library."
---
# Getting Started with Libraries

This guide walks you through creating, developing, and publishing your first Stacks library.

## Prerequisites

Before creating a library, ensure you have:

- [Bun](https://bun.sh) v1.0 or higher
- A Stacks project (or start fresh with a library)

## Creating a Library

### Option 1: New Library Project

Create a dedicated library project:

```bash
panx @stacksjs/buddy new my-library

cd my-library
bun install
```

### Option 2: Add to Existing Project

Add library support to your existing Stacks project. There is no dedicated
scaffolding command for this; create the library structure shown below and
scaffold the individual pieces as needed:

```bash
buddy make:component MyComponent
buddy make:function my-function
```

## Project Structure

After setup, your library structure looks like this:

```
my-library/
├── components/           # STX components
│   └── .gitkeep
├── functions/            # TypeScript functions
│   └── .gitkeep
├── docs/                 # Documentation site
│   └── index.md
├── tests/                # Test files
│   └── .gitkeep
├── library.config.ts     # Library configuration
├── package.json          # Package metadata
├── tsconfig.json         # TypeScript config
└── README.md
```

## Your First Component

Create a simple button component:

```html
<!-- components/Button.stx -->
<template>
  <button
    :class="['stacks-button', `stacks-button--${variant}`]"
    :disabled="disabled"
    @click="emit('click', $event)"
  >
    <slot />
  </button>
</template>

<script>
export interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'outline'
  disabled?: boolean
}

const props = withDefaults(defineProps<ButtonProps>(), {
  variant: 'primary',
  disabled: false,
})

const emit = defineEmits<{
  click: [event: MouseEvent]
}>()
</script>

<style scoped>
.stacks-button {
  padding: 0.5rem 1rem;
  border-radius: 0.25rem;
  border: none;
  cursor: pointer;
  font-size: 1rem;
  transition: all 0.2s;
}

.stacks-button--primary {
  background-color: #3b82f6;
  color: white;
}

.stacks-button--primary:hover {
  background-color: #2563eb;
}

.stacks-button--secondary {
  background-color: #6b7280;
  color: white;
}

.stacks-button--outline {
  background-color: transparent;
  border: 2px solid #3b82f6;
  color: #3b82f6;
}

.stacks-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
```

## Your First Function

Create a utility function:

```typescript
// functions/useToggle.ts
import { ref, type Ref } from '@stacksjs/stx'

export interface UseToggleReturn {
  value: Ref<boolean>
  toggle: () => void
  setTrue: () => void
  setFalse: () => void
}

export function useToggle(initial = false): UseToggleReturn {
  const value = ref(initial)

  function toggle() {
    value.value = !value.value
  }

  function setTrue() {
    value.value = true
  }

  function setFalse() {
    value.value = false
  }

  return {
    value,
    toggle,
    setTrue,
    setFalse,
  }
}
```

## Export Your Library

Create the main entry point:

```typescript
// index.ts

// Export components
export { default as Button } from './components/Button.stx'

// Export functions
export { useToggle } from './functions/useToggle'

// Export types
export type { ButtonProps } from './components/Button.stx'
export type { UseToggleReturn } from './functions/useToggle'
```

## Development

### Start Dev Server

Preview your components in isolation:

```bash
buddy dev:components
```

This opens a development environment at `<http://localhost:3333>` where you can:

- View all components
- Test different props
- See documentation

### Watch Mode

The library build commands have no `--watch` flag today; re-run the builds as you develop:

```bash
buddy build:components
buddy build:functions
```

## Testing

### Write Tests

```typescript
// tests/Button.test.ts
import { describe, it, expect } from 'bun:test'
import { mount } from '@stacksjs/stx/testing'
import Button from '../components/Button.stx'

describe('Button', () => {
  it('renders with default props', () => {
    const wrapper = mount(Button, {
      slots: { default: 'Click me' },
    })

    expect(wrapper.text()).toBe('Click me')
    expect(wrapper.classes()).toContain('stacks-button--primary')
  })

  it('applies variant class', () => {
    const wrapper = mount(Button, {
      props: { variant: 'secondary' },
    })

    expect(wrapper.classes()).toContain('stacks-button--secondary')
  })

  it('emits click event', async () => {
    const wrapper = mount(Button)

    await wrapper.trigger('click')

    expect(wrapper.emitted('click')).toHaveLength(1)
  })

  it('can be disabled', () => {
    const wrapper = mount(Button, {
      props: { disabled: true },
    })

    expect(wrapper.attributes('disabled')).toBeDefined()
  })
})
```

### Run Tests

```bash
# Run all tests
bun test

# Run with coverage
bun test --coverage

# Watch mode
bun test --watch
```

## Building

### Production Build

```bash
buddy build:components
buddy build:functions
```

This generates:

```
dist/
├── index.mjs         # ESM bundle
├── index.cjs         # CommonJS bundle
├── index.d.ts        # TypeScript declarations
├── components/
│   ├── Button.stx.mjs
│   └── Button.stx.d.ts
└── functions/
    ├── useToggle.mjs
    └── useToggle.d.ts
```

## Configuration

### Library Config

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

  // Build options
  build: {
    formats: ['esm', 'cjs'],
    minify: true,
    sourcemap: true,
  },

  // External dependencies (not bundled)
  external: ['@stacksjs/stx'],

  // Documentation
  docs: {
    enabled: true,
    title: 'My Library',
  },
})
```

### Package.json

```json
{
  "name": "my-library",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.mjs",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.mjs",
      "require": "./dist/index.cjs",
      "types": "./dist/index.d.ts"
    }
  },
  "files": ["dist"],
  "peerDependencies": {
    "@stacksjs/stx": "^3.0.0"
  }
}
```

## Documentation

### Generate Docs

```bash
buddy build:docs   # generate the documentation site
buddy dev:docs     # serve it locally while you write
```

### Component Docs

Add documentation directly in components:

```html
<docs>
# Button

A customizable button component.

## Basic Usage

```html

<Button>Click me</Button>

```

## Variants

```html

<Button variant="primary">Primary</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="outline">Outline</Button>

```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| variant | string | 'primary' | Button style |
| disabled | boolean | false | Disable button |

</docs>

<template>
  <!-- ... -->
</template>
```

## Publishing

### Prepare for Publish

```bash
# Run all checks
buddy prepublish
```

### Publish to npm

```bash
# Login to npm
npm login

# Publish
buddy publish

# Or with npm directly
npm publish
```

## Next Steps

- [Components Guide](/guide/libraries/components) - Component best practices
- [Functions Guide](/guide/libraries/functions) - Function library patterns
- [Composability](/guide/libraries/composability) - Creating composable libraries
- [Publishing](/guide/libraries/publish) - Publishing workflow
