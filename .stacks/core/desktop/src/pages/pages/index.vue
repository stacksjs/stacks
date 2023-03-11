<script setup lang="ts">
import { usePageStore } from '~/stores/page'
import { useFilter } from '~/stores/filters'

const router = useRouter()
const filterStore = useFilter()

function createMember() {
  router.push({ name: 'team-members-create' })
}

const pageStore = usePageStore()

function searchPages(search: string) {
  filterStore.setSearch(search)

  pageStore.fetchPages({ page: 1, search, filters: filterStore.filterVal, sort: filterStore.sort })
}

function clearFilters() {
  pageStore.fetchPages({ page: 1 })

  filterStore.clearFilters()
}

// function filterTeamMembers(search: string) {
//   let filters = []
//   if (filterStore.filterRules[filterStore.filterKey]) {
//     filters = filterStore.filterRules[filterStore.filterKey].map((filter: string) => {
//       return `${[filterStore.filterKey]}='${filter}'`
//     })
//   }

//   filterStore.setFilterVal(filters)

//   pageStore.fetchPages({ page: 1, filters, search: filterStore.search, sort: filterStore.sort })
// }

const keys = ref([
  'title',
])

const values = ref({
  title: ['President', 'Contract Coordinator', 'Broker Sales Manager', 'Contracting Manager'],
})

const dropdown = ref(false)
const dropdownClicked = ref(false)

function toggleDropdown() {
  dropdownClicked.value = true

  setTimeout(() => {
    dropdownClicked.value = false
  }, 250)

  dropdown.value = !dropdown.value
}

function closeDropdown() {
  if (!dropdownClicked.value)
    dropdown.value = false
}
</script>

<template>
  <div>
    <div class="flex flex-col lg:pl-64">
      <main class="flex-1">
        <TopBar @search="searchPages" />
        <div class="min-h-screen py-4 lg:py-8 dark:bg-gray-800">
          <div class="px-4 mb-8 sm:px-6 lg:px-8">
            <div class="grid grid-cols-1 gap-6 lg:grid-cols-3 md:grid-cols-2">
              <StatCard
                title="Total Pages"
                :data="115"
                :action="false"
              >
                <template #stat-card-logo>
                  <svg
                    class="w-8 h-8 text-gray-400"
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
                      d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                    />
                  </svg>
                </template>
              </StatCard>
            </div>
          </div>

          <div class="px-4 mb-8 sm:px-6 lg:px-8">
            <FilterSection
              title="Pages"
              button-text=""
              :show-filter="false"
              @new-record-action="createMember()"
              @filter-button-toggle="toggleDropdown()"
              @clear-filters="clearFilters"
            >
              <template #header-logo>
                <svg
                  class="flex-shrink-0 w-6 h-6 mr-3 text-gray-400 dark:text-gray-100 group-hover:text-gray-500 dark:text-gray-400"
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
                    d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                  />
                </svg>
              </template>

              <template
                #filter-dropdown
              >
                <transition
                  enter-active-class="transition duration-100 ease-out"
                  enter-from-class="transform scale-95 opacity-0"
                  enter-to-class="transform scale-100 opacity-100"
                  leave-active-class="transition duration-75 ease-in"
                  leave-from-class="transform scale-100 opacity-100"
                  leave-to-class="transform scale-95 opacity-0"
                >
                  <FilterBuilder
                    v-if="dropdown"
                    :keys="keys"
                    :values="values"
                    @close-dropdown="closeDropdown()"
                  />
                </transition>
              </template>
            </FilterSection>
          </div>

          <PagesTable />
        </div>
      </main>
    </div>
  </div>
</template>
