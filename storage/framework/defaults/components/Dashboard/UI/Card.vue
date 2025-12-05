<script lang="ts" setup>
import { computed } from 'vue'

interface Props {
  variant?: 'default' | 'elevated' | 'outline' | 'ghost'
  padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl'
  rounded?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl'
  hoverable?: boolean
  clickable?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'default',
  padding: 'md',
  rounded: 'xl',
  hoverable: false,
  clickable: false,
})

const emit = defineEmits<{
  (e: 'click', event: MouseEvent): void
}>()

const classes = computed(() => {
  const base = [
    'transition-all duration-200',
  ]

  // Variant styles
  const variants = {
    default: [
      'bg-white dark:bg-neutral-800',
      'border border-neutral-200 dark:border-neutral-700',
      'shadow-sm',
    ],
    elevated: [
      'bg-white dark:bg-neutral-800',
      'shadow-lg dark:shadow-xl',
      'border border-neutral-100 dark:border-neutral-700/50',
    ],
    outline: [
      'bg-transparent',
      'border border-neutral-200 dark:border-neutral-700',
    ],
    ghost: [
      'bg-neutral-50 dark:bg-neutral-800/50',
      'border border-transparent',
    ],
  }
  base.push(...variants[props.variant])

  // Padding
  const paddings = {
    none: '',
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6',
    xl: 'p-8',
  }
  base.push(paddings[props.padding])

  // Border radius
  const radiusMap = {
    sm: 'rounded-md',
    md: 'rounded-lg',
    lg: 'rounded-xl',
    xl: 'rounded-2xl',
    '2xl': 'rounded-3xl',
    '3xl': 'rounded-[2rem]',
  }
  base.push(radiusMap[props.rounded])

  // Hover state
  if (props.hoverable || props.clickable) {
    base.push(
      'hover:shadow-md dark:hover:shadow-lg',
      'hover:border-neutral-300 dark:hover:border-neutral-600',
    )
  }

  // Clickable
  if (props.clickable) {
    base.push('cursor-pointer', 'active:scale-[0.99]')
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
    <div v-if="$slots.footer" class="mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-700">
      <slot name="footer" />
    </div>
  </div>
</template>
