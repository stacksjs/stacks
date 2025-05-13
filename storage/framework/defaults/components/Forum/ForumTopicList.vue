<template>
  <div class="mb-8">
    <div class="bg-gray-100 px-4 py-3 rounded-t-md flex items-center justify-between">
      <h2 class="text-lg font-bold">{{ title }}</h2>
      <div class="flex items-center gap-2">
        <select class="border rounded px-2 py-1 text-sm">
          <option>Sort by Latest</option>
          <option>Sort by Popular</option>
          <option>Sort by Unanswered</option>
        </select>
      </div>
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