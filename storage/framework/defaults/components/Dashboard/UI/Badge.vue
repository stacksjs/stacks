<script lang="ts" setup>
import { computed } from 'vue'

interface Props {
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info'
  size?: 'xs' | 'sm' | 'md' | 'lg'
  rounded?: 'default' | 'full'
  outline?: boolean
  dot?: boolean
  removable?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'default',
  size: 'sm',
  rounded: 'full',
  outline: false,
  dot: false,
  removable: false,
})

const emit = defineEmits<{
  (e: 'remove'): void
}>()

const classes = computed(() => {
  const base = [
    'inline-flex items-center font-medium',
    'transition-colors duration-150',
  ]

  // Size variants
  const sizes = {
    xs: 'text-xs px-1.5 py-0.5',
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-0.5',
    lg: 'text-sm px-3 py-1',
  }
  base.push(sizes[props.size])

  // Border radius
  base.push(props.rounded === 'full' ? 'rounded-full' : 'rounded-md')

  // Variant colors
  const solidVariants = {
    default: 'bg-neutral-100 text-neutral-700 dark:bg-neutral-700 dark:text-neutral-200',
    primary: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
    success: 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300',
    warning: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
    danger: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300',
    info: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-300',
  }

  const outlineVariants = {
    default: 'border border-neutral-300 text-neutral-700 dark:border-neutral-600 dark:text-neutral-300',
    primary: 'border border-blue-300 text-blue-700 dark:border-blue-600 dark:text-blue-400',
    success: 'border border-green-300 text-green-700 dark:border-green-600 dark:text-green-400',
    warning: 'border border-amber-300 text-amber-700 dark:border-amber-600 dark:text-amber-400',
    danger: 'border border-red-300 text-red-700 dark:border-red-600 dark:text-red-400',
    info: 'border border-cyan-300 text-cyan-700 dark:border-cyan-600 dark:text-cyan-400',
  }

  base.push(props.outline ? outlineVariants[props.variant] : solidVariants[props.variant])

  return base
})

const dotClasses = computed(() => {
  const dotColors = {
    default: 'bg-neutral-400',
    primary: 'bg-blue-500',
    success: 'bg-green-500',
    warning: 'bg-amber-500',
    danger: 'bg-red-500',
    info: 'bg-cyan-500',
  }

  return [
    'w-1.5 h-1.5 rounded-full mr-1.5',
    dotColors[props.variant],
  ]
})

function handleRemove() {
  emit('remove')
}
</script>

<template>
  <span :class="classes">
    <!-- Status dot -->
    <span v-if="dot" :class="dotClasses" />

    <!-- Leading icon slot -->
    <slot name="icon-left" />

    <!-- Content -->
    <slot />

    <!-- Trailing icon slot -->
    <slot name="icon-right" />

    <!-- Remove button -->
    <button
      v-if="removable"
      type="button"
      class="ml-1 -mr-0.5 h-4 w-4 rounded-full inline-flex items-center justify-center hover:bg-black/10 dark:hover:bg-white/10 focus:outline-none"
      @click.stop="handleRemove"
    >
      <svg class="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
        <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
      </svg>
    </button>
  </span>
</template>
