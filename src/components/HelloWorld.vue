<script setup lang="ts">
const { message = 'Welcome!' } = defineProps<{
  message: string
}>()

// reactive state
let count = ref(0)

// functions that mutate state and trigger updates
function increment() {
  count.value++
}

// lifecycle hooks
onMounted(() => {
  // eslint-disable-next-line no-console
  console.log(`The initial count is ${count}.`)
  // eslint-disable-next-line no-console
  console.log(`The message is ${message}.`)
})
</script>

<template>
  <h1 class=":stacks: font-bold text-3xl text-red-800">
    {{ message }}
  </h1>
  <button
    type="button"
    class=":stacks: bg-white border rounded-md font-medium border-gray-300 shadow-sm text-base py-2 px-4 text-gray-700 inline-flex items-center hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
    @click="increment"
  >
    Count is: {{ count }}
  </button>
</template>

<style scoped>
@unocss-placeholder
</style>
