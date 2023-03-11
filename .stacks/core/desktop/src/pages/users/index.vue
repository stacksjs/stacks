<script setup lang="ts">
import { useUserStore } from '~/stores/user'
import { useFilter } from '~/stores/filters'

const router = useRouter()

const userStore = useUserStore()
const filterStore = useFilter()

onMounted(async () => {
  await fetchUserStats()
})

async function fetchUserStats() {
  await userStore.fetchUserCount()
  await userStore.fetchAgentsCount()
  await userStore.fetchRecruitsCount()
}

function createUser() {
  router.push({ name: 'users-create' })
}

async function searchUsers(search: string) {
  filterStore.setSearch(search)

  await userStore.fetchUsers({
    page: 1,
    search,
    filters: filterStore.filterVal,
    sort: filterStore.sort,
  })
}

function filterUsers() {
  let filters = []
  if (filterStore.filterRules[filterStore.filterKey]) {
    filters = filterStore.filterRules[filterStore.filterKey].map((filter: string) => {
      return `${[filterStore.filterKey]}='${filter}'`
    })
  }

  filterStore.setFilterVal(filters)

  userStore.fetchUsers({
    page: 1,
    filters,
    search: filterStore.search,
    sort: filterStore.sort,
  })
}

function clearFilters() {
  userStore.fetchUsers({ page: 1 })

  filterStore.clearFilters()
}
</script>

<template>
  <div>
    <div class="flex flex-col lg:pl-64">
      <main class="flex-1">
        <TopBar @search="searchUsers" />
        <div class="min-h-screen py-4 lg:py-8 dark:bg-gray-800">
          <div class="px-4 mb-8 sm:px-6 lg:px-8">
            <div class="grid grid-cols-1 gap-6 lg:grid-cols-3 md:grid-cols-2">
              <StatCard
                title="Total Users"
                :data="userStore.userCount"
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
                      d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z"
                    />
                  </svg>
                </template>
              </StatCard>

              <StatCard
                title="Total Agents"
                :data="userStore.agentCount"
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
                      d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z"
                    />
                  </svg>
                </template>
              </StatCard>

              <StatCard
                title="Total Recruits"
                :data="userStore.recruitCount"
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
                      d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z"
                    />
                  </svg>
                </template>
              </StatCard>
            </div>
          </div>

          <div
            v-if="userStore.hasUsers"
            class="px-4 mb-8 sm:px-6 lg:px-8"
          >
            <FilterSection
              ref="filterSection"
              title="User Management"
              button-text="User"
              :keys="userStore.filterableAttributes"
              :values="userStore.facetDistribution"
              :show-filter="true"
              @new-record-action="createUser()"
              @apply-filters="filterUsers()"
              @clear-filters="clearFilters"
              @remove-filter="filterUsers"
            >
              <template #header-logo>
                <svg
                  class="flex-shrink-0 mr-2 text-gray-400 w-7 h-7"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                  />
                </svg>
              </template>
            </FilterSection>
          </div>

          <div class="mt-4">
            <UsersTable />
          </div>
        </div>
      </main>
    </div>
  </div>
</template>
