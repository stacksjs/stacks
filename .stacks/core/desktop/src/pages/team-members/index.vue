<script setup lang="ts">
import { useUserStore } from '~/stores/user'
import { useFilter } from '~/stores/filters'

const router = useRouter()
const filterStore = useFilter()
const userStore = useUserStore()

onMounted(async () => {
  await userStore.fetchMemberCount()
})

function createMember() {
  router.push({ name: 'team-members-create' })
}

function searchTeamMembers(search: string) {
  filterStore.setSearch(search)

  userStore.fetchTeamMembers({
    page: 1,
    search,
    filters: filterStore.filterVal,
    sort: filterStore.sort,
  })
}

function clearFilters() {
  userStore.fetchTeamMembers({ page: 1 })

  filterStore.clearFilters()
}

function filterTeamMembers() {
  let filters = []
  if (filterStore.filterRules[filterStore.filterKey]) {
    filters = filterStore.filterRules[filterStore.filterKey].map((filter: string) => {
      return `${[filterStore.filterKey]}='${filter}'`
    })
  }

  filterStore.setFilterVal(filters)

  userStore.fetchTeamMembers({
    page: 1,
    filters,
    search: filterStore.search,
    sort: filterStore.sort,
  })
}
</script>

<template>
  <div>
    <div class="flex flex-col lg:pl-64">
      <main class="flex-1">
        <TopBar @search="searchTeamMembers" />
        <div class="min-h-screen py-4 lg:py-8 dark:bg-gray-800">
          <div class="px-4 mb-8 sm:px-6 lg:px-8">
            <div class="grid grid-cols-1 gap-6 lg:grid-cols-3 md:grid-cols-2">
              <StatCard
                title="Total Members"
                :data="userStore.memberCount"
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
                      d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
                    />
                  </svg>
                </template>
              </StatCard>
            </div>
          </div>

          <div class="px-4 mb-8 sm:px-6 lg:px-8">
            <FilterSection
              title="Team Members"
              button-text="Team Member"
              :show-filter="true"
              :keys="userStore.filterableAttributes"
              :values="userStore.facetDistribution"
              @new-record-action="createMember()"
              @apply-filters="filterTeamMembers"
              @clear-filters="clearFilters"
              @remove-filter="filterTeamMembers"
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
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
              </template>
            </FilterSection>
          </div>

          <MembersTable />
        </div>
      </main>
    </div>
  </div>
</template>
