<script setup lang="ts">
import { useEventStore } from '~/stores/event'
import { useFilter } from '~/stores/filters'

const router = useRouter()
const route = useRoute()
const eventStore = useEventStore()
const filterStore = useFilter()

function createEvent() {
  router.push({ name: 'events-create' })
}

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

function searchEvents(search: string) {
  filterStore.setSearch(search)

  eventStore.fetchEventRsvps(route.params.id, {
    page: 1,
    search,
    filters: filterStore.filterVal,
    sort: filterStore.sort,
  })
}

function filterEvents() {
  let filters = []
  if (filterStore.filterRules[filterStore.filterKey]) {
    filters = filterStore.filterRules[filterStore.filterKey].map((filter: string) => {
      return `${[filterStore.filterKey]}='${filter}'`
    })
  }

  filterStore.setFilterVal(filters)

  eventStore.fetchEventRsvps(route.params.id, {
    page: 1,
    filters,
    search: filterStore.search,
    sort: filterStore.sort,
  })
}

function clearFilters() {
  eventStore.fetchEventRsvps(route.params.id, { page: 1 })

  filterStore.clearFilters()
}
</script>

<template>
  <div>
    <div class="flex flex-col lg:pl-64">
      <main class="flex-1">
        <TopBar @search="searchEvents" />
        <div class="min-h-screen py-4 lg:py-8 dark:bg-gray-800">
          <div class="px-4 mb-8 sm:px-6 lg:px-8">
            <div class="grid grid-cols-1 gap-6 lg:grid-cols-3 md:grid-cols-2">
              <StatCard
                title="Total Attendees"
                :data="eventStore.results.estimatedTotalHits"
                :action="false"
              >
                <template #stat-card-logo>
                  <svg
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.5"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                    class="w-8 h-8 text-gray-400"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5m-9-6h.008v.008H12v-.008zM12 15h.008v.008H12V15zm0 2.25h.008v.008H12v-.008zM9.75 15h.008v.008H9.75V15zm0 2.25h.008v.008H9.75v-.008zM7.5 15h.008v.008H7.5V15zm0 2.25h.008v.008H7.5v-.008zm6.75-4.5h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V15zm0 2.25h.008v.008h-.008v-.008zm2.25-4.5h.008v.008H16.5v-.008zm0 2.25h.008v.008H16.5V15z"
                    />
                  </svg>
                </template>
              </StatCard>
            </div>
          </div>

          <div class="px-4 mb-8 sm:px-6 lg:px-8">
            <FilterSection
              v-if="eventStore.hasEvents"
              title="Event RSVPs"
              :show-filter="false"
              @new-record-action="createEvent()"
              @filter-button-toggle="toggleDropdown()"
              @clear-filters="clearFilters"
              @remove-filter="filterEvents"
            >
              <template #header-logo>
                <svg
                  class="flex-shrink-0 w-6 h-6 mr-3 text-gray-400 dark:text-gray-100 group-hover:text-gray-500 dark:text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </template>

              <template #filter-dropdown>
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
                    :keys="eventStore.filterableAttributes"
                    :values="eventStore.facetDistribution"
                    @close-dropdown="closeDropdown()"
                    @filter-apply="filterEvents"
                  />
                </transition>
              </template>
            </FilterSection>
          </div>

          <RsvpEventsTable />
        </div>
      </main>
    </div>
  </div>
</template>
