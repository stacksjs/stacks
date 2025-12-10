<script lang="ts" setup>
/**
 * DropdownItem Component - macOS Style
 * A menu item with macOS-inspired styling.
 */
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
    // macOS menu item style - compact with rounded corners
    'w-[calc(100%-8px)] mx-1 text-left px-2.5 py-1.5 text-[13px]',
    'flex items-center gap-2.5',
    'transition-colors duration-100',
    'focus:outline-none',
    'rounded-md',
  ]

  if (props.disabled) {
    base.push('opacity-40 cursor-not-allowed')
  } else if (props.danger) {
    base.push(
      'text-red-600 dark:text-red-400',
      'hover:bg-red-500 hover:text-white',
      'focus:bg-red-500 focus:text-white',
    )
  } else if (props.active) {
    // macOS blue selection
    base.push(
      'bg-blue-500 text-white',
    )
  } else {
    base.push(
      'text-neutral-700 dark:text-neutral-200',
      'hover:bg-black/5 dark:hover:bg-white/10',
      'focus:bg-black/5 dark:focus:bg-white/10',
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
    <span class="w-4 h-4 flex items-center justify-center text-current opacity-70">
      <slot name="icon" />
    </span>

    <!-- Content -->
    <span class="flex-1 truncate">
      <slot />
    </span>

    <!-- Trailing content slot (for shortcuts, badges, etc.) -->
    <slot name="trailing" />
  </component>
</template>
