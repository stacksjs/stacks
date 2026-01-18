# Component Libraries

Build reusable Vue component libraries that work across projects with Stacks.

## Component Architecture

### File Structure

Organize components by feature or complexity:

```
components/
├── Button/
│   ├── Button.vue           # Main component
│   ├── Button.test.ts       # Tests
│   └── index.ts             # Export
├── Modal/
│   ├── Modal.vue
│   ├── ModalHeader.vue
│   ├── ModalBody.vue
│   ├── ModalFooter.vue
│   └── index.ts
├── Form/
│   ├── Input.vue
│   ├── Select.vue
│   ├── Checkbox.vue
│   └── index.ts
└── index.ts                  # Main export
```

### Single File Components

Use Vue SFCs with TypeScript:

```vue
<!-- components/Card/Card.vue -->
<template>
  <div :class="cardClasses">
    <header v-if="$slots.header || title" class="card-header">
      <slot name="header">
        <h3 class="card-title">{{ title }}</h3>
      </slot>
    </header>

    <div class="card-body">
      <slot />
    </div>

    <footer v-if="$slots.footer" class="card-footer">
      <slot name="footer" />
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

export interface CardProps {
  title?: string
  variant?: 'default' | 'outlined' | 'elevated'
  padding?: 'none' | 'sm' | 'md' | 'lg'
}

const props = withDefaults(defineProps<CardProps>(), {
  variant: 'default',
  padding: 'md',
})

const cardClasses = computed(() => [
  'card',
  `card--${props.variant}`,
  `card--padding-${props.padding}`,
])
</script>

<style scoped>
.card {
  border-radius: 0.5rem;
  background: white;
}

.card--default {
  border: 1px solid #e5e7eb;
}

.card--outlined {
  border: 2px solid #3b82f6;
}

.card--elevated {
  box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
}

.card--padding-none .card-body { padding: 0; }
.card--padding-sm .card-body { padding: 0.5rem; }
.card--padding-md .card-body { padding: 1rem; }
.card--padding-lg .card-body { padding: 1.5rem; }

.card-header {
  padding: 1rem;
  border-bottom: 1px solid #e5e7eb;
}

.card-title {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
}

.card-footer {
  padding: 1rem;
  border-top: 1px solid #e5e7eb;
}
</style>
```

## Props Design

### Type-Safe Props

Always define prop types:

```typescript
// Types can be exported for consumers
export interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  loading?: boolean
  fullWidth?: boolean
}

const props = withDefaults(defineProps<ButtonProps>(), {
  variant: 'primary',
  size: 'md',
  disabled: false,
  loading: false,
  fullWidth: false,
})
```

### Prop Validation

Add runtime validation for complex props:

```vue
<script setup lang="ts">
import { computed, warn } from 'vue'

export interface InputProps {
  type?: 'text' | 'email' | 'password' | 'number' | 'tel'
  modelValue?: string | number
  min?: number
  max?: number
}

const props = withDefaults(defineProps<InputProps>(), {
  type: 'text',
})

// Validate props
if (props.type === 'number') {
  if (props.min !== undefined && props.max !== undefined && props.min > props.max) {
    warn('Input: min cannot be greater than max')
  }
}
</script>
```

## Events

### Typed Events

Define event types explicitly:

```vue
<script setup lang="ts">
const emit = defineEmits<{
  click: [event: MouseEvent]
  change: [value: string]
  submit: [data: FormData]
  'update:modelValue': [value: string]
}>()

function handleClick(event: MouseEvent) {
  if (!props.disabled) {
    emit('click', event)
  }
}
</script>
```

### v-model Support

Support two-way binding:

```vue
<!-- components/Input.vue -->
<template>
  <input
    :value="modelValue"
    :type="type"
    :placeholder="placeholder"
    @input="handleInput"
    @focus="emit('focus', $event)"
    @blur="emit('blur', $event)"
  />
</template>

<script setup lang="ts">
export interface InputProps {
  modelValue?: string
  type?: string
  placeholder?: string
}

const props = withDefaults(defineProps<InputProps>(), {
  modelValue: '',
  type: 'text',
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  focus: [event: FocusEvent]
  blur: [event: FocusEvent]
}>()

function handleInput(event: Event) {
  const target = event.target as HTMLInputElement
  emit('update:modelValue', target.value)
}
</script>
```

## Slots

### Named Slots

Provide flexibility with slots:

```vue
<!-- components/Modal.vue -->
<template>
  <Teleport to="body">
    <div v-if="modelValue" class="modal-overlay" @click.self="close">
      <div class="modal" :class="`modal--${size}`">
        <header class="modal-header">
          <slot name="header">
            <h2>{{ title }}</h2>
          </slot>
          <button v-if="closable" class="modal-close" @click="close">
            &times;
          </button>
        </header>

        <div class="modal-body">
          <slot />
        </div>

        <footer v-if="$slots.footer" class="modal-footer">
          <slot name="footer" :close="close" />
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
export interface ModalProps {
  modelValue: boolean
  title?: string
  size?: 'sm' | 'md' | 'lg' | 'full'
  closable?: boolean
}

const props = withDefaults(defineProps<ModalProps>(), {
  size: 'md',
  closable: true,
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

function close() {
  emit('update:modelValue', false)
}
</script>
```

### Scoped Slots

Pass data to slot content:

```vue
<!-- components/DataTable.vue -->
<template>
  <table class="data-table">
    <thead>
      <tr>
        <th v-for="column in columns" :key="column.key">
          <slot :name="`header-${column.key}`" :column="column">
            {{ column.label }}
          </slot>
        </th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="(row, index) in data" :key="row.id || index">
        <td v-for="column in columns" :key="column.key">
          <slot :name="`cell-${column.key}`" :row="row" :value="row[column.key]">
            {{ row[column.key] }}
          </slot>
        </td>
      </tr>
    </tbody>
  </table>
</template>

<script setup lang="ts" generic="T extends Record<string, any>">
export interface Column {
  key: string
  label: string
}

export interface DataTableProps<T> {
  columns: Column[]
  data: T[]
}

defineProps<DataTableProps<T>>()
</script>
```

## Composables

### Extracting Logic

Move reusable logic to composables:

```typescript
// composables/useClickOutside.ts
import { onMounted, onUnmounted, type Ref } from 'vue'

export function useClickOutside(
  elementRef: Ref<HTMLElement | null>,
  callback: () => void
) {
  function handler(event: MouseEvent) {
    if (elementRef.value && !elementRef.value.contains(event.target as Node)) {
      callback()
    }
  }

  onMounted(() => {
    document.addEventListener('click', handler)
  })

  onUnmounted(() => {
    document.removeEventListener('click', handler)
  })
}
```

### Using in Components

```vue
<!-- components/Dropdown.vue -->
<template>
  <div ref="dropdownRef" class="dropdown">
    <button @click="toggle">
      <slot name="trigger">Toggle</slot>
    </button>

    <div v-if="isOpen" class="dropdown-menu">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useClickOutside } from '../composables/useClickOutside'

const dropdownRef = ref<HTMLElement | null>(null)
const isOpen = ref(false)

function toggle() {
  isOpen.value = !isOpen.value
}

function close() {
  isOpen.value = false
}

useClickOutside(dropdownRef, close)
</script>
```

## Styling

### CSS Variables

Use CSS custom properties for theming:

```vue
<style>
.button {
  --button-bg: var(--color-primary, #3b82f6);
  --button-color: var(--color-primary-contrast, white);
  --button-radius: var(--radius-md, 0.375rem);
  --button-padding-x: var(--spacing-4, 1rem);
  --button-padding-y: var(--spacing-2, 0.5rem);

  background-color: var(--button-bg);
  color: var(--button-color);
  border-radius: var(--button-radius);
  padding: var(--button-padding-y) var(--button-padding-x);
}
</style>
```

### Tailwind Support

Optionally support Tailwind:

```vue
<template>
  <button
    :class="[
      'inline-flex items-center justify-center rounded-md font-medium',
      'transition-colors focus-visible:outline-none focus-visible:ring-2',
      variantClasses,
      sizeClasses,
    ]"
  >
    <slot />
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  variant?: 'primary' | 'secondary' | 'outline'
  size?: 'sm' | 'md' | 'lg'
}>()

const variantClasses = computed(() => ({
  primary: 'bg-blue-500 text-white hover:bg-blue-600',
  secondary: 'bg-gray-500 text-white hover:bg-gray-600',
  outline: 'border-2 border-blue-500 text-blue-500 hover:bg-blue-50',
})[props.variant || 'primary'])

const sizeClasses = computed(() => ({
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-base',
  lg: 'px-6 py-3 text-lg',
})[props.size || 'md'])
</script>
```

## Accessibility

### ARIA Attributes

Include proper accessibility:

```vue
<!-- components/Alert.vue -->
<template>
  <div
    :class="['alert', `alert--${variant}`]"
    role="alert"
    :aria-live="variant === 'error' ? 'assertive' : 'polite'"
  >
    <span class="alert-icon" aria-hidden="true">
      <slot name="icon">{{ icon }}</slot>
    </span>
    <div class="alert-content">
      <slot />
    </div>
    <button
      v-if="dismissible"
      class="alert-dismiss"
      aria-label="Dismiss alert"
      @click="emit('dismiss')"
    >
      &times;
    </button>
  </div>
</template>
```

### Keyboard Navigation

Support keyboard users:

```vue
<script setup lang="ts">
function handleKeydown(event: KeyboardEvent) {
  switch (event.key) {
    case 'Enter':
    case ' ':
      event.preventDefault()
      toggle()
      break
    case 'Escape':
      close()
      break
    case 'ArrowDown':
      event.preventDefault()
      focusNext()
      break
    case 'ArrowUp':
      event.preventDefault()
      focusPrevious()
      break
  }
}
</script>
```

## Testing Components

### Unit Tests

```typescript
// components/Button/Button.test.ts
import { describe, it, expect } from 'bun:test'
import { mount } from '@vue/test-utils'
import Button from './Button.vue'

describe('Button', () => {
  it('renders slot content', () => {
    const wrapper = mount(Button, {
      slots: { default: 'Click me' },
    })
    expect(wrapper.text()).toBe('Click me')
  })

  it('applies variant class', () => {
    const wrapper = mount(Button, {
      props: { variant: 'danger' },
    })
    expect(wrapper.classes()).toContain('button--danger')
  })

  it('is disabled when prop is set', () => {
    const wrapper = mount(Button, {
      props: { disabled: true },
    })
    expect(wrapper.attributes('disabled')).toBeDefined()
  })

  it('shows loading spinner', () => {
    const wrapper = mount(Button, {
      props: { loading: true },
    })
    expect(wrapper.find('.spinner').exists()).toBe(true)
  })
})
```

## Best Practices

1. **Single responsibility** - Each component does one thing
2. **Consistent API** - Similar components have similar props
3. **Sensible defaults** - Work out of the box
4. **Type everything** - Full TypeScript coverage
5. **Document inline** - Use `<docs>` blocks
6. **Test thoroughly** - Unit tests for all features

## Related

- [Getting Started](/guide/libraries/get-started) - Library setup
- [Functions](/guide/libraries/functions) - Function libraries
- [Publishing](/guide/libraries/publish) - Publishing workflow
