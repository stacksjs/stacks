<script lang="ts" setup>
import { computed } from 'vue'

interface Props {
  as?: 'button' | 'a' | 'router-link'
  href?: string
  to?: string
  disabled?: boolean
  danger?: boolean
  active?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  as: 'button',
  disabled: false,
  danger: false,
  active: false,
})

const emit = defineEmits<{
  (e: 'click', event: MouseEvent): void
}>()

const classes = computed(() => {
  const base = [
    'w-full text-left px-4 py-2 text-sm',
    'flex items-center gap-3',
    'transition-colors duration-150',
    'focus:outline-none',
  ]

  if (props.disabled) {
    base.push('opacity-50 cursor-not-allowed')
  } else if (props.danger) {
    base.push(
      'text-red-600 dark:text-red-400',
      'hover:bg-red-50 dark:hover:bg-red-900/30',
      'focus:bg-red-50 dark:focus:bg-red-900/30',
    )
  } else if (props.active) {
    base.push(
      'bg-neutral-100 dark:bg-neutral-700',
      'text-neutral-900 dark:text-neutral-100',
    )
  } else {
    base.push(
      'text-neutral-700 dark:text-neutral-200',
      'hover:bg-neutral-100 dark:hover:bg-neutral-700',
      'focus:bg-neutral-100 dark:focus:bg-neutral-700',
    )
  }

  return base
})

function handleClick(event: MouseEvent) {
  if (!props.disabled) {
    emit('click', event)
  }
}
</script>

<template>
  <component
    :is="as === 'router-link' ? 'RouterLink' : as"
    :class="classes"
    :disabled="as === 'button' ? disabled : undefined"
    :href="as === 'a' ? href : undefined"
    :to="as === 'router-link' ? to : undefined"
    @click="handleClick"
  >
    <!-- Leading icon slot -->
    <slot name="icon" />

    <!-- Content -->
    <span class="flex-1">
      <slot />
    </span>

    <!-- Trailing content slot -->
    <slot name="trailing" />
  </component>
</template>
