<script setup lang="ts">
import { useFilter } from '~/stores/filters'

const {
  title,
  buttonText,
  keys,
  showFilter,
  values,
} = defineProps<Props>()

const emit = defineEmits([
  'newRecordAction',
  'clearFilters',
  'removeFilter',
  'applyFilters',
])

const filterStore = useFilter()

interface Props {
  title: string
  keys?: string[]
  values?: any
  buttonText?: String
  showFilter?: Boolean
}

function newRecord() {
  emit('newRecordAction')
}

const dropdown = ref([false])
const dropdownClicked = ref(false)

function toggleFilterButton(index: number, key: string) {
  filterStore.setFilterKey(key)
  dropdownClicked.value = true

  dropdown.value = []

  setTimeout(() => {
    dropdownClicked.value = false
  }, 250)

  dropdown.value[index] = !dropdown.value[index]
}

function clear() {
  emit('clearFilters')
}

function removeFilter(rule: string | boolean | number) {
  const filters = ref(filterStore.filterRules[filterStore.filterKey])

  const index = filters.value.indexOf(rule)

  if (index > -1) {
    // only splice array when item is found
    filters.value.splice(index, 1) // 2nd parameter means remove one item only
  }

  filterStore.setFilterRules(filters.value)

  if (!filterStore.filterRules[filterStore.filterKey].length)
    filterStore.clearFilters()

  emit('removeFilter')
}

function closeDropdown() {
  if (!dropdownClicked.value)
    dropdown.value = [false]
}

function doFilter() {
  emit('applyFilters')
}

function getBackground(index: number) {
  if (index === 0)
    return 'text-blue-500'

  if (index === 1)
    return 'text-yellow-500'

  if (index === 2)
    return 'text-pink-500'

  if (index === 3)
    return 'text-teal-500'

  if (index === 4)
    return 'text-red-500'

  return 'text-gray-500'
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between">
      <div
        class="flex items-start text-xl font-medium text-gray-900 sm:mx-none sm:mr-auto dark:text-gray-100"
      >
        <slot name="header-logo" />
        <span>{{ title }}</span>
      </div>

      <div class="flex items-center">
        <!-- <div class="hidden overflow-x-auto lg:flex sm:max-w-xl">
          <FilterList
            v-if="!isEmpty(filterStore.filterRules)"
            @filter-clear="clear"
            @remove-filter="removeFilter"
          />
        </div> -->
        <div v-if="showFilter">
          <div
            v-for="(key, index) in keys"
            :key="index"
            class="relative inline-block mr-4 text-left"
          >
            <button
              v-if="!isEmpty(values[key])"
              id="menu-button"
              type="button"
              aria-expanded="true"
              aria-haspopup="true"
              class="filter-button"
              @click="toggleFilterButton(index, key)"
            >
              <svg
                class="mr-1.5 h-3 w-3 text-indigo-400"
                :class="getBackground(index)"
                fill="currentColor"
                viewBox="0 0 8 8"
              >
                <circle
                  cx="4"
                  cy="4"
                  r="3"
                />
              </svg>

              <span class="text-sm">{{ displayKey(key) }}</span>
            </button>
            <transition
              enter-active-class="transition duration-100 ease-out"
              enter-from-class="transform scale-95 opacity-0"
              enter-to-class="transform scale-100 opacity-100"
              leave-active-class="transition duration-75 ease-in"
              leave-from-class="transform scale-100 opacity-100"
              leave-to-class="transform scale-95 opacity-0"
            >
              <FilterBuilder
                v-if="dropdown[index]"
                :values="values"
                @close-dropdown="closeDropdown()"
                @filter-apply="doFilter"
              />
            </transition>
          </div>
        </div>

        <button
          v-if="buttonText"
          type="button"
          class="primary-button"
          @click="newRecord()"
        >
          <svg
            class="w-5 h-5 mr-1 svg sprite-sprites"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 6v6m0 0v6m0-6h6m-6 0H6"
            />
          </svg>
          <span class="text-sm">{{ buttonText }}</span>
        </button>
      </div>
    </div>

    <div
      v-if="!isEmpty(filterStore.filterRules)"
      class="flex items-center mt-8 overflow-x-auto sm:max-w-full"
    >
      <FilterList
        @filter-clear="clear"
        @remove-filter="removeFilter"
      />
    </div>
  </div>
</template>
