<script setup lang="ts">
interface Props {
  height: number
  cols?: number
}
const {
  height,
} = defineProps<Props>()
</script>

<template>
  <div
    class="border shadow rounded-md pb-2 px-2 w-full mx-auto"
  >
    <div class="animate-pulse flex">
      <div
        class="flex-1 grid py-1 space-x-2"
      >
        <div
          class="h-12 dark:bg-slate-200 bg-slate-700 rounded mt-2"
          :style="`height: ${height}rem`"
        />
      </div>
    </div>
  </div>
</template>
