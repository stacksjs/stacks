<script setup lang="ts">
const props = defineProps({
  isActive: Boolean,
})
</script>

<template>
  <svg
    class="text-gray-700 dark:text-gray-100 group-hover:text-gray-500 dark:text-gray-400 mr-3 h-5 w-5"
    :class="{ 'text-gray-900 dark:text-gray-100': props.isActive, 'group-hover:text-gray-900': !isDark }"
    viewBox="0 0 24 24"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      stroke-linecap="round"
      stroke-linejoin="round"
      d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
    />
  </svg>
</template>
