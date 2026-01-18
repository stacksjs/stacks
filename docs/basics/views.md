---
title: Views
description: Learn about STX templating and view rendering in Stacks applications
---

# Views

Stacks uses STX (Stacks Template eXpressions) as its templating engine, providing a powerful, Vue-inspired syntax with Blade-style directives. STX components offer reactive UI with scoped styles and TypeScript support.

## Introduction

STX is a compile-time templating system that combines:
- Vue-like component syntax with `<template>`, `<script>`, and `<style>` blocks
- Blade-inspired directives (`@if`, `@foreach`, `@include`)
- Scoped CSS with automatic class hashing
- TypeScript support with full type inference
- Server-side rendering (SSR) capabilities

Views are stored in `resources/views/` and components in `resources/components/`.

## Basic Templating

### Creating a View

```html
<!-- resources/views/welcome.stx -->
<template>
  <div class="container">
    <h1>{{ title }}</h1>
    <p>Welcome to {{ appName }}!</p>
  </div>
</template>

<script lang="ts">
import { ref } from 'vue'

const title = ref('Hello, World!')
const appName = 'Stacks'
</script>

<style scoped>
.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

h1 {
  color: #333;
  font-size: 2.5rem;
}
</style>
```

### Interpolation

Use double curly braces for data interpolation:

```html
<template>
  <!-- Basic interpolation -->
  <p>{{ message }}</p>

  <!-- Expressions -->
  <p>{{ count + 1 }}</p>
  <p>{{ user.name.toUpperCase() }}</p>
  <p>{{ items.length > 0 ? 'Has items' : 'Empty' }}</p>

  <!-- HTML escaping (safe by default) -->
  <p>{{ userInput }}</p>

  <!-- Raw HTML (use with caution) -->
  <div v-html="rawHtml"></div>
</template>
```

## Blade-Style Directives

### Conditional Rendering

#### @if / @else / @elseif

```html
<template>
  @if(user.isAdmin)
    <AdminDashboard />
  @elseif(user.isModerator)
    <ModeratorDashboard />
  @else
    <UserDashboard />
  @endif

  @if(posts.length > 0)
    <PostList :posts="posts" />
  @else
    <EmptyState message="No posts yet" />
  @endif
</template>
```

#### @unless

```html
<template>
  @unless(user.isGuest)
    <WelcomeBack :user="user" />
  @endunless
</template>
```

#### @isset / @empty

```html
<template>
  @isset(user.profile)
    <ProfileCard :profile="user.profile" />
  @endisset

  @empty(notifications)
    <p>No new notifications</p>
  @endempty
</template>
```

### Loops

#### @foreach

```html
<template>
  <ul>
    @foreach(items as item)
      <li>{{ item.name }}</li>
    @endforeach
  </ul>

  <!-- With index -->
  <ul>
    @foreach(items as item, index)
      <li>{{ index + 1 }}. {{ item.name }}</li>
    @endforeach
  </ul>

  <!-- With key-value pairs -->
  <dl>
    @foreach(user as key, value)
      <dt>{{ key }}</dt>
      <dd>{{ value }}</dd>
    @endforeach
  </dl>
</template>
```

#### @for

```html
<template>
  @for(let i = 0; i < 5; i++)
    <div class="item">Item {{ i + 1 }}</div>
  @endfor
</template>
```

#### @forelse

Handle empty collections gracefully:

```html
<template>
  @forelse(posts as post)
    <PostCard :post="post" />
  @empty
    <EmptyState message="No posts to display" />
  @endforelse
</template>
```

#### @while

```html
<template>
  @while(items.length > 0)
    <div>{{ items.pop() }}</div>
  @endwhile
</template>
```

### Loop Variables

Within loops, special variables are available:

```html
<template>
  @foreach(items as item)
    <div>
      <!-- Check if first iteration -->
      @if($loop.first)
        <span class="badge">First</span>
      @endif

      <!-- Check if last iteration -->
      @if($loop.last)
        <span class="badge">Last</span>
      @endif

      <!-- Current iteration index (0-based) -->
      <span>Index: {{ $loop.index }}</span>

      <!-- Current iteration count (1-based) -->
      <span>Count: {{ $loop.iteration }}</span>

      <!-- Remaining iterations -->
      <span>Remaining: {{ $loop.remaining }}</span>

      <!-- Total count -->
      <span>Total: {{ $loop.count }}</span>

      <!-- Even/Odd -->
      <div :class="{ 'bg-gray': $loop.even }">
        {{ item.name }}
      </div>
    </div>
  @endforeach
</template>
```

### Including Partials

#### @include

```html
<template>
  <div class="page">
    @include('partials/header')

    <main>
      @include('partials/sidebar', { user: currentUser })
      <div class="content">
        {{ content }}
      </div>
    </main>

    @include('partials/footer')
  </div>
</template>
```

#### @includeIf

Include only if the partial exists:

```html
<template>
  @includeIf('partials/optional-banner')
</template>
```

#### @includeWhen

Conditional include:

```html
<template>
  @includeWhen(user.isAdmin, 'partials/admin-tools')
  @includeUnless(user.isGuest, 'partials/user-menu')
</template>
```

#### @includeFirst

Include the first existing partial:

```html
<template>
  @includeFirst(['custom/header', 'default/header'])
</template>
```

### Slots

#### @slot / @endslot

```html
<!-- resources/components/Card.stx -->
<template>
  <div class="card">
    <div class="card-header">
      @slot('header')
        Default Header
      @endslot
    </div>

    <div class="card-body">
      @slot('default')
      @endslot
    </div>

    <div class="card-footer">
      @slot('footer')
      @endslot
    </div>
  </div>
</template>
```

Usage:

```html
<template>
  <Card>
    <template #header>
      <h2>Custom Header</h2>
    </template>

    <p>This is the card content.</p>

    <template #footer>
      <button>Action</button>
    </template>
  </Card>
</template>
```

### Stack and Push

Collect content from child views:

```html
<!-- Layout -->
<template>
  <html>
    <head>
      <title>{{ title }}</title>
      @stack('styles')
    </head>
    <body>
      {{ content }}
      @stack('scripts')
    </body>
  </html>
</template>

<!-- Child View -->
<template>
  @push('styles')
    <link rel="stylesheet" href="/custom.css">
  @endpush

  <div>Content here</div>

  @push('scripts')
    <script src="/custom.js"></script>
  @endpush
</template>
```

### Raw Output

#### @verbatim

Prevent STX from processing content:

```html
<template>
  @verbatim
    <div>
      {{ This will not be processed }}
      @if(this.wont.work)
    </div>
  @endverbatim
</template>
```

### Comments

```html
<template>
  {{-- This comment will not appear in the rendered HTML --}}

  <!-- This HTML comment will appear in output -->
</template>
```

## Component Usage

### Importing Components

```html
<template>
  <div>
    <Header />
    <Sidebar :collapsed="sidebarCollapsed" />
    <MainContent>
      <slot />
    </MainContent>
    <Footer />
  </div>
</template>

<script lang="ts">
import Header from '@/components/Header.stx'
import Sidebar from '@/components/Sidebar.stx'
import MainContent from '@/components/MainContent.stx'
import Footer from '@/components/Footer.stx'

const sidebarCollapsed = ref(false)
</script>
```

### Passing Props

```html
<!-- Parent -->
<template>
  <UserCard
    :user="currentUser"
    :show-avatar="true"
    size="large"
    @click="handleClick"
  />
</template>

<!-- UserCard.stx -->
<template>
  <div class="user-card" :class="sizeClass">
    <img v-if="showAvatar" :src="user.avatar" :alt="user.name">
    <span>{{ user.name }}</span>
  </div>
</template>

<script lang="ts">
interface Props {
  user: User
  showAvatar?: boolean
  size?: 'small' | 'medium' | 'large'
}

const props = withDefaults(defineProps<Props>(), {
  showAvatar: true,
  size: 'medium',
})

const sizeClass = computed(() => `size-${props.size}`)
</script>
```

### Component Slots

```html
<!-- Modal.stx -->
<template>
  <div class="modal" v-if="isOpen">
    <div class="modal-header">
      <slot name="header">
        <h2>Default Title</h2>
      </slot>
    </div>

    <div class="modal-body">
      <slot />
    </div>

    <div class="modal-footer">
      <slot name="footer">
        <button @click="close">Close</button>
      </slot>
    </div>
  </div>
</template>

<script lang="ts">
interface Props {
  isOpen: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  close: []
}>()

function close() {
  emit('close')
}
</script>
```

Usage:

```html
<template>
  <Modal :is-open="showModal" @close="showModal = false">
    <template #header>
      <h2>Confirm Action</h2>
    </template>

    <p>Are you sure you want to proceed?</p>

    <template #footer>
      <button @click="cancel">Cancel</button>
      <button @click="confirm">Confirm</button>
    </template>
  </Modal>
</template>
```

### Scoped Slots

Pass data to slot content:

```html
<!-- DataList.stx -->
<template>
  <ul>
    <li v-for="item in items" :key="item.id">
      <slot :item="item" :index="$index">
        {{ item.name }}
      </slot>
    </li>
  </ul>
</template>

<!-- Usage -->
<template>
  <DataList :items="users">
    <template #default="{ item, index }">
      <span>{{ index + 1 }}. {{ item.name }} ({{ item.email }})</span>
    </template>
  </DataList>
</template>
```

## Scoped Styles

### Basic Scoped Styles

```html
<style scoped>
/* These styles only apply to this component */
.container {
  padding: 1rem;
}

h1 {
  color: blue;
}
</style>
```

### Deep Selectors

Target child component elements:

```html
<style scoped>
/* Target elements inside child components */
:deep(.child-class) {
  color: red;
}

/* Alternative syntax */
.parent :deep(.child-class) {
  color: red;
}
</style>
```

### Slotted Selectors

Style slotted content:

```html
<style scoped>
:slotted(p) {
  color: gray;
}
</style>
```

### Global Styles

Apply styles globally from a component:

```html
<style>
/* Global styles */
body {
  font-family: sans-serif;
}
</style>

<style scoped>
/* Component-scoped styles */
.container {
  max-width: 800px;
}
</style>
```

## TypeScript Integration

### Script Setup

```html
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import type { User } from '@/types'

// Props
interface Props {
  userId: number
  initialName?: string
}

const props = withDefaults(defineProps<Props>(), {
  initialName: 'Guest',
})

// Emits
const emit = defineEmits<{
  update: [name: string]
  delete: []
}>()

// Reactive state
const name = ref(props.initialName)
const loading = ref(false)

// Computed
const displayName = computed(() => name.value.toUpperCase())

// Methods
async function fetchUser() {
  loading.value = true
  try {
    const user = await api.getUser(props.userId)
    name.value = user.name
  } finally {
    loading.value = false
  }
}

// Lifecycle
onMounted(() => {
  fetchUser()
})

// Expose for parent access
defineExpose({
  refresh: fetchUser,
})
</script>
```

### Type-Safe Templates

```html
<template>
  <div>
    <!-- TypeScript provides autocomplete and type checking -->
    <p>{{ user.name }}</p>
    <p>{{ user.email }}</p>

    <!-- Error if property doesn't exist -->
    <!-- <p>{{ user.nonExistent }}</p> -->
  </div>
</template>

<script setup lang="ts">
interface User {
  id: number
  name: string
  email: string
}

const user = ref<User>({
  id: 1,
  name: 'John',
  email: 'john@example.com',
})
</script>
```

## Layouts

### Defining a Layout

```html
<!-- resources/layouts/Default.stx -->
<template>
  <div class="app">
    <Header />
    <nav>
      <slot name="nav" />
    </nav>

    <main>
      <slot />
    </main>

    <Footer />
  </div>
</template>

<script setup lang="ts">
import Header from '@/components/Header.stx'
import Footer from '@/components/Footer.stx'
</script>
```

### Using a Layout

```html
<!-- resources/views/home.stx -->
<template>
  <DefaultLayout>
    <template #nav>
      <a href="/">Home</a>
      <a href="/about">About</a>
    </template>

    <h1>Welcome Home</h1>
    <p>This is the home page content.</p>
  </DefaultLayout>
</template>

<script setup lang="ts">
import DefaultLayout from '@/layouts/Default.stx'
</script>
```

## Edge Cases and Gotchas

### Directive Whitespace

Directives are whitespace-sensitive:

```html
<!-- Correct -->
@if(condition)
  Content
@endif

<!-- Incorrect (no space after @if) -->
@if (condition)
  Content
@endif
```

### Escaping Directive Syntax

Use `@@` to escape directive syntax:

```html
<template>
  <!-- Outputs: @if(condition) -->
  @@if(condition)

  <!-- Outputs: {{ variable }} -->
  @{{ variable }}
</template>
```

### Component Name Casing

Components can be used in PascalCase or kebab-case:

```html
<template>
  <!-- Both are valid -->
  <MyComponent />
  <my-component />
</template>
```

### Reactive Props

Props are readonly; use computed or local refs for mutations:

```html
<script setup lang="ts">
const props = defineProps<{ value: string }>()

// Wrong - props are readonly
// props.value = 'new value'

// Correct - use local ref
const localValue = ref(props.value)
watch(() => props.value, (newVal) => {
  localValue.value = newVal
})
</script>
```

### Async Components

Load components lazily:

```html
<script setup lang="ts">
import { defineAsyncComponent } from 'vue'

const HeavyComponent = defineAsyncComponent(() =>
  import('@/components/HeavyComponent.stx')
)
</script>

<template>
  <Suspense>
    <HeavyComponent />
    <template #fallback>
      <LoadingSpinner />
    </template>
  </Suspense>
</template>
```

## API Reference

### Directives

| Directive | Description |
|-----------|-------------|
| `@if` / `@elseif` / `@else` | Conditional rendering |
| `@unless` | Negative conditional |
| `@isset` / `@empty` | Existence checks |
| `@foreach` / `@for` | Loop iteration |
| `@forelse` | Loop with empty state |
| `@while` | While loop |
| `@include` | Include partial |
| `@slot` | Define slot content |
| `@stack` / `@push` | Stack content |
| `@verbatim` | Raw output |

### Loop Variables

| Variable | Description |
|----------|-------------|
| `$loop.index` | Current index (0-based) |
| `$loop.iteration` | Current iteration (1-based) |
| `$loop.remaining` | Remaining iterations |
| `$loop.count` | Total count |
| `$loop.first` | Is first iteration |
| `$loop.last` | Is last iteration |
| `$loop.even` | Is even iteration |
| `$loop.odd` | Is odd iteration |
| `$loop.depth` | Nesting depth |
| `$loop.parent` | Parent loop |

## Related Documentation

- [Components](/basics/components) - Creating STX components
- [Routing](/basics/routing) - Route to view binding
- [Actions](/basics/actions) - Passing data to views
- [UI Configuration](/config/ui) - UI and styling options
