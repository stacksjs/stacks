<script setup lang="ts">
/**
 * Select Component - macOS Style
 * A dropdown select inspired by macOS popup buttons.
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
  size?: 'xs' | 'sm' | 'md' | 'lg'
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

// Size classes - macOS compact sizing
const sizeClasses = computed(() => {
  const sizes = {
    xs: 'h-6 text-[11px] px-2',
    sm: 'h-7 text-[12px] px-2.5',
    md: 'h-8 text-[13px] px-3',
    lg: 'h-9 text-[14px] px-3.5',
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
    <!-- Label - macOS style -->
    <label v-if="label" class="block text-[13px] font-medium text-neutral-600 dark:text-neutral-400 mb-1.5 tracking-tight">
      {{ label }}
      <span v-if="required" class="text-red-500">*</span>
    </label>

    <!-- Select trigger - macOS popup button style -->
    <button
      type="button"
      :disabled="disabled"
      :class="[
        'w-full flex items-center justify-between gap-2 rounded-md border transition-all duration-150',
        sizeClasses,
        disabled
          ? 'bg-black/5 dark:bg-white/5 text-neutral-400 cursor-not-allowed border-black/5 dark:border-white/10 opacity-40'
          : error
            ? 'border-red-400/60 dark:border-red-500/60 bg-white dark:bg-white/10 focus:ring-2 focus:ring-red-500/30 focus:border-red-500'
            : isOpen
              ? 'border-blue-500/50 bg-white dark:bg-white/10 ring-2 ring-blue-500/40'
              : 'border-black/10 dark:border-white/15 bg-white dark:bg-white/10 hover:border-black/20 dark:hover:border-white/25 focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/50',
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
          <div v-if="selectedOption.icon" :class="[selectedOption.icon, 'w-3.5 h-3.5']" />
          {{ selectedOption.label }}
        </span>
        <span v-else>{{ placeholder }}</span>
      </span>
      <div
        :class="[
          'i-hugeicons-arrow-down-01 w-3.5 h-3.5 text-neutral-400 transition-transform duration-150',
          isOpen ? 'rotate-180' : '',
        ]"
      />
    </button>

    <!-- Dropdown - macOS popover style -->
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
        class="absolute z-50 mt-1 w-full rounded-lg border border-black/10 dark:border-white/10 bg-white/95 dark:bg-neutral-800/95 backdrop-blur-xl shadow-lg shadow-black/10"
      >
        <!-- Search input -->
        <div v-if="searchable" class="p-2 border-b border-black/5 dark:border-white/5">
          <div class="relative">
            <div class="i-hugeicons-search-01 absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" />
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search..."
              class="w-full pl-8 pr-3 py-1.5 text-[13px] bg-black/5 dark:bg-white/10 border-0 rounded-md text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
          </div>
        </div>

        <!-- Options list - macOS menu style -->
        <div class="max-h-60 overflow-y-auto py-1">
          <template v-if="filteredOptions.length > 0">
            <button
              v-for="option in filteredOptions"
              :key="option.value"
              type="button"
              :disabled="option.disabled"
              :class="[
                'w-full flex items-center gap-2 px-2.5 py-1.5 text-[13px] text-left transition-colors mx-1 rounded-md',
                'first:mt-0 last:mb-0',
                option.disabled
                  ? 'text-neutral-300 dark:text-neutral-600 cursor-not-allowed'
                  : option.value === modelValue
                    ? 'bg-blue-500 text-white'
                    : 'text-neutral-700 dark:text-neutral-200 hover:bg-black/5 dark:hover:bg-white/10',
              ]"
              :style="{ width: 'calc(100% - 8px)' }"
              @click="selectOption(option)"
            >
              <div v-if="option.icon" :class="[option.icon, 'w-3.5 h-3.5']" />
              <span class="flex-1 truncate">{{ option.label }}</span>
              <div
                v-if="option.value === modelValue"
                class="i-hugeicons-tick-02 w-3.5 h-3.5"
              />
            </button>
          </template>
          <div
            v-else
            class="px-3 py-4 text-center text-[13px] text-neutral-400 dark:text-neutral-500"
          >
            No options found
          </div>
        </div>
      </div>
    </Transition>

    <!-- Error message -->
    <p v-if="error" class="mt-1.5 text-[12px] text-red-600 dark:text-red-400">
      {{ error }}
    </p>

    <!-- Hint text -->
    <p v-else-if="hint" class="mt-1.5 text-[12px] text-neutral-500 dark:text-neutral-400">
      {{ hint }}
    </p>
  </div>
</template>
