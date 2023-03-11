<script setup lang="ts">
import type { Ref } from 'vue'
import { useFilter } from '~/stores/filters'

interface Props {
  keys?: string[]
  values?: any
}

const {
  values,
} = defineProps<Props>()

const emit = defineEmits(['filterSelected', 'filterApply', 'closeDropdown'])

const dropdownRef = ref(null as any)

const filterStore = useFilter()

const placeholder = ref('Filter...')

useClickOutside(dropdownRef, () => {
  emit('closeDropdown')
})

const filters: Ref<any[]> = ref([])

function filterData(value: string | number | boolean, isChecked: boolean) {
  if (isChecked) {
    filters.value.push(value)
    filterStore.setFilterRules(filters.value)
  }
  else {
    const index = filters.value.indexOf(value)
    if (index > -1) { // only splice array when item is found
      filters.value.splice(index, 1) // 2nd parameter means remove one item only
    }

    filterStore.setFilterRules(filters.value)
  }

  applyFilters()
  emit('filterSelected')
}

function applyFilters() {
  emit('filterApply')
}
</script>

<template>
  <div
    ref="dropdownRef"
    class="absolute right-0 z-20 w-48 mt-2 origin-top-right bg-white rounded-md shadow-lg md:w-[20rem]  min-h-32 dark:bg-gray-700 ring-1 ring-black ring-opacity-5 focus:outline-none"
    role="menu"
    aria-orientation="vertical"
    aria-labelledby="menu-button"
    tabindex="-1"
  >
    <!-- <div
      role="none"
    >
      <input
        type="text"
        name="email"
        class="block w-full px-4 py-2 text-gray-900 shadow-sm dark:bg-gray-700 dark:text-gray-200 dark:text-gray-100 focus:border-teal-500 dark:border-gray-600 focus:outline-none focus:ring-2"
        :placeholder="placeholder"
      >
    </div> -->

    <FilterValues
      :values="values"
      @select-filter-value="filterData"
      @apply-filter="applyFilters"
    />
  </div>
</template>
