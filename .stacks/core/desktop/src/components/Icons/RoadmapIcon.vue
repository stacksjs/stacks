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
      d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z"
    />
  </svg>
</template>
