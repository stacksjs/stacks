<script setup lang="ts">
import { count, increment } from '~/composables/src'

const { greeting = 'Welcome!' } = defineProps<{
  greeting: string
}>()

// lifecycle hooks
onMounted(() => {
  // eslint-disable-next-line no-console
  console.log(`The initial count is ${count}.`)
  // eslint-disable-next-line no-console
  console.log(`The greeting is ${greeting}.`)
})
</script>

<template>
  <h1 class="font-bold text-3xl text-red-800">
    {{ greeting }}
  </h1>
  <button
    type="button"
    class=":stacks: inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 cursor-pointer"
    @click="increment"
  >
    <i class=":stacks: i-heroicons-outline-plus -ml-1 mr-3 h-5 w-5" aria-hidden="true" />
    Count is: {{ count }}
  </button>
</template>

<style scoped>
@unocss-placeholder
</style>
