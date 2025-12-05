<script lang="ts" setup>
import { computed } from 'vue'

interface Props {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success'
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  disabled?: boolean
  loading?: boolean
  fullWidth?: boolean
  iconOnly?: boolean
  as?: 'button' | 'a' | 'router-link'
  href?: string
  to?: string
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'primary',
  size: 'md',
  disabled: false,
  loading: false,
  fullWidth: false,
  iconOnly: false,
  as: 'button',
})

const emit = defineEmits<{
  (e: 'click', event: MouseEvent): void
}>()

const baseClasses = computed(() => [
  // Base styles
  'inline-flex items-center justify-center',
  'font-medium',
  'transition-all duration-150 ease-out',
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
  'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none',
  // Full width
  props.fullWidth ? 'w-full' : '',
])

const variantClasses = computed(() => {
  const variants = {
    primary: [
      'bg-blue-600 text-white',
      'hover:bg-blue-700',
      'active:bg-blue-800',
      'focus-visible:ring-blue-500',
      'dark:bg-blue-500 dark:hover:bg-blue-600 dark:active:bg-blue-700',
    ],
    secondary: [
      'bg-neutral-100 text-neutral-900',
      'hover:bg-neutral-200',
      'active:bg-neutral-300',
      'focus-visible:ring-neutral-500',
      'dark:bg-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-600 dark:active:bg-neutral-500',
    ],
    outline: [
      'bg-transparent text-neutral-700 border border-neutral-300',
      'hover:bg-neutral-50 hover:border-neutral-400',
      'active:bg-neutral-100',
      'focus-visible:ring-neutral-500',
      'dark:text-neutral-200 dark:border-neutral-600 dark:hover:bg-neutral-800 dark:hover:border-neutral-500',
    ],
    ghost: [
      'bg-transparent text-neutral-600',
      'hover:bg-neutral-100 hover:text-neutral-900',
      'active:bg-neutral-200',
      'focus-visible:ring-neutral-500',
      'dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-neutral-100',
    ],
    danger: [
      'bg-red-600 text-white',
      'hover:bg-red-700',
      'active:bg-red-800',
      'focus-visible:ring-red-500',
      'dark:bg-red-500 dark:hover:bg-red-600',
    ],
    success: [
      'bg-green-600 text-white',
      'hover:bg-green-700',
      'active:bg-green-800',
      'focus-visible:ring-green-500',
      'dark:bg-green-500 dark:hover:bg-green-600',
    ],
  }
  return variants[props.variant]
})

const sizeClasses = computed(() => {
  if (props.iconOnly) {
    const iconSizes = {
      xs: 'h-6 w-6',
      sm: 'h-8 w-8',
      md: 'h-10 w-10',
      lg: 'h-12 w-12',
      xl: 'h-14 w-14',
    }
    return [iconSizes[props.size], 'rounded-lg']
  }

  const sizes = {
    xs: ['text-xs', 'px-2 py-1', 'rounded-md', 'gap-1'],
    sm: ['text-sm', 'px-3 py-1.5', 'rounded-lg', 'gap-1.5'],
    md: ['text-sm', 'px-4 py-2', 'rounded-lg', 'gap-2'],
    lg: ['text-base', 'px-5 py-2.5', 'rounded-lg', 'gap-2'],
    xl: ['text-base', 'px-6 py-3', 'rounded-xl', 'gap-2.5'],
  }
  return sizes[props.size]
})

const classes = computed(() => [
  ...baseClasses.value,
  ...variantClasses.value,
  ...sizeClasses.value,
])

const isDisabled = computed(() => props.disabled || props.loading)

function handleClick(event: MouseEvent) {
  if (!isDisabled.value) {
    emit('click', event)
  }
}
</script>

<template>
  <component
    :is="as === 'router-link' ? 'RouterLink' : as"
    :class="classes"
    :disabled="isDisabled"
    :href="as === 'a' ? href : undefined"
    :to="as === 'router-link' ? to : undefined"
    @click="handleClick"
  >
    <!-- Loading spinner -->
    <svg
      v-if="loading"
      class="animate-spin -ml-1 mr-2 h-4 w-4"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        class="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        stroke-width="4"
      />
      <path
        class="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>

    <!-- Leading icon slot -->
    <slot name="icon-left" />

    <!-- Default content slot -->
    <slot />

    <!-- Trailing icon slot -->
    <slot name="icon-right" />
  </component>
</template>
