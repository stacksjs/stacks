<template>
  <div class="mb-8">
    <div class="bg-gray-100 px-4 py-3 rounded-t-md flex items-center">
      <h2 class="text-lg font-bold">{{ title }}</h2>
    </div>

    <div class="border rounded-b-md divide-y">
      <slot></slot>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title: string
}>()
</script>