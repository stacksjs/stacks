<script lang="ts">
import { count, increment } from '../../../composables/src'

interface Props {
  name?: string
}
</script>

<script setup lang="ts">
const props = withDefaults(defineProps<Props>(), {
  name: 'J. Doe',
})
</script>

<template>
  <h1 class=":stacks: font-bold text-3xl text-red-800">
    Hi there, {{ props.name }}!
  </h1>

  <button
    type="button"
    class=":stacks: bg-white border rounded-md font-medium border-gray-300 shadow-sm text-base py-2 px-4 text-gray-700 inline-flex items-center hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
    @click="increment"
  >
    <i class=":stacks: mr-3 text-3xl text-green-500 i-heroicons-outline-plus-circle hover:text-green-800" />

    Count is: {{ count }}
  </button>
</template>

<style scoped>
/* @unocss-placeholder */
</style>
