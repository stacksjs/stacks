<script lang="ts" setup>
/**
 * Button Component - macOS Style
 * A modern button inspired by macOS design patterns.
 */
import { computed } from 'vue'

interface Props {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success'
  size?: 'xs' | 'sm' | 'md' | 'lg'
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
  // Base styles - macOS inspired
  'inline-flex items-center justify-center',
  'font-medium tracking-tight',
  'transition-all duration-150',
  'select-none',
  // Focus ring - macOS blue glow
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 focus-visible:ring-offset-0',
  // Disabled state
  'disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none',
  // Active press effect
  'active:scale-[0.98]',
  // Full width
  props.fullWidth ? 'w-full' : '',
])

const variantClasses = computed(() => {
  const variants = {
    primary: [
      // macOS blue button with gradient
      'bg-gradient-to-b from-blue-500 to-blue-600 text-white',
      'shadow-sm shadow-blue-600/25',
      'hover:from-blue-400 hover:to-blue-500',
      'active:from-blue-600 active:to-blue-700',
      'dark:from-blue-600 dark:to-blue-700 dark:hover:from-blue-500 dark:hover:to-blue-600',
    ],
    secondary: [
      // macOS secondary button
      'bg-white/80 dark:bg-white/10 text-neutral-800 dark:text-neutral-100',
      'border border-black/10 dark:border-white/10',
      'shadow-sm',
      'hover:bg-white dark:hover:bg-white/15',
      'active:bg-neutral-100 dark:active:bg-white/5',
    ],
    outline: [
      // macOS outline style
      'bg-transparent text-neutral-700 dark:text-neutral-200',
      'border border-black/15 dark:border-white/15',
      'hover:bg-black/5 dark:hover:bg-white/8',
      'active:bg-black/10 dark:active:bg-white/10',
    ],
    ghost: [
      // macOS ghost/toolbar button
      'bg-transparent text-neutral-600 dark:text-neutral-300',
      'hover:bg-black/5 dark:hover:bg-white/8',
      'active:bg-black/10 dark:active:bg-white/12',
    ],
    danger: [
      // macOS red button
      'bg-gradient-to-b from-red-500 to-red-600 text-white',
      'shadow-sm shadow-red-600/25',
      'hover:from-red-400 hover:to-red-500',
      'active:from-red-600 active:to-red-700',
    ],
    success: [
      // macOS green button
      'bg-gradient-to-b from-green-500 to-green-600 text-white',
      'shadow-sm shadow-green-600/25',
      'hover:from-green-400 hover:to-green-500',
      'active:from-green-600 active:to-green-700',
    ],
  }
  return variants[props.variant]
})

const sizeClasses = computed(() => {
  if (props.iconOnly) {
    // Icon-only buttons (square)
    const iconSizes = {
      xs: 'h-6 w-6 rounded-md',
      sm: 'h-7 w-7 rounded-md',
      md: 'h-8 w-8 rounded-lg',
      lg: 'h-9 w-9 rounded-lg',
    }
    return [iconSizes[props.size]]
  }

  // macOS-style compact sizing
  const sizes = {
    xs: ['text-[11px]', 'px-2 py-1', 'rounded-md', 'gap-1', 'h-6'],
    sm: ['text-[12px]', 'px-2.5 py-1', 'rounded-md', 'gap-1.5', 'h-7'],
    md: ['text-[13px]', 'px-3 py-1.5', 'rounded-lg', 'gap-1.5', 'h-8'],
    lg: ['text-[14px]', 'px-4 py-2', 'rounded-lg', 'gap-2', 'h-9'],
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
      class="animate-spin h-3.5 w-3.5"
      :class="{ '-ml-0.5 mr-1.5': !iconOnly }"
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
    <slot name="iconLeft" />

    <!-- Default content slot -->
    <slot />

    <!-- Trailing icon slot -->
    <slot name="iconRight" />
  </component>
</template>
