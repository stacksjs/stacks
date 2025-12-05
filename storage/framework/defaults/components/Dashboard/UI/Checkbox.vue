<script setup lang="ts">
/**
 * Checkbox Component
 * A modern checkbox with label and description support.
 */
import { computed } from 'vue'

interface Props {
  modelValue: boolean
  label?: string
  description?: string
  disabled?: boolean
  indeterminate?: boolean
  size?: 'sm' | 'md' | 'lg'
  error?: string
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
  indeterminate: false,
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

const sizeClasses = computed(() => {
  const sizes = {
    sm: { checkbox: 'h-4 w-4', text: 'text-sm', desc: 'text-xs' },
    md: { checkbox: 'h-5 w-5', text: 'text-sm', desc: 'text-sm' },
    lg: { checkbox: 'h-6 w-6', text: 'text-base', desc: 'text-sm' },
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
      'relative flex',
      label || description ? 'gap-3' : '',
      disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer',
    ]"
    @click="toggle"
  >
    <!-- Checkbox input -->
    <div class="flex items-start pt-0.5">
      <div
        :class="[
          sizeClasses.checkbox,
          'relative rounded transition-all duration-150 flex items-center justify-center',
          'border-2',
          modelValue || indeterminate
            ? 'bg-blue-600 border-blue-600'
            : 'bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-600 hover:border-blue-400 dark:hover:border-blue-500',
          error ? 'border-red-500' : '',
          disabled ? '' : 'group-hover:border-blue-400',
        ]"
      >
        <!-- Checkmark -->
        <svg
          v-if="modelValue && !indeterminate"
          :class="[sizeClasses.checkbox, 'text-white']"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fill-rule="evenodd"
            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
            clip-rule="evenodd"
          />
        </svg>

        <!-- Indeterminate mark -->
        <svg
          v-if="indeterminate"
          :class="[sizeClasses.checkbox, 'text-white']"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fill-rule="evenodd"
            d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
            clip-rule="evenodd"
          />
        </svg>
      </div>
    </div>

    <!-- Label and description -->
    <div v-if="label || description || $slots.default" class="flex-1 min-w-0">
      <label
        v-if="label"
        :class="[
          sizeClasses.text,
          'font-medium',
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
          sizeClasses.desc,
          'mt-0.5',
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

  <!-- Error message -->
  <p v-if="error" class="mt-1.5 text-sm text-red-600 dark:text-red-400">
    {{ error }}
  </p>
</template>
