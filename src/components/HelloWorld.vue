<script setup lang="ts">
const {
  name = 'J. Doe',
} = defineProps<{
  name?: string
}>()

// reactive state
let count = $ref(0)

// functions that mutate state and trigger updates
function increment() {
  count++
}

// lifecycle hooks
// onMounted(() => {
//   // eslint-disable-next-line no-console
//   console.log(`The initial count is ${count}.`)
// })
</script>

<template>
  <h1 class="font-bold text-3xl text-red-800">
    Hi there, {{ name }}!
  </h1>

  <button
    type="button"
    class="bg-white border rounded-md font-medium border-gray-300 shadow-sm text-base py-2 px-4 text-gray-700 inline-flex items-center hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
    @click="increment"
  >
    <i class="mr-3 text-3xl text-green-500 i-heroicons-outline-plus-circle hover:text-green-800" />

    Count is: {{ count }}
  </button>
</template>

<style scoped></style>
