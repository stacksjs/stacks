<script setup lang="ts">
/**
 * Toggle/Switch Component - macOS Style
 * A toggle switch inspired by macOS system preferences.
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

// macOS-style compact toggle sizes
const sizeClasses = computed(() => {
  const sizes = {
    sm: { track: 'h-4 w-7', thumb: 'h-3 w-3', translate: 'translate-x-3' },
    md: { track: 'h-5 w-9', thumb: 'h-4 w-4', translate: 'translate-x-4' },
    lg: { track: 'h-6 w-11', thumb: 'h-5 w-5', translate: 'translate-x-5' },
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
    <!-- Toggle switch - macOS style -->
    <button
      type="button"
      role="switch"
      :aria-checked="modelValue"
      :disabled="disabled"
      :class="[
        'relative inline-flex shrink-0 rounded-full transition-all duration-150 ease-in-out',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 focus-visible:ring-offset-0',
        sizeClasses.track,
        // macOS green when on, gray when off
        modelValue
          ? 'bg-green-500' // macOS green #34c759
          : 'bg-black/15 dark:bg-white/20',
        disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer',
      ]"
    >
      <span
        :class="[
          'pointer-events-none inline-block rounded-full bg-white shadow-sm ring-0 transition-transform duration-150 ease-in-out',
          sizeClasses.thumb,
          modelValue ? sizeClasses.translate : 'translate-x-0.5',
        ]"
      />
    </button>

    <!-- Label and description - macOS style -->
    <div v-if="label || description || $slots.default" class="flex-1 min-w-0">
      <label
        v-if="label"
        :class="[
          'text-[13px] font-medium tracking-tight',
          disabled
            ? 'text-neutral-400 dark:text-neutral-600'
            : 'text-neutral-700 dark:text-neutral-200',
        ]"
      >
        {{ label }}
      </label>
      <p
        v-if="description"
        :class="[
          'text-[12px] mt-0.5',
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
