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
  <div class="rounded-md w-full mx-auto p-4" :style="`height: ${height}rem`">
    <div class="animate-pulse space-y-12">
      <!-- Title -->
      <div class="h-4 bg-slate-300 rounded-md w-3/4"></div>

      <!-- Description -->
      <div class="space-y-2">
        <div class="h-3 bg-slate-300 rounded-md w-full"></div>
        <div class="h-3 bg-slate-300 rounded-md w-5/6"></div>
      </div>

      <!-- Buttons -->
      <div class="flex space-x-4">
        <div class="h-8 bg-slate-300 rounded-md w-1/4"></div>
        <div class="h-8 bg-slate-300 rounded-md w-1/4"></div>
      </div>
    </div>
  </div>
</template>