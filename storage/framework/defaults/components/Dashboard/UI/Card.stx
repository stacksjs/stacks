<script lang="ts" setup>
/**
 * Card Component - macOS Style
 * A clean card with subtle shadows and vibrancy options.
 */
import { computed } from 'vue'

interface Props {
  variant?: 'default' | 'elevated' | 'outline' | 'ghost' | 'vibrancy'
  padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl'
  rounded?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl'
  hoverable?: boolean
  clickable?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'default',
  padding: 'md',
  rounded: 'lg', // macOS uses moderate rounding
  hoverable: false,
  clickable: false,
})

const emit = defineEmits<{
  (e: 'click', event: MouseEvent): void
}>()

const classes = computed(() => {
  const base = [
    'transition-all duration-150',
  ]

  // Variant styles - macOS inspired
  const variants = {
    default: [
      // Clean white with subtle shadow like macOS windows
      'bg-white dark:bg-neutral-800/90',
      'border border-black/5 dark:border-white/5',
      'shadow-sm shadow-black/5 dark:shadow-black/20',
    ],
    elevated: [
      // Elevated like macOS popovers
      'bg-white dark:bg-neutral-800',
      'shadow-lg shadow-black/10 dark:shadow-black/30',
      'border border-black/5 dark:border-white/10',
    ],
    outline: [
      // Subtle outline style
      'bg-transparent',
      'border border-black/10 dark:border-white/10',
    ],
    ghost: [
      // Subtle background like macOS selection
      'bg-black/[0.03] dark:bg-white/[0.05]',
      'border border-transparent',
    ],
    vibrancy: [
      // macOS vibrancy effect
      'bg-white/60 dark:bg-neutral-800/60',
      'backdrop-blur-xl backdrop-saturate-150',
      'border border-black/5 dark:border-white/10',
      'shadow-sm shadow-black/5',
    ],
  }
  base.push(...variants[props.variant])

  // Padding - slightly tighter for macOS feel
  const paddings = {
    none: '',
    sm: 'p-2.5',
    md: 'p-4',
    lg: 'p-5',
    xl: 'p-6',
  }
  base.push(paddings[props.padding])

  // Border radius - macOS style
  const radiusMap = {
    sm: 'rounded-md',
    md: 'rounded-lg',
    lg: 'rounded-xl',
    xl: 'rounded-2xl',
    '2xl': 'rounded-[20px]',
    '3xl': 'rounded-[24px]',
  }
  base.push(radiusMap[props.rounded])

  // Hover state - subtle like macOS
  if (props.hoverable || props.clickable) {
    base.push(
      'hover:shadow-md hover:shadow-black/8 dark:hover:shadow-black/25',
      'hover:border-black/8 dark:hover:border-white/15',
    )
  }

  // Clickable - with press effect
  if (props.clickable) {
    base.push('cursor-pointer', 'active:scale-[0.98]', 'active:shadow-sm')
  }

  return base
})

function handleClick(event: MouseEvent) {
  if (props.clickable) {
    emit('click', event)
  }
}
</script>

<template>
  <div
    :class="classes"
    @click="handleClick"
  >
    <!-- Header slot -->
    <div v-if="$slots.header" class="mb-4">
      <slot name="header" />
    </div>

    <!-- Default content slot -->
    <slot />

    <!-- Footer slot -->
    <div v-if="$slots.footer" class="mt-4 pt-3 border-t border-black/5 dark:border-white/5">
      <slot name="footer" />
    </div>
  </div>
</template>
