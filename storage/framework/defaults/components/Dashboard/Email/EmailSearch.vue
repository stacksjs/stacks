<script setup lang="ts">
import { ref } from 'vue'

interface Props {
  modelValue: string
  timeRange: 'day' | 'week' | 'month' | 'year'
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'update:timeRange', value: 'day' | 'week' | 'month' | 'year'): void
}>()

const updateSearch = (event: Event) => {
  const target = event.target as HTMLInputElement
  emit('update:modelValue', target.value)
}

const updateTimeRange = (event: Event) => {
  const target = event.target as HTMLSelectElement
  emit('update:timeRange', target.value as 'day' | 'week' | 'month' | 'year')
}
</script>

<template>
  <div class="bg-white dark:bg-blue-gray-700 border-b border-gray-200 dark:border-blue-gray-600 py-2 px-4">
    <div class="flex items-center">
      <!-- Search bar -->
      <div class="flex-1 max-w-2xl">
        <div class="relative">
          <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <i class="i-hugeicons-search text-gray-400 text-lg"></i>
          </div>
          <input
            :value="modelValue"
            @input="updateSearch"
            type="text"
            placeholder="Search emails..."
            class="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-blue-gray-600 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          />
        </div>
      </div>

      <!-- Activity chart toggle -->
      <div class="ml-4">
        <select
          :value="timeRange"
          @change="updateTimeRange"
          class="h-9 text-sm border-0 rounded-md bg-gray-50 dark:bg-blue-gray-600 py-1.5 pl-3 pr-8 text-gray-900 dark:text-gray-100 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-blue-600"
        >
          <option value="day">Last 24 Hours</option>
          <option value="week">Last 7 Days</option>
          <option value="month">Last 30 Days</option>
          <option value="year">Last Year</option>
        </select>
      </div>
    </div>
  </div>
</template>
