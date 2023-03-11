<script setup lang="ts">
import { useFilter } from '~/stores/filters'

const { values } = defineProps<Props>()

const emit = defineEmits(['selectFilterValue', 'applyFilter'])
const filterStore = useFilter()

interface Props {
  values?: any
}

function selectFilter(event: any) {
  emit('selectFilterValue', event.target.value, event.target.checked)
}

const filterValues = computed(() => {
  const facets = values[filterStore.filterKey]
  const facetDistribution = []

  for (const key in facets) {
    if (Object.prototype.hasOwnProperty.call(facets, key))
      facetDistribution.push({ label: key, count: facets[key] })
  }

  return facetDistribution
})

const currentFilters = computed(() => {
  return filterStore.filterRules[filterStore.filterKey] || []
})

function isChecked(filterValue: string) {
  return currentFilters.value.includes(filterValue)
}
</script>

<template>
  <div
    role="none"
  >
    <div class="max-h-[20rem] overflow-y-auto px-4 py-2">
      <!-- Active: "bg-gray-100 text-gray-900", Not Active: "text-gray-700" -->
      <button
        v-for="(facet, index) in filterValues"
        :key="index"
        href="#"
        class="flex items-center justify-start text-sm text-gray-700 group "
        role="menuitem"
        tabindex="-1"
      >
        <input
          :id="String(index)"
          type="checkbox"
          class="w-4 h-4 text-teal-600 border-gray-300 rounded"
          :value="facet.label"
          :checked="isChecked(facet.label)"
          @change="selectFilter($event)"
        >

        <label
          :for="String(index)"
          :title="facet.label"
          class="flex items-center h-8 ml-2 text-xs font-medium text-gray-700 cursor-pointer text-left dark:text-gray-200 group-hover:text-custom-green"
        >
          <span>{{ facet.label }}</span>

        </label>

        <span class="ml-2 text-xs">
          <span
            class="inline-flex mr-2 bg-blue-100 items-center rounded-full px-2.5 py-0.5 text-xs font-medium text-gray-800"
          >{{ facet.count }}</span>
        </span>
      </button>
    </div>
  </div>
</template>
