<template>
  <div>
    <!-- Search -->
    <div class="relative rounded-md shadow-sm">
      <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
        <div class="i-hugeicons-search-01 h-5 w-5 text-gray-400" />
      </div>
      <input
        type="text"
        class="block w-full rounded-md border-0 py-2.5 pl-10 pr-3 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 text-base leading-6 dark:bg-blue-gray-800 dark:text-white dark:ring-gray-700 dark:placeholder:text-gray-500"
        :placeholder="placeholder"
        v-model="searchQuery"
        @input="$emit('search', searchQuery)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps({
  placeholder: {
    type: String,
    default: 'Search...'
  }
})

defineEmits(['search'])

const searchQuery = ref('')
</script>
