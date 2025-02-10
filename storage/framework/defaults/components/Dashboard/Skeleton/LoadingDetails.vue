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
  <div class="mx-auto w-full rounded-md p-4" :style="`height: ${height}rem`">
    <div class="animate-pulse space-y-12">
      <!-- Title -->
      <div class="h-4 w-3/4 rounded-md bg-slate-300" />

      <!-- Description -->
      <div class="space-y-2">
        <div class="h-3 w-full rounded-md bg-slate-300" />
        <div class="h-3 w-5/6 rounded-md bg-slate-300" />
      </div>

      <!-- Buttons -->
      <div class="flex space-x-4">
        <div class="h-8 w-1/4 rounded-md bg-slate-300" />
        <div class="h-8 w-1/4 rounded-md bg-slate-300" />
      </div>
    </div>
  </div>
</template>
