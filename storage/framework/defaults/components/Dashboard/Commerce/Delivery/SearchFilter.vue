<template>
  <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between">
    <div class="flex flex-col sm:flex-row sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
      <!-- Search -->
      <div class="relative rounded-md shadow-sm">
        <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
          <div class="i-hugeicons-search-01 h-5 w-5 text-gray-400" />
        </div>
        <input
          type="text"
          class="block w-full rounded-md border-0 py-1.5 pl-10 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-800 dark:text-white dark:ring-gray-700 dark:placeholder:text-gray-500"
          :placeholder="placeholder"
          v-model="searchQuery"
          @input="$emit('search', searchQuery)"
        />
      </div>
    </div>

    <!-- Add Button -->
    <div class="mt-4 sm:mt-0">
      <button
        @click="$emit('add')"
        type="button"
        class="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
      >
        <div class="i-hugeicons-plus-sign h-5 w-5 mr-1" />
        {{ addButtonText }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps({
  placeholder: {
    type: String,
    default: 'Search...'
  },
  addButtonText: {
    type: String,
    default: 'Add New'
  }
})

defineEmits(['search', 'add'])

const searchQuery = ref('')
</script>
