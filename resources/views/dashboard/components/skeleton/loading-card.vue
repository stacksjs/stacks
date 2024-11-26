<script setup lang="ts">
import { defineProps } from 'vue'

defineProps({
  width: {
    type: Number,
    default: 16, // Default width in rem
  },
  height: {
    type: Number,
    default: 4, // Default height in rem
  },
})
</script>

<template>
  <div class="mx-auto w-full rounded-md shadow">
    <div class="flex animate-pulse space-x-4">
      <div class="flex-1 space-y-6">
        <div
          class="rounded-md bg-slate-300"
          :style="`height: ${height}rem`"
        />
      </div>
    </div>
  </div>
</template>
