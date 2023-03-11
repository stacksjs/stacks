<script setup lang="ts">
const props = defineProps({
  isActive: Boolean,
})
</script>

<template>
  <svg
    class="text-gray-700 dark:text-gray-100 group-hover:text-gray-500 dark:text-gray-400 mr-3 h-5 w-5"
    :class="{ 'text-gray-900 dark:text-gray-100': props.isActive, 'group-hover:text-gray-900': !isDark }"
    fill="currentColor"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path
      stroke-linecap="round"
      stroke-linejoin="round"
      d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
    />
  </svg>
</template>
