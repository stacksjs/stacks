<script setup lang="ts">
const props = defineProps({
  isActive: Boolean,
})
</script>

<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    stroke-width="1.5"
    stroke="currentColor"
    class="text-gray-700 dark:text-gray-100 group-hover:text-gray-500 dark:text-gray-400 mr-3 h-5 w-5"
    :class="{ 'text-gray-900 dark:text-gray-100': props.isActive, 'group-hover:text-gray-900': !isDark }"
    fill="currentColor"
  >
    <path
      stroke-linecap="round"
      stroke-linejoin="round"
      d="M9 4.5v15m6-15v15m-10.875 0h15.75c.621 0 1.125-.504 1.125-1.125V5.625c0-.621-.504-1.125-1.125-1.125H4.125C3.504 4.5 3 5.004 3 5.625v12.75c0 .621.504 1.125 1.125 1.125z"
    />
  </svg>
</template>
