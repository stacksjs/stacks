<script setup lang="ts">
/**
 * Select Component
 * A modern, styled select dropdown.
 */
import { ref, computed } from 'vue'

interface Option {
  value: string | number
  label: string
  disabled?: boolean
  icon?: string
}

interface Props {
  modelValue: string | number | null
  options: Option[]
  placeholder?: string
  label?: string
  error?: string
  hint?: string
  disabled?: boolean
  required?: boolean
  size?: 'sm' | 'md' | 'lg'
  searchable?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: 'Select an option',
  size: 'md',
  searchable: false,
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string | number | null): void
}>()

const isOpen = ref(false)
const searchQuery = ref('')
const selectRef = ref<HTMLDivElement>()

// Selected option
const selectedOption = computed(() => {
  return props.options.find((opt) => opt.value === props.modelValue)
})

// Filtered options
const filteredOptions = computed(() => {
  if (!props.searchable || !searchQuery.value) {
    return props.options
  }
  return props.options.filter((opt) =>
    opt.label.toLowerCase().includes(searchQuery.value.toLowerCase())
  )
})

// Size classes
const sizeClasses = computed(() => {
  const sizes = {
    sm: 'h-8 text-sm px-3',
    md: 'h-10 text-sm px-3',
    lg: 'h-12 text-base px-4',
  }
  return sizes[props.size]
})

function toggleDropdown() {
  if (!props.disabled) {
    isOpen.value = !isOpen.value
    if (isOpen.value) {
      searchQuery.value = ''
    }
  }
}

function selectOption(option: Option) {
  if (!option.disabled) {
    emit('update:modelValue', option.value)
    isOpen.value = false
  }
}

function handleClickOutside(event: MouseEvent) {
  if (selectRef.value && !selectRef.value.contains(event.target as Node)) {
    isOpen.value = false
  }
}

// Add click outside listener
import { onMounted, onUnmounted } from 'vue'

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<template>
  <div ref="selectRef" class="relative">
    <!-- Label -->
    <label v-if="label" class="block text-sm font-medium text-neutral-700 dark:text-neutral-200 mb-1.5">
      {{ label }}
      <span v-if="required" class="text-red-500">*</span>
    </label>

    <!-- Select trigger -->
    <button
      type="button"
      :disabled="disabled"
      :class="[
        'w-full flex items-center justify-between gap-2 rounded-lg border transition-all duration-150',
        sizeClasses,
        disabled
          ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400 cursor-not-allowed border-neutral-200 dark:border-neutral-700'
          : error
            ? 'border-red-300 dark:border-red-700 bg-white dark:bg-neutral-900 focus:ring-2 focus:ring-red-500/20 focus:border-red-500'
            : isOpen
              ? 'border-blue-500 bg-white dark:bg-neutral-900 ring-2 ring-blue-500/20'
              : 'border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 hover:border-neutral-400 dark:hover:border-neutral-500 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500',
      ]"
      @click="toggleDropdown"
    >
      <span
        :class="[
          'truncate',
          selectedOption
            ? 'text-neutral-900 dark:text-white'
            : 'text-neutral-400 dark:text-neutral-500',
        ]"
      >
        <span v-if="selectedOption" class="flex items-center gap-2">
          <div v-if="selectedOption.icon" :class="[selectedOption.icon, 'w-4 h-4']" />
          {{ selectedOption.label }}
        </span>
        <span v-else>{{ placeholder }}</span>
      </span>
      <div
        :class="[
          'i-hugeicons-arrow-down-01 w-4 h-4 text-neutral-400 transition-transform duration-150',
          isOpen ? 'rotate-180' : '',
        ]"
      />
    </button>

    <!-- Dropdown -->
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0 scale-95 -translate-y-1"
      enter-to-class="opacity-100 scale-100 translate-y-0"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="opacity-100 scale-100 translate-y-0"
      leave-to-class="opacity-0 scale-95 -translate-y-1"
    >
      <div
        v-show="isOpen"
        class="absolute z-50 mt-1 w-full rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-lg"
      >
        <!-- Search input -->
        <div v-if="searchable" class="p-2 border-b border-neutral-200 dark:border-neutral-700">
          <div class="relative">
            <div class="i-hugeicons-search-01 absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search..."
              class="w-full pl-9 pr-3 py-2 text-sm bg-neutral-100 dark:bg-neutral-800 border-0 rounded-md text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
        </div>

        <!-- Options list -->
        <div class="max-h-60 overflow-y-auto py-1">
          <template v-if="filteredOptions.length > 0">
            <button
              v-for="option in filteredOptions"
              :key="option.value"
              type="button"
              :disabled="option.disabled"
              :class="[
                'w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors',
                option.disabled
                  ? 'text-neutral-300 dark:text-neutral-600 cursor-not-allowed'
                  : option.value === modelValue
                    ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                    : 'text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800',
              ]"
              @click="selectOption(option)"
            >
              <div v-if="option.icon" :class="[option.icon, 'w-4 h-4']" />
              <span class="flex-1 truncate">{{ option.label }}</span>
              <div
                v-if="option.value === modelValue"
                class="i-hugeicons-tick-02 w-4 h-4 text-blue-600 dark:text-blue-400"
              />
            </button>
          </template>
          <div
            v-else
            class="px-3 py-6 text-center text-sm text-neutral-400 dark:text-neutral-500"
          >
            No options found
          </div>
        </div>
      </div>
    </Transition>

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
