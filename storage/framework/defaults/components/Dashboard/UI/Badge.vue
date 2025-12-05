<script lang="ts" setup>
/**
 * Badge Component - macOS Style
 * A compact badge inspired by macOS tags and labels.
 */
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
    'inline-flex items-center font-medium tracking-tight',
    'transition-all duration-150',
  ]

  // Size variants - macOS compact sizing
  const sizes = {
    xs: 'text-[10px] px-1.5 py-0.5',
    sm: 'text-[11px] px-2 py-0.5',
    md: 'text-[12px] px-2.5 py-0.5',
    lg: 'text-[13px] px-3 py-1',
  }
  base.push(sizes[props.size])

  // Border radius
  base.push(props.rounded === 'full' ? 'rounded-full' : 'rounded-md')

  // Variant colors - macOS system colors with softer backgrounds
  const solidVariants = {
    default: 'bg-black/[0.06] text-neutral-600 dark:bg-white/10 dark:text-neutral-300',
    primary: 'bg-blue-500/15 text-blue-600 dark:bg-blue-400/20 dark:text-blue-400',
    success: 'bg-green-500/15 text-green-600 dark:bg-green-400/20 dark:text-green-400',
    warning: 'bg-orange-500/15 text-orange-600 dark:bg-orange-400/20 dark:text-orange-400',
    danger: 'bg-red-500/15 text-red-600 dark:bg-red-400/20 dark:text-red-400',
    info: 'bg-cyan-500/15 text-cyan-600 dark:bg-cyan-400/20 dark:text-cyan-400',
  }

  const outlineVariants = {
    default: 'border border-black/15 text-neutral-600 dark:border-white/20 dark:text-neutral-300',
    primary: 'border border-blue-500/40 text-blue-600 dark:border-blue-400/50 dark:text-blue-400',
    success: 'border border-green-500/40 text-green-600 dark:border-green-400/50 dark:text-green-400',
    warning: 'border border-orange-500/40 text-orange-600 dark:border-orange-400/50 dark:text-orange-400',
    danger: 'border border-red-500/40 text-red-600 dark:border-red-400/50 dark:text-red-400',
    info: 'border border-cyan-500/40 text-cyan-600 dark:border-cyan-400/50 dark:text-cyan-400',
  }

  base.push(props.outline ? outlineVariants[props.variant] : solidVariants[props.variant])

  return base
})

const dotClasses = computed(() => {
  // macOS system colors for dots
  const dotColors = {
    default: 'bg-neutral-400 dark:bg-neutral-500',
    primary: 'bg-blue-500 dark:bg-blue-400',
    success: 'bg-green-500 dark:bg-green-400',
    warning: 'bg-orange-500 dark:bg-orange-400',
    danger: 'bg-red-500 dark:bg-red-400',
    info: 'bg-cyan-500 dark:bg-cyan-400',
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
