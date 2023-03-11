<script setup lang="ts">
import { useWebpageStore } from '~/stores/webpage'
import { useFilter } from '~/stores/filters'

const webpageStore = useWebpageStore()

const filterStore = useFilter()

onMounted(async () => {
  await fetchWebpageCount()
  await fetchLeadCount()
})
async function searchWebpages(search: string) {
  filterStore.setSearch(search)

  await webpageStore.fetchWebpages({
    page: 1,
    search,
    filters: filterStore.filterVal,
    sort: filterStore.sort,
  })
}

async function fetchWebpageCount() {
  await webpageStore.fetchWebpageCount()
}
async function fetchLeadCount() {
  await webpageStore.fetchLeadCount()
}

function filterWebpages() {
  let filters = []
  if (filterStore.filterRules[filterStore.filterKey]) {
    filters = filterStore.filterRules[filterStore.filterKey].map((filter: string) => {
      return `${[filterStore.filterKey]}='${filter}'`
    })
  }

  filterStore.setFilterVal(filters)

  webpageStore.fetchWebpages({
    page: 1,
    search: filterStore.search,
    filters,
    sort: filterStore.sort,
  })
}

function clearFilters() {
  webpageStore.fetchWebpages({ page: 1 })

  filterStore.clearFilters()
}
</script>

<template>
  <div>
    <div class="flex flex-col lg:pl-64">
      <main class="flex-1">
        <TopBar @search="searchWebpages" />
        <div class="py-4 lg:py-8 dark:bg-gray-800">
          <div class="px-4 mb-8 sm:px-6 lg:px-8">
            <div class="grid grid-cols-1 gap-6 lg:grid-cols-3 md:grid-cols-2">
              <StatCard
                title="Total Leads"
                :data="webpageStore.webpageCount"
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
                      d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12l-3-3m0 0l-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                    />
                  </svg>
                </template>
              </StatCard>

              <StatCard
                title="Total Webpages"
                :data="webpageStore.leadCount"
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
                      d="M6.115 5.19l.319 1.913A6 6 0 008.11 10.36L9.75 12l-.387.775c-.217.433-.132.956.21 1.298l1.348 1.348c.21.21.329.497.329.795v1.089c0 .426.24.815.622 1.006l.153.076c.433.217.956.132 1.298-.21l.723-.723a8.7 8.7 0 002.288-4.042 1.087 1.087 0 00-.358-1.099l-1.33-1.108c-.251-.21-.582-.299-.905-.245l-1.17.195a1.125 1.125 0 01-.98-.314l-.295-.295a1.125 1.125 0 010-1.591l.13-.132a1.125 1.125 0 011.3-.21l.603.302a.809.809 0 001.086-1.086L14.25 7.5l1.256-.837a4.5 4.5 0 001.528-1.732l.146-.292M6.115 5.19A9 9 0 1017.18 4.64M6.115 5.19A8.965 8.965 0 0112 3c1.929 0 3.716.607 5.18 1.64"
                    />
                  </svg>
                </template>
              </StatCard>
            </div>
          </div>

          <div class="px-4 mb-8 sm:px-6 lg:px-8">
            <FilterSection
              title="Webpages"
              button-text=""
              :show-filter="true"
              :keys="webpageStore.filterableAttributes"
              :values="webpageStore.facetDistribution"
              @clear-filters="clearFilters"
              @apply-filters="filterWebpages()"
              @remove-filter="filterWebpages"
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
                    d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
                  />
                </svg>
              </template>
            </FilterSection>
          </div>
          <WebpagesTable />
        </div>
      </main>
    </div>
  </div>
</template>
