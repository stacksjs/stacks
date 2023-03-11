<script setup lang="ts">
import { useUserStore } from '~/stores/user'
import { useWebpageStore } from '~/stores/webpage'

const userStore = useUserStore()
const webpageStore = useWebpageStore()

onMounted(async () => {
  await fetchUserCount()
  await fetchWebpageCount()
})

async function fetchUserCount() {
  await userStore.fetchUserCount()
}

async function fetchWebpageCount() {
  await webpageStore.fetchWebpageCount()
}
const router = useRouter()

function viewAllUsers() {
  router.push({ name: 'users' })
}

function viewAllWebpages() {
  router.push({ name: 'webpages' })
}
</script>

<template>
  <div class="grid grid-cols-1 gap-6 lg:grid-cols-3 md:grid-cols-2">
    <StatCard
      title="Total Users"
      :data="userStore.userCount"
      :action="true"
      @card-action="viewAllUsers()"
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
            d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z"
          />
        </svg>
      </template>
    </StatCard>

    <StatCard
      title="Total Webpages"
      :data="webpageStore.webpageCount"
      :action="true"
      @card-action="viewAllWebpages()"
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
            d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418"
          />
        </svg>
      </template>
    </StatCard>
  </div>
</template>
