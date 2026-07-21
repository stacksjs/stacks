---
title: STX Templates
description: "Use the STX rendering, component, reactivity, and testing APIs in Stacks applications."
---

# STX

`@stacksjs/stx` is the rendering and component runtime for Stacks. It compiles `.stx` templates, renders on the server, hydrates reactive client behavior, scopes component styles, and provides the composition APIs used by application views.

## Install

STX is already included in a Stacks application. For a standalone package:

```bash
bun add @stacksjs/stx
```

Load `bun-plugin-stx` when Bun should compile `.stx` imports:

```toml
[serve]
plugins = ["bun-plugin-stx"]
```

## Component API

```html
<script>
const count = ref(0)
const doubled = computed(() => count.value * 2)

function increment() {
  count.value++
}
</script>

<template>
  <button @click="increment">
    {{ count }} / {{ doubled }}
  </button>
</template>
```

Stacks injects the browser auto-import surface into templates. Standalone TypeScript modules can import the same APIs directly:

```ts
import { computed, ref, watch } from '@stacksjs/stx'
```

## Server rendering

Use `<script server>` for data that must be available before HTML is produced:

```html
<script server>
const posts = await Post.where('status', 'published').all()
</script>

<template>
  @foreach(posts as post)
    <article>{{ post.title }}</article>
  @endforeach
</template>
```

## Testing

The testing entrypoint mounts and renders STX components without STX test utilities:

```ts
import { describe, expect, test } from 'bun:test'
import { mount } from '@stacksjs/stx/testing'

describe('Counter', () => {
  test('renders its label', async () => {
    const wrapper = await mount('<Counter />')
    expect(wrapper.text()).toContain('Count')
  })
})
```

## Source and guides

- [Views](/basics/views)
- [Components](/basics/components)
- [STX source](https://github.com/stacksjs/stx)
