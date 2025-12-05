<script setup lang="ts">
/**
 * Tabs Component
 * A modern tab navigation component.
 */
import { computed } from 'vue'

interface Tab {
  id: string
  label: string
  icon?: string
  badge?: string | number
  disabled?: boolean
}

interface Props {
  tabs: Tab[]
  modelValue: string
  variant?: 'underline' | 'pills' | 'boxed'
  size?: 'sm' | 'md' | 'lg'
  fullWidth?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'underline',
  size: 'md',
  fullWidth: false,
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const sizeClasses = computed(() => {
  const sizes = {
    sm: 'text-sm py-2 px-3',
    md: 'text-sm py-2.5 px-4',
    lg: 'text-base py-3 px-5',
  }
  return sizes[props.size]
})

function selectTab(tab: Tab) {
  if (!tab.disabled) {
    emit('update:modelValue', tab.id)
  }
}
</script>

<template>
  <div
    :class="[
      'flex',
      fullWidth ? 'w-full' : '',
      variant === 'underline' ? 'border-b border-neutral-200 dark:border-neutral-700' : '',
      variant === 'pills' ? 'gap-2 bg-neutral-100 dark:bg-neutral-800 p-1 rounded-lg' : '',
      variant === 'boxed' ? 'border border-neutral-200 dark:border-neutral-700 rounded-lg p-1' : '',
    ]"
  >
    <button
      v-for="tab in tabs"
      :key="tab.id"
      type="button"
      :disabled="tab.disabled"
      :class="[
        'inline-flex items-center justify-center gap-2 font-medium transition-all duration-150',
        sizeClasses,
        fullWidth ? 'flex-1' : '',
        tab.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
        // Variant-specific styles
        variant === 'underline' && [
          '-mb-px',
          modelValue === tab.id
            ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
            : 'border-b-2 border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300 dark:text-neutral-400 dark:hover:text-neutral-200 dark:hover:border-neutral-600',
        ],
        variant === 'pills' && [
          'rounded-md',
          modelValue === tab.id
            ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm'
            : 'text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200',
        ],
        variant === 'boxed' && [
          'rounded-md',
          modelValue === tab.id
            ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white'
            : 'text-neutral-500 hover:text-neutral-700 hover:bg-neutral-50 dark:text-neutral-400 dark:hover:text-neutral-200 dark:hover:bg-neutral-800/50',
        ],
      ]"
      @click="selectTab(tab)"
    >
      <div v-if="tab.icon" :class="[tab.icon, 'w-4 h-4']" />
      <span>{{ tab.label }}</span>
      <span
        v-if="tab.badge !== undefined"
        :class="[
          'inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 text-xs font-medium rounded-full',
          modelValue === tab.id
            ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400'
            : 'bg-neutral-200 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300',
        ]"
      >
        {{ tab.badge }}
      </span>
    </button>
  </div>
</template>
