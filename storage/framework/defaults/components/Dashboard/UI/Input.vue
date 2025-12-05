<script lang="ts" setup>
import { computed, ref } from 'vue'

interface Props {
  modelValue?: string | number
  type?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url' | 'search'
  placeholder?: string
  disabled?: boolean
  readonly?: boolean
  required?: boolean
  error?: string
  hint?: string
  label?: string
  id?: string
  size?: 'sm' | 'md' | 'lg'
  fullWidth?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  type: 'text',
  size: 'md',
  fullWidth: true,
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string | number): void
  (e: 'focus', event: FocusEvent): void
  (e: 'blur', event: FocusEvent): void
}>()

const inputRef = ref<HTMLInputElement | null>(null)
const isFocused = ref(false)

const inputId = computed(() => props.id || `input-${Math.random().toString(36).slice(2, 11)}`)

const containerClasses = computed(() => [
  props.fullWidth ? 'w-full' : '',
])

const inputClasses = computed(() => {
  const base = [
    'block w-full',
    'bg-white dark:bg-neutral-800',
    'border rounded-lg',
    'text-neutral-900 dark:text-neutral-100',
    'placeholder:text-neutral-400 dark:placeholder:text-neutral-500',
    'transition-colors duration-150',
    'focus:outline-none focus:ring-2 focus:ring-offset-0',
  ]

  // Size variants
  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-3.5 py-2 text-sm',
    lg: 'px-4 py-2.5 text-base',
  }
  base.push(sizes[props.size])

  // Border and focus states
  if (props.error) {
    base.push(
      'border-red-300 dark:border-red-500',
      'focus:border-red-500 focus:ring-red-500/20',
    )
  } else {
    base.push(
      'border-neutral-300 dark:border-neutral-600',
      'focus:border-blue-500 focus:ring-blue-500/20',
      'hover:border-neutral-400 dark:hover:border-neutral-500',
    )
  }

  // Disabled state
  if (props.disabled) {
    base.push('opacity-50 cursor-not-allowed bg-neutral-50 dark:bg-neutral-900')
  }

  return base
})

const labelClasses = computed(() => [
  'block text-sm font-medium mb-1.5',
  props.error ? 'text-red-600 dark:text-red-400' : 'text-neutral-700 dark:text-neutral-300',
])

function handleInput(event: Event) {
  const target = event.target as HTMLInputElement
  emit('update:modelValue', target.value)
}

function handleFocus(event: FocusEvent) {
  isFocused.value = true
  emit('focus', event)
}

function handleBlur(event: FocusEvent) {
  isFocused.value = false
  emit('blur', event)
}

function focus() {
  inputRef.value?.focus()
}

function blur() {
  inputRef.value?.blur()
}

defineExpose({ focus, blur })
</script>

<template>
  <div :class="containerClasses">
    <!-- Label -->
    <label v-if="label" :for="inputId" :class="labelClasses">
      {{ label }}
      <span v-if="required" class="text-red-500 ml-0.5">*</span>
    </label>

    <!-- Input wrapper for icons -->
    <div class="relative">
      <!-- Leading icon slot -->
      <div
        v-if="$slots['icon-left']"
        class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-neutral-400"
      >
        <slot name="icon-left" />
      </div>

      <input
        :id="inputId"
        ref="inputRef"
        :type="type"
        :value="modelValue"
        :placeholder="placeholder"
        :disabled="disabled"
        :readonly="readonly"
        :required="required"
        :class="[
          inputClasses,
          $slots['icon-left'] ? 'pl-10' : '',
          $slots['icon-right'] ? 'pr-10' : '',
        ]"
        @input="handleInput"
        @focus="handleFocus"
        @blur="handleBlur"
      />

      <!-- Trailing icon slot -->
      <div
        v-if="$slots['icon-right']"
        class="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-neutral-400"
      >
        <slot name="icon-right" />
      </div>
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
