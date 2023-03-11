<script setup lang="ts">
import { useFilter } from '../../stores/filters'

const emit = defineEmits(['filterClear', 'removeFilter'])
const filterStore = useFilter()

function clear() {
  emit('filterClear')
}

function removeFilter(rule: string | boolean | number) {
  emit('removeFilter', rule)
}

const hasFilters = computed(() => {
  if (filterStore.filterRules[filterStore.filterKey])
    return true

  return false
})

function getBackground(index: number) {
  if (index === 0)
    return 'text-blue-700 bg-blue-100'

  if (index === 1)
    return 'text-yellow-700 bg-yellow-100'

  if (index === 2)
    return 'text-pink-700 bg-pink-100'

  if (index === 3)
    return 'text-teal-700 bg-teal-100'

  if (index === 4)
    return 'text-red-700 bg-red-100'

  return 'text-gray-700 bg-gray-100'
}
</script>

<template>
  <button
    v-if="hasFilters && filterStore.filterRules[filterStore.filterKey].length"
    type="button"
    title="Clear Filters"
    class="bg-red-100 dark:bg-red-500 dark:hover-bg-red-600 hover:bg-red-200 mr-2 justify-center p-0.5 rounded-md focus:text-white focus:outline-none"
    @click="clear"
  >
    <svg
      class="w-4 h-4 text-red-700 dark:text-gray-50"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
      />
    </svg>
  </button>

  <div
    v-for="(rule, index) in filterStore.filterRules[filterStore.filterKey]"
    :key="index"
    class="relative inline-block text-left"
  >
    <span
      class="inline-flex mr-2 items-center rounded-full py-0.5 pl-2 pr-0.5 text-xs font-medium"
      :class="getBackground(index)"
    >
      {{ filterStore.filterKey }} | {{ rule }}
      <button
        type="button"
        class="ml-0.5 inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full text-gray-400 hover:bg-gray-200 hover:text-indigo-500 focus:bg-gray-500 focus:text-white focus:outline-none"
        @click="removeFilter(rule)"
      >
        <svg
          class="h-2 w-2"
          stroke="currentColor"
          fill="none"
          viewBox="0 0 8 8"
        >
          <path
            stroke-linecap="round"
            stroke-width="1.5"
            d="M1 1l6 6m0-6L1 7"
          />
        </svg>
      </button>
    </span>
  </div>
</template>
