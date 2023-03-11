<script setup lang="ts">
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
</script>

<template>
  <div
    class="border shadow rounded-md w-full mx-auto"
  >
    <div class="animate-pulse flex">
      <div
        class="flex-1 grid p-4"
      >
        <div class="space-y-3 mb-4">
          <div class="grid grid-cols-3 gap-4">
            <div
              v-for="(col, colIndex) in numberOfCols"
              :key="colIndex"
              class="h-2 dark:bg-slate-200 bg-slate-700 rounded col-span-1"
              :data-line="col"
            />
          </div>
        </div>

        <div
          v-for="(line, lineIndex) in numberOfLines"
          :key="lineIndex"
          :data-line="line"
          class="h-2 dark:bg-slate-200 bg-slate-700 rounded mt-2"
        />
      </div>
    </div>
  </div>
</template>
