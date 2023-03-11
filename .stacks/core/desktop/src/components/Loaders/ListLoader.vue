<script setup lang="ts">
import type { ComputedRef } from 'vue'

interface Props {
  lines: number
  cols?: number
}
const {
  lines,
  cols,
} = defineProps<Props>()

const numberOfLines: ComputedRef<number[]> = computed(() => {
  const arr = []

  for (let index = 1; index <= lines; index++)
    arr.push(index)

  return arr
})

const numberOfCols: ComputedRef<number[]> = computed(() => {
  const arr = []
  const numCols = cols || 1
  for (let index = 1; index <= numCols; index++)
    arr.push(index)

  return arr
})

const getGrid = computed(() => {
  let className = ''

  switch (cols) {
    case 1:
      className = 'grid-cols-1'
      break
    case 2:
      className = 'grid-cols-2'
      break
    case 3:
      className = 'grid-cols-3'
      break
    case 4:
      className = 'grid-cols-4'
      break
    case 5:
      className = 'grid-cols-5'
      break
    case 6:
      className = 'grid-cols-6'
      break
    case 7:
      className = 'grid-cols-7'
      break
    case 8:
      className = 'grid-cols-8'
      break
    case 9:
      className = 'grid-cols-9'
      break
    case 10:
      className = 'grid-cols-10'
      break
    case 11:
      className = 'grid-cols-11'
      break
    case 12:
      className = 'grid-cols-12'
      break
    default:
      className = 'grid-cols-1'
      break
  }

  return className
})
</script>

<template>
  <div
    class="border dark:border-gray-600 shadow rounded-md pb-2 px-2 w-full mx-auto"
  >
    <div class="animate-pulse flex">
      <div
        class="flex-1 grid py-1 space-x-2"
        :class="getGrid"
      >
        <div
          v-for="(col, index) in numberOfCols"
          :key="index"
          :data-line="col"
        >
          <div
            v-for="(line, lineIndex) in numberOfLines"
            :key="lineIndex"
            :data-line="line"
            class="h-2 dark:bg-slate-200 bg-slate-700 rounded mt-2"
          />
        </div>
      </div>
    </div>
  </div>
</template>
