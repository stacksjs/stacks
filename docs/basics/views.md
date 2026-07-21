---
title: STX View Templates
description: Build server-rendered and reactive interfaces with STX templates in Stacks.
---

# Views

Stacks uses STX for views and components. STX combines server rendering, reactive client code, component composition, and scoped styles in `.stx` files.

Application views live in `resources/views/`. Reusable components, layouts, and partials live in their matching directories under `resources/`.

## Create a view

Create `resources/views/welcome.stx`:

```html
<script server>
const pageTitle = 'Welcome to Stacks'
</script>

<script>
const count = ref(0)
const doubled = computed(() => count.value * 2)

function increment() {
  count.value++
}
</script>

<template>
  <main class="mx-auto px-6 py-16 max-w-3xl">
    <h1 class="font-semibold text-4xl">
      {{ pageTitle }}
    </h1>
    <button class="mt-8 px-4 py-2 text-white bg-blue-600 rounded" @click="increment">
      Count: {{ count }}
    </button>
    <p class="mt-2 text-neutral-600">
      Doubled: {{ doubled }}
    </p>
  </main>
</template>
```

Browser auto-imports make `ref`, `computed`, `watch`, and the supported composables available inside STX scripts. Do not use direct `document` or `window` access. Keep client behavior in signals, composables, directives, and component methods.

## Rendering data

Double braces escape interpolated values:

```html
<p>{{ user.name }}</p>
<p>{{ items.length }} items</p>
```

Use the raw-output form only for trusted HTML:

```html
<div>{!! trustedHtml !!}</div>
```

Server scripts run before the template is rendered and can prepare data for the page:

```html
<script server>
const products = await Product.where('status', 'published').all()
</script>

<template>
  <ul>
    @foreach(products as product)
      <li>{{ product.name }}</li>
    @endforeach
  </ul>
</template>
```

## Conditionals and loops

Use Blade-style directives for server-rendered control flow:

```html
@if(user)
  <p>Welcome back, {{ user.name }}.</p>
@else
  <a href="/login">Sign in</a>
@endif
```

```html
@foreach(posts as post)
  <article>
    <h2>{{ post.title }}</h2>
  </article>
@endforeach
```

Use `@for` and `@while` when an indexed loop or condition is a better fit:

```html
@for(let index = 0; index < featured.length; index++)
  <p>{{ index + 1 }}. {{ featured[index].name }}</p>
@endfor
```

## Components

Components live in `resources/components/` and are auto-resolved by name. A component at `resources/components/UserCard.stx` can be used directly:

```html
<UserCard :user="user" compact />
```

Declare typed props inside the component:

```html
<script>
interface Props {
  user: {
    name: string
    email: string
  }
  compact?: boolean
}

const props = defineProps<Props>()
</script>

<template>
  <article class="p-4 border border-neutral-200 rounded-lg">
    <h2 class="font-semibold">{{ props.user.name }}</h2>
    @unless(props.compact)
      <p class="text-neutral-600">{{ props.user.email }}</p>
    @endunless
  </article>
</template>
```

## Events and state

Bind component methods with event directives:

```html
<script>
const open = ref(false)

function toggle() {
  open.value = !open.value
}
</script>

<template>
  <button @click="toggle">
    {{ open ? 'Hide details' : 'Show details' }}
  </button>

  @if(open)
    <p>Additional details</p>
  @endif
</template>
```

For shared behavior, place a function or composable in `resources/functions/`. Browser auto-import generation makes exported functions available to templates after `buddy generate`.

## Slots

Slots let a component accept caller-provided content:

```html
<!-- resources/components/Card.stx -->
<template>
  <section class="p-6 border border-neutral-200 rounded-xl">
    <header class="mb-4">
      <slot name="header" />
    </header>
    <slot />
  </section>
</template>
```

```html
<Card>
  <template #header>
    <h2>Account</h2>
  </template>

  <p>Manage your profile and security settings.</p>
</Card>
```

## Layouts and partials

Layouts live in `resources/layouts/`. Select one with frontmatter or the layout directive supported by your application configuration. Partials live in `resources/partials/` and can be included from a view:

```html
@include('partials/header')

<main>
  {{ content }}
</main>

@include('partials/footer')
```

Pass values to a partial when it needs local context:

```html
@include('partials/account-menu', { user })
```

## Styling

Use Crosswind utilities in templates. Component styles can be scoped when custom CSS is necessary:

```html
<template>
  <div class="profile-card">
    <slot />
  </div>
</template>

<style scoped>
.profile-card {
  container-type: inline-size;
}
</style>
```

Prefer Crosswind transitions and CSS keyframes for motion. Use `usePreferredReducedMotion()` before enabling non-essential animation.

## Configuration

STX configuration lives in `config/stx.ts`:

```ts
import type { StxOptions } from '@stacksjs/stx'

export default {
  componentsDir: 'resources/components',
  layoutsDir: 'resources/layouts',
  partialsDir: 'resources/partials',
} satisfies StxOptions
```

The `bun-plugin-stx` plugin compiles `.stx` files during development and production builds.

## Commands

```bash
buddy make:view account
buddy make:component UserCard
buddy dev
buddy build
buddy generate
```

Use `buddy make:page` as an alias for `buddy make:view`. Run `buddy generate` after adding browser functions or components that should appear in generated auto-import types.

## Related guides

- [Components](/basics/components)
- [Functions](/basics/functions)
- [Routing](/basics/routing)
- [STX package reference](/packages/stx)
