<script setup lang="ts">
const props = {}
const type = ref('text')
const label = ref('')
const className = ref('')
const id = ref(Math.random().toString(36).substring(7))
const formClasses
  = 'block w-full appearance-none rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-blue-500 sm:text-sm'
</script>

<template>
  <div :class="className">
    <label v-if="label" :for="id" class="mb-3 block text-sm text-gray-700 font-medium">
      {{ label }}
    </label>
    <input v-if="type === 'text'" :id="id" :type="type" v-bind="props" :class="formClasses">
    <select v-else :id="id" v-bind="props" :class="`${formClasses} pr-8`" />
  </div>
</template>
