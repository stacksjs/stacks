<script setup lang="ts">
/**
 * Textarea Component
 * A modern, auto-resizing textarea with character count.
 */
import { ref, computed, watch, onMounted, nextTick } from 'vue'

interface Props {
  modelValue: string
  label?: string
  placeholder?: string
  error?: string
  hint?: string
  disabled?: boolean
  readonly?: boolean
  required?: boolean
  rows?: number
  maxRows?: number
  minRows?: number
  maxLength?: number
  showCount?: boolean
  autoResize?: boolean
  resize?: 'none' | 'vertical' | 'horizontal' | 'both'
}

const props = withDefaults(defineProps<Props>(), {
  rows: 3,
  minRows: 2,
  maxRows: 10,
  showCount: false,
  autoResize: false,
  resize: 'vertical',
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const textareaRef = ref<HTMLTextAreaElement>()
const isFocused = ref(false)

const characterCount = computed(() => props.modelValue?.length || 0)
const isOverLimit = computed(() => props.maxLength && characterCount.value > props.maxLength)

const resizeClass = computed(() => {
  if (props.autoResize) return 'resize-none'
  const resizeClasses = {
    none: 'resize-none',
    vertical: 'resize-y',
    horizontal: 'resize-x',
    both: 'resize',
  }
  return resizeClasses[props.resize]
})

function handleInput(event: Event) {
  const value = (event.target as HTMLTextAreaElement).value
  emit('update:modelValue', value)

  if (props.autoResize) {
    nextTick(adjustHeight)
  }
}

function adjustHeight() {
  const textarea = textareaRef.value
  if (!textarea) return

  // Reset height to calculate new height
  textarea.style.height = 'auto'

  // Calculate line height
  const style = window.getComputedStyle(textarea)
  const lineHeight = parseInt(style.lineHeight) || 20
  const paddingTop = parseInt(style.paddingTop) || 0
  const paddingBottom = parseInt(style.paddingBottom) || 0
  const borderTop = parseInt(style.borderTopWidth) || 0
  const borderBottom = parseInt(style.borderBottomWidth) || 0

  // Calculate min and max heights
  const minHeight = lineHeight * props.minRows + paddingTop + paddingBottom + borderTop + borderBottom
  const maxHeight = lineHeight * props.maxRows + paddingTop + paddingBottom + borderTop + borderBottom

  // Set new height
  const scrollHeight = textarea.scrollHeight
  const newHeight = Math.min(Math.max(scrollHeight, minHeight), maxHeight)
  textarea.style.height = `${newHeight}px`
}

onMounted(() => {
  if (props.autoResize) {
    adjustHeight()
  }
})

watch(() => props.modelValue, () => {
  if (props.autoResize) {
    nextTick(adjustHeight)
  }
})
</script>

<template>
  <div>
    <!-- Label -->
    <div v-if="label || $slots.label" class="flex items-center justify-between mb-1.5">
      <label class="block text-sm font-medium text-neutral-700 dark:text-neutral-200">
        <slot name="label">
          {{ label }}
        </slot>
        <span v-if="required" class="text-red-500">*</span>
      </label>
      <span
        v-if="showCount && maxLength"
        :class="[
          'text-xs',
          isOverLimit
            ? 'text-red-500'
            : 'text-neutral-400 dark:text-neutral-500',
        ]"
      >
        {{ characterCount }}/{{ maxLength }}
      </span>
    </div>

    <!-- Textarea wrapper -->
    <div class="relative">
      <textarea
        ref="textareaRef"
        :value="modelValue"
        :placeholder="placeholder"
        :disabled="disabled"
        :readonly="readonly"
        :required="required"
        :rows="autoResize ? minRows : rows"
        :maxlength="maxLength"
        :class="[
          'block w-full rounded-lg border transition-all duration-150',
          'text-sm text-neutral-900 dark:text-white',
          'placeholder:text-neutral-400 dark:placeholder:text-neutral-500',
          'focus:outline-none',
          resizeClass,
          disabled
            ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400 cursor-not-allowed border-neutral-200 dark:border-neutral-700'
            : error || isOverLimit
              ? 'border-red-300 dark:border-red-700 bg-white dark:bg-neutral-900 focus:ring-2 focus:ring-red-500/20 focus:border-red-500'
              : 'border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 hover:border-neutral-400 dark:hover:border-neutral-500 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500',
          'px-3 py-2.5',
        ]"
        @input="handleInput"
        @focus="isFocused = true"
        @blur="isFocused = false"
      />

      <!-- Character count (alternative position) -->
      <span
        v-if="showCount && !maxLength"
        class="absolute bottom-2 right-2 text-xs text-neutral-400 dark:text-neutral-500 bg-white dark:bg-neutral-900 px-1"
      >
        {{ characterCount }} characters
      </span>
    </div>

    <!-- Error message -->
    <p v-if="error" class="mt-1.5 text-sm text-red-600 dark:text-red-400">
      {{ error }}
    </p>

    <!-- Hint text -->
    <p v-else-if="hint" class="mt-1.5 text-sm text-neutral-500 dark:text-neutral-400">
      {{ hint }}
    </p>
  </div>
</template>
