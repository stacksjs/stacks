<script setup lang="ts">
const props = defineProps<{
  loading: boolean
  buttonText: string
  classString: string
}>()

const fullClass = computed(() => {
  let cls = ' duration-150 ease-in-out transition focus:ring-2 focus:ring-inset focus:ring-blue-600'

  if (props.loading) {
    cls += ` opacity-75 disabled:cursor-not-allowed `
  }

  return props.classString + cls
})
</script>

<template>
  <button type="button" :class="fullClass" :disabled="props.loading">
    <svg
      v-if="props.loading"
      class="mr-1 h-5 w-5 animate-spin text-gray-500 -ml-1"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        class="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        stroke-width="4"
      />
      <path
        class="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>

    <span v-if="!props.loading">{{ props.buttonText }}</span>
    <span v-else>One moment...</span>
  </button>
</template>
