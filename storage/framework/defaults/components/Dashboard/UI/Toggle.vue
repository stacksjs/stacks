<script setup lang="ts">
/**
 * Toggle/Switch Component
 * A modern toggle switch with label support.
 */
import { computed } from 'vue'

interface Props {
  modelValue: boolean
  label?: string
  description?: string
  disabled?: boolean
  size?: 'sm' | 'md' | 'lg'
  labelPosition?: 'left' | 'right'
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
  labelPosition: 'right',
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

const sizeClasses = computed(() => {
  const sizes = {
    sm: { track: 'h-5 w-9', thumb: 'h-4 w-4', translate: 'translate-x-4' },
    md: { track: 'h-6 w-11', thumb: 'h-5 w-5', translate: 'translate-x-5' },
    lg: { track: 'h-7 w-14', thumb: 'h-6 w-6', translate: 'translate-x-7' },
  }
  return sizes[props.size]
})

function toggle() {
  if (!props.disabled) {
    emit('update:modelValue', !props.modelValue)
  }
}
</script>

<template>
  <div
    :class="[
      'flex items-center gap-3',
      labelPosition === 'left' ? 'flex-row-reverse justify-end' : '',
      disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer',
    ]"
    @click="toggle"
  >
    <!-- Toggle switch -->
    <button
      type="button"
      role="switch"
      :aria-checked="modelValue"
      :disabled="disabled"
      :class="[
        'relative inline-flex shrink-0 rounded-full transition-colors duration-200 ease-in-out',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-neutral-900',
        sizeClasses.track,
        modelValue
          ? 'bg-blue-600'
          : 'bg-neutral-200 dark:bg-neutral-700',
        disabled ? 'cursor-not-allowed' : 'cursor-pointer',
      ]"
    >
      <span
        :class="[
          'pointer-events-none inline-block rounded-full bg-white shadow-lg ring-0 transition-transform duration-200 ease-in-out',
          sizeClasses.thumb,
          modelValue ? sizeClasses.translate : 'translate-x-0.5',
        ]"
      />
    </button>

    <!-- Label and description -->
    <div v-if="label || description || $slots.default" class="flex-1 min-w-0">
      <label
        v-if="label"
        :class="[
          'text-sm font-medium',
          disabled
            ? 'text-neutral-400 dark:text-neutral-500'
            : 'text-neutral-700 dark:text-neutral-200',
        ]"
      >
        {{ label }}
      </label>
      <p
        v-if="description"
        :class="[
          'text-sm mt-0.5',
          disabled
            ? 'text-neutral-300 dark:text-neutral-600'
            : 'text-neutral-500 dark:text-neutral-400',
        ]"
      >
        {{ description }}
      </p>
      <slot />
    </div>
  </div>
</template>
