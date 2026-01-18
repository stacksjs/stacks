# Composability

Design composable libraries that provide maximum flexibility and reusability.

## What is Composability?

Composability is a design principle where small, focused pieces combine to create complex functionality. Instead of monolithic components, you build with primitives that users can compose.

## Composable Components

### The Compound Component Pattern

Break complex components into composable pieces:

```vue
<!-- Instead of one monolithic component -->
<Modal
  title="Confirm"
  body="Are you sure?"
  cancelText="No"
  confirmText="Yes"
  @cancel="handleCancel"
  @confirm="handleConfirm"
/>

<!-- Use composable compound components -->
<Modal v-model="isOpen">
  <ModalHeader>
    <ModalTitle>Confirm</ModalTitle>
    <ModalClose />
  </ModalHeader>
  <ModalBody>
    Are you sure you want to proceed?
  </ModalBody>
  <ModalFooter>
    <Button variant="ghost" @click="handleCancel">No</Button>
    <Button variant="primary" @click="handleConfirm">Yes</Button>
  </ModalFooter>
</Modal>
```

### Implementation

```vue
<!-- components/Modal/Modal.vue -->
<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="modelValue" class="modal-overlay" @click.self="close">
        <div class="modal" role="dialog" aria-modal="true">
          <slot />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { provide, readonly, ref } from 'vue'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const isOpen = ref(props.modelValue)

function close() {
  emit('update:modelValue', false)
}

// Provide context to child components
provide('modal', {
  isOpen: readonly(isOpen),
  close,
})
</script>
```

```vue
<!-- components/Modal/ModalHeader.vue -->
<template>
  <header class="modal-header">
    <slot />
  </header>
</template>

<!-- components/Modal/ModalTitle.vue -->
<template>
  <h2 class="modal-title">
    <slot />
  </h2>
</template>

<!-- components/Modal/ModalClose.vue -->
<template>
  <button class="modal-close" aria-label="Close" @click="modal.close">
    &times;
  </button>
</template>

<script setup lang="ts">
const modal = inject('modal')
</script>
```

## Composable Functions

### Small, Focused Functions

Write functions that do one thing well:

```typescript
// Bad: Monolithic function
function processUser(user: User, options: ProcessOptions) {
  // validate, transform, format, persist - all in one
}

// Good: Composable functions
function validateUser(user: User): ValidationResult { ... }
function transformUser(user: User): TransformedUser { ... }
function formatUserForDisplay(user: User): DisplayUser { ... }
function persistUser(user: User): Promise<User> { ... }

// Compose as needed
const result = pipe(
  validateUser,
  transformUser,
  formatUserForDisplay
)(user)
```

### Function Composition

Create utilities for composition:

```typescript
// functions/compose.ts

/**
 * Compose functions from right to left
 */
export function compose<T>(...fns: Array<(arg: T) => T>): (arg: T) => T {
  return (arg: T) => fns.reduceRight((acc, fn) => fn(acc), arg)
}

/**
 * Pipe functions from left to right
 */
export function pipe<T>(...fns: Array<(arg: T) => T>): (arg: T) => T {
  return (arg: T) => fns.reduce((acc, fn) => fn(acc), arg)
}

/**
 * Async pipe for promise-returning functions
 */
export function pipeAsync<T>(
  ...fns: Array<(arg: T) => T | Promise<T>>
): (arg: T) => Promise<T> {
  return async (arg: T) => {
    let result = arg
    for (const fn of fns) {
      result = await fn(result)
    }
    return result
  }
}
```

### Usage

```typescript
import { pipe, pipeAsync } from 'my-library'

// Sync composition
const processName = pipe(
  trim,
  lowercase,
  capitalize
)

processName('  JOHN DOE  ') // 'John doe'

// Async composition
const processUser = pipeAsync(
  validateUser,
  enrichUserData,
  saveUser
)

await processUser(userData)
```

## Composable Hooks

### Building Block Hooks

Create small hooks that combine:

```typescript
// Primitive hooks
function useBoolean(initial = false) {
  const value = ref(initial)
  const setTrue = () => value.value = true
  const setFalse = () => value.value = false
  const toggle = () => value.value = !value.value
  return { value, setTrue, setFalse, toggle }
}

function useArray<T>(initial: T[] = []) {
  const array = ref(initial) as Ref<T[]>
  const push = (item: T) => array.value.push(item)
  const remove = (index: number) => array.value.splice(index, 1)
  const clear = () => array.value = []
  return { array, push, remove, clear }
}

function useMap<K, V>(initial?: Map<K, V>) {
  const map = ref(new Map(initial)) as Ref<Map<K, V>>
  const set = (key: K, value: V) => map.value.set(key, value)
  const remove = (key: K) => map.value.delete(key)
  return { map, set, remove }
}
```

### Composed Hooks

Build complex hooks from primitives:

```typescript
// Composed from primitives
function useSelection<T>(items: Ref<T[]>) {
  const { value: selectedIndex, set: setIndex } = useNumber(-1)
  const { value: isOpen, setTrue: open, setFalse: close } = useBoolean()

  const selectedItem = computed(() =>
    selectedIndex.value >= 0 ? items.value[selectedIndex.value] : null
  )

  function select(index: number) {
    setIndex(index)
    close()
  }

  function next() {
    setIndex(Math.min(selectedIndex.value + 1, items.value.length - 1))
  }

  function previous() {
    setIndex(Math.max(selectedIndex.value - 1, 0))
  }

  return {
    selectedIndex,
    selectedItem,
    isOpen,
    open,
    close,
    select,
    next,
    previous,
  }
}
```

## Slot-Based Composition

### Renderless Components

Components that provide logic without UI:

```vue
<!-- components/Renderless/MouseTracker.vue -->
<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const x = ref(0)
const y = ref(0)

function update(event: MouseEvent) {
  x.value = event.pageX
  y.value = event.pageY
}

onMounted(() => window.addEventListener('mousemove', update))
onUnmounted(() => window.removeEventListener('mousemove', update))
</script>

<template>
  <slot :x="x" :y="y" />
</template>
```

### Usage

```vue
<template>
  <MouseTracker v-slot="{ x, y }">
    <div class="cursor-indicator" :style="{ left: `${x}px`, top: `${y}px` }">
      {{ x }}, {{ y }}
    </div>
  </MouseTracker>
</template>
```

### Data Provider Pattern

```vue
<!-- components/Renderless/DataProvider.vue -->
<script setup lang="ts" generic="T">
import { ref, onMounted } from 'vue'

const props = defineProps<{
  fetch: () => Promise<T>
}>()

const data = ref<T | null>(null)
const loading = ref(true)
const error = ref<Error | null>(null)

async function load() {
  loading.value = true
  error.value = null
  try {
    data.value = await props.fetch()
  } catch (e) {
    error.value = e instanceof Error ? e : new Error(String(e))
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <slot :data="data" :loading="loading" :error="error" :reload="load" />
</template>
```

## Configuration Objects

### Options Pattern

Allow flexible configuration:

```typescript
interface TableOptions<T> {
  columns: Column<T>[]
  data: T[]
  // Optional with defaults
  sortable?: boolean
  filterable?: boolean
  paginated?: boolean
  pageSize?: number
  // Slots as functions
  renderCell?: (value: any, row: T, column: Column<T>) => VNode
  renderHeader?: (column: Column<T>) => VNode
}

function useTable<T>(options: TableOptions<T>) {
  const {
    columns,
    data,
    sortable = true,
    filterable = false,
    paginated = false,
    pageSize = 10,
  } = options

  // Implementation
}
```

### Builder Pattern

For complex configurations:

```typescript
class QueryBuilder<T> {
  private query: QueryConfig = {}

  where(field: keyof T, op: Operator, value: any): this {
    this.query.where = [...(this.query.where || []), { field, op, value }]
    return this
  }

  orderBy(field: keyof T, direction: 'asc' | 'desc' = 'asc'): this {
    this.query.orderBy = { field, direction }
    return this
  }

  limit(count: number): this {
    this.query.limit = count
    return this
  }

  build(): Query<T> {
    return new Query(this.query)
  }
}

// Usage
const query = new QueryBuilder<User>()
  .where('age', '>', 18)
  .where('status', '=', 'active')
  .orderBy('name')
  .limit(10)
  .build()
```

## Best Practices

### 1. Single Responsibility

Each piece should do one thing:

```typescript
// Good: Single responsibility
function formatDate(date: Date): string { ... }
function parseDate(str: string): Date { ... }
function isValidDate(date: Date): boolean { ... }

// Bad: Mixed responsibilities
function handleDate(input: Date | string, format?: boolean): Date | string { ... }
```

### 2. Consistent Interfaces

Similar functions should have similar signatures:

```typescript
// Good: Consistent pattern
function useLocalStorage<T>(key: string, initial: T): Ref<T>
function useSessionStorage<T>(key: string, initial: T): Ref<T>
function useIndexedDB<T>(key: string, initial: T): Ref<T>

// All return { value, set, remove }
```

### 3. Sensible Defaults

Work out of the box:

```typescript
function useDebounce<T>(
  value: Ref<T>,
  delay = 300  // Sensible default
): Ref<T>
```

### 4. Type Safety

Full TypeScript support:

```typescript
function pick<T, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  const result = {} as Pick<T, K>
  keys.forEach(key => result[key] = obj[key])
  return result
}

// Type-safe usage
const user = { name: 'John', age: 30, email: 'john@example.com' }
const picked = pick(user, ['name', 'email'])
// Type: { name: string; email: string }
```

## Related

- [Components](/guide/libraries/components) - Component patterns
- [Functions](/guide/libraries/functions) - Function libraries
- [Composability Design](/guide/composability) - Design principles
