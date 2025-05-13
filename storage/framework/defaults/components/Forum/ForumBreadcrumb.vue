<template>
  <div class="mb-4">
    <nav class="flex" aria-label="Breadcrumb">
      <ol class="inline-flex items-center space-x-1 md:space-x-2">
        <li v-for="(item, index) in items" :key="index" class="inline-flex items-center">
          <div v-if="index > 0" class="flex items-center">
            <svg class="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
              <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd"></path>
            </svg>
          </div>
          <a
            v-if="item.link"
            :href="item.link"
            class="text-sm font-medium text-gray-700 hover:text-blue-600"
            :class="{'ml-1': index > 0}"
          >
            {{ item.label }}
          </a>
          <span
            v-else
            class="text-sm font-medium text-gray-500"
            :class="{'ml-1': index > 0}"
          >
            {{ item.label }}
          </span>
        </li>
      </ol>
    </nav>
  </div>
</template>

<script setup>
defineProps({
  items: {
    type: Array,
    default: () => []
  }
});
</script>