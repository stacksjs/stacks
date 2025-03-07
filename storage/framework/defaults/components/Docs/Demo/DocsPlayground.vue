<script setup lang="ts">
import { ref } from 'vue';

const isPreviewMode = ref(true);

</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-col gap-2">
      <div class="bg-gray-100 dark:bg-gray-800 rounded-lg relative">
        <div class="flex items-stretch justify-end rounded-t-[10px] px-3 py-1 md:m-1 md:rounded-lg bg-gray-100 dark:bg-gray-800">
          <button
            class="pointer-events-auto mr-1 flex rounded-md px-3 py-2 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
            :class="isPreviewMode ? 'bg-white text-blue-500' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'"
            @click="isPreviewMode = true"
          >
            Preview
          </button>
          <button
            class="pointer-events-auto flex rounded-md px-3 py-2 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
            :class="!isPreviewMode ? 'bg-white text-blue-500' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'"
            @click="isPreviewMode = false"
          >
            Code
          </button>
        </div>

        <div class=" ">
          <div v-if="isPreviewMode" class="relative h-full py-4 px-4 relative z-30">
            <slot />
          </div>

          <div v-else class="overflow-auto h-[350px] text-sm relative z-30 h-">
            <slot name="code" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
