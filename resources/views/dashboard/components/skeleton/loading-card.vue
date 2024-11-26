
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
  <div class="flex space-x-8">
    <div class="border border-blue-300 shadow rounded-md p-4 w-full mx-auto">
      <div class="animate-pulse flex space-x-4">
        <div class="flex-1 space-y-6 py-1">
          <div 
            class="bg-slate-300 rounded-md" 
            :style="`height: ${height}rem`"
          ></div>
        </div>
      </div>
    </div>
  </div>
</template>
