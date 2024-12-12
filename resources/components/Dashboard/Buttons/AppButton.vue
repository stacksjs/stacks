<script setup lang="ts">
import { computed, ref } from 'vue'

interface Props {
  buttonText: string
  loadingText?: string
  passedClass: string
}

const { buttonText, loadingText, passedClass } = defineProps<Props>()

const loading = ref(false)

const buttonString = computed(() => {
  return loading.value ? loadingText : buttonText
})

const getClass = computed(() => {
  const disabledClass = ' disabled:opacity-50 disabled:cursor-not-allowed'
  return passedClass + disabledClass
})
</script>

<template>
  <button
    type="button"
    class="flex items-center"
    :disabled="loading"
    :class="getClass"
  >
    <svg
      v-if="loading"
      class="mr-3 h-5 w-5 animate-spin text-white -ml-1"
      xmlns="http://www.w3.org/2000/svg"
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
    <slot v-if="!loading" name="icon" />

    <span>
      {{ buttonString }}
    </span>
  </button>
</template>
