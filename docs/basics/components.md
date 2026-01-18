# Components

Stacks provides a powerful component system for building reusable UI elements. Components in Stacks use a Vue-like syntax with TypeScript support, compiled through the Stacks templating engine.

## Overview

The component system helps you:

- **Build reusable UI** - Create modular, composable interfaces
- **Maintain consistency** - Shared components ensure UI uniformity
- **Type-safe props** - Full TypeScript support for component APIs
- **Scoped styles** - CSS isolated to components

## Quick Start

### Creating a Component

Components live in `resources/components/`:

```html
<!-- resources/components/Button.stx -->
<script setup lang="ts">
interface Props {
  variant?: 'primary' | 'secondary' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'primary',
  size: 'md',
  disabled: false,
})

const emit = defineEmits<{
  click: [event: MouseEvent]
}>()
</script>

<template>
  <button
    :class="['btn', `btn-${props.variant}`, `btn-${props.size}`]"
    :disabled="props.disabled"
    @click="emit('click', $event)"
  >
    <slot />
  </button>
</template>

<style scoped>
.btn {
  border-radius: 0.375rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn-secondary {
  background: #6b7280;
  color: white;
}

.btn-danger {
  background: #ef4444;
  color: white;
}

.btn-sm { padding: 0.25rem 0.5rem; font-size: 0.875rem; }
.btn-md { padding: 0.5rem 1rem; font-size: 1rem; }
.btn-lg { padding: 0.75rem 1.5rem; font-size: 1.125rem; }

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
```

### Using Components

```html
<!-- resources/views/pages/index.stx -->
<template>
  <div class="container">
    <Button variant="primary" @click="handleClick">
      Click Me
    </Button>

    <Button variant="secondary" size="sm">
      Small Button
    </Button>

    <Button variant="danger" :disabled="isLoading">
      Delete
    </Button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const isLoading = ref(false)

function handleClick(event: MouseEvent) {
  console.log('Button clicked!', event)
}
</script>
```

## Component Props

### Defining Props

```html
<script setup lang="ts">
// Simple props
const props = defineProps<{
  title: string
  count: number
  active: boolean
}>()

// With defaults
interface Props {
  title: string
  count?: number
  active?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  count: 0,
  active: false,
})
</script>
```

### Complex Props

```html
<script setup lang="ts">
interface User {
  id: number
  name: string
  email: string
  avatar?: string
}

interface Props {
  user: User
  permissions: string[]
  config: Record<string, unknown>
}

const props = defineProps<Props>()
</script>

<template>
  <div class="user-card">
    <img :src="props.user.avatar ?? '/default-avatar.png'" />
    <h3>{{ props.user.name }}</h3>
    <p>{{ props.user.email }}</p>
  </div>
</template>
```

### Prop Validation

```html
<script setup lang="ts">
const props = defineProps({
  // Required string
  title: {
    type: String,
    required: true,
  },
  // Number with default
  count: {
    type: Number,
    default: 0,
  },
  // Enum-like validation
  status: {
    type: String,
    validator: (value: string) => {
      return ['pending', 'active', 'completed'].includes(value)
    },
  },
})
</script>
```

## Component Events

### Emitting Events

```html
<script setup lang="ts">
// Define emitted events with types
const emit = defineEmits<{
  'update:modelValue': [value: string]
  'submit': [data: FormData]
  'cancel': []
}>()

function handleSubmit() {
  const formData = new FormData()
  emit('submit', formData)
}

function handleCancel() {
  emit('cancel')
}
</script>

<template>
  <form @submit.prevent="handleSubmit">
    <input
      :value="modelValue"
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    />
    <button type="submit">Submit</button>
    <button type="button" @click="handleCancel">Cancel</button>
  </form>
</template>
```

### v-model Support

```html
<!-- Input.stx -->
<script setup lang="ts">
const props = defineProps<{
  modelValue: string
  placeholder?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()
</script>

<template>
  <input
    :value="props.modelValue"
    :placeholder="props.placeholder"
    @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
  />
</template>

<!-- Usage -->
<template>
  <Input v-model="searchQuery" placeholder="Search..." />
</template>
```

## Slots

### Default Slot

```html
<!-- Card.stx -->
<template>
  <div class="card">
    <slot />
  </div>
</template>

<!-- Usage -->
<Card>
  <h2>Card Title</h2>
  <p>Card content goes here.</p>
</Card>
```

### Named Slots

```html
<!-- Modal.stx -->
<template>
  <div class="modal">
    <header class="modal-header">
      <slot name="header">
        Default Header
      </slot>
    </header>

    <main class="modal-body">
      <slot />
    </main>

    <footer class="modal-footer">
      <slot name="footer">
        <button @click="$emit('close')">Close</button>
      </slot>
    </footer>
  </div>
</template>

<!-- Usage -->
<Modal @close="handleClose">
  <template #header>
    <h2>Custom Header</h2>
  </template>

  <p>Modal content here.</p>

  <template #footer>
    <Button @click="save">Save</Button>
    <Button variant="secondary" @click="cancel">Cancel</Button>
  </template>
</Modal>
```

### Scoped Slots

```html
<!-- DataList.stx -->
<script setup lang="ts">
interface Props {
  items: any[]
}

const props = defineProps<Props>()
</script>

<template>
  <ul class="data-list">
    <li v-for="(item, index) in props.items" :key="index">
      <slot :item="item" :index="index">
        {{ item }}
      </slot>
    </li>
  </ul>
</template>

<!-- Usage -->
<DataList :items="users">
  <template #default="{ item: user, index }">
    <span>{{ index + 1 }}. {{ user.name }} ({{ user.email }})</span>
  </template>
</DataList>
```

## Composition

### Using Composables

```html
<script setup lang="ts">
import { useAuth } from '@/composables/useAuth'
import { useFetch } from '@/composables/useFetch'

const { user, isAuthenticated, logout } = useAuth()
const { data: posts, loading, error, refresh } = useFetch('/api/posts')
</script>

<template>
  <div v-if="isAuthenticated">
    <p>Welcome, {{ user.name }}</p>
    <button @click="logout">Logout</button>

    <div v-if="loading">Loading posts...</div>
    <div v-else-if="error">Error: {{ error.message }}</div>
    <ul v-else>
      <li v-for="post in posts" :key="post.id">
        {{ post.title }}
      </li>
    </ul>
  </div>
</template>
```

### Creating Composables

```typescript
// composables/useCounter.ts
import { computed, ref } from 'vue'

export function useCounter(initial = 0) {
  const count = ref(initial)

  const doubled = computed(() => count.value * 2)

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
    doubled,
    increment,
    decrement,
    reset,
  }
}
```

## Component Patterns

### Container/Presenter Pattern

```html
<!-- UserListContainer.stx (Smart Component) -->
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import UserList from './UserList.stx'

const users = ref([])
const loading = ref(true)

onMounted(async () => {
  users.value = await fetchUsers()
  loading.value = false
})
</script>

<template>
  <UserList :users="users" :loading="loading" />
</template>

<!-- UserList.stx (Presentational Component) -->
<script setup lang="ts">
interface User {
  id: number
  name: string
}

defineProps<{
  users: User[]
  loading: boolean
}>()
</script>

<template>
  <div v-if="loading">Loading...</div>
  <ul v-else>
    <li v-for="user in users" :key="user.id">
      {{ user.name }}
    </li>
  </ul>
</template>
```

### Compound Components

```html
<!-- Tabs.stx -->
<script setup lang="ts">
import { provide, ref } from 'vue'

const activeTab = ref(0)

provide('tabs', {
  activeTab,
  setActiveTab: (index: number) => {
    activeTab.value = index
  },
})
</script>

<template>
  <div class="tabs">
    <slot />
  </div>
</template>

<!-- TabList.stx -->
<template>
  <div class="tab-list" role="tablist">
    <slot />
  </div>
</template>

<!-- Tab.stx -->
<script setup lang="ts">
import { inject } from 'vue'

const props = defineProps<{ index: number }>()
const { activeTab, setActiveTab } = inject('tabs')
</script>

<template>
  <button
    :class="['tab', { active: activeTab === props.index }]"
    @click="setActiveTab(props.index)"
  >
    <slot />
  </button>
</template>

<!-- TabPanels.stx -->
<script setup lang="ts">
import { inject } from 'vue'
const { activeTab } = inject('tabs')
</script>

<template>
  <div class="tab-panels">
    <slot :activeTab="activeTab" />
  </div>
</template>

<!-- Usage -->
<Tabs>
  <TabList>
    <Tab :index="0">Profile</Tab>
    <Tab :index="1">Settings</Tab>
    <Tab :index="2">Notifications</Tab>
  </TabList>

  <TabPanels v-slot="{ activeTab }">
    <div v-show="activeTab === 0">Profile content</div>
    <div v-show="activeTab === 1">Settings content</div>
    <div v-show="activeTab === 2">Notifications content</div>
  </TabPanels>
</Tabs>
```

## Styling Components

### Scoped Styles

```html
<template>
  <div class="card">
    <h2 class="title">{{ title }}</h2>
  </div>
</template>

<style scoped>
/* Only applies to this component */
.card {
  padding: 1rem;
  border-radius: 0.5rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.title {
  font-size: 1.25rem;
  margin-bottom: 0.5rem;
}
</style>
```

### CSS Variables

```html
<style scoped>
.btn {
  --btn-bg: var(--color-primary, #3b82f6);
  --btn-color: var(--color-white, #ffffff);

  background: var(--btn-bg);
  color: var(--btn-color);
}

.btn-secondary {
  --btn-bg: var(--color-gray-500, #6b7280);
}
</style>
```

### Dynamic Classes

```html
<template>
  <div
    :class="[
      'alert',
      `alert-${type}`,
      { 'alert-dismissible': dismissible }
    ]"
  >
    <slot />
  </div>
</template>
```

## Best Practices

### DO

- **Keep components focused** - One responsibility per component
- **Use TypeScript** - Type props and emits for safety
- **Document props** - Use JSDoc comments for complex props
- **Use slots wisely** - Provide flexibility without complexity
- **Scope styles** - Prevent CSS leaks

### DON'T

- **Don't mutate props** - Use events to communicate changes
- **Don't over-abstract** - Start simple, extract when needed
- **Don't deeply nest** - Flatten component hierarchies
- **Don't use `any`** - Proper types catch bugs early

## Related Documentation

- **[Views](/basics/views)** - Page templates
- **[Functions](/basics/functions)** - Server-side logic
- **[Styling](/guide/styling)** - CSS and styling guide
- **[State Management](/guide/state)** - Managing component state
