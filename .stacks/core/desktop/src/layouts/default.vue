<script setup lang="ts">
import { watch } from 'vue'
import { useFilter } from '~/stores/filters'

const route = useRoute()
const router = useRouter()
const filterStore = useFilter()

const pubRoutes = ['login']

onMounted(() => {
  checkAuth(String(route.name))
})

watch(route, (current) => {
  checkAuth(String(current.name))
  filterStore.resetFilters()
})

function checkAuth(route: string) {
  if (!pubRoutes.includes(route)) {
    if (!isAuthenticated.value)
      router.push({ name: 'login' })
  }

  if (route === 'login') {
    if (isAuthenticated.value)
      router.push({ name: 'index' })
  }
}
</script>

<template>
  <div
    class="min-h-full bg-gray-50 dark:bg-gray-800"
    style="font-family: mona-sans"
  >
    <MobileSidebar />
    <div
      v-if="isAuthenticated"
      class="hidden bg-white dark:bg-gray-800 lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col lg:border-r backdrop-blur-sm dark:border-gray-600 lg:border-gray-200 lg:pt-5 lg:pb-4"
    >
      <div class="flex items-center flex-shrink-0 px-6">
        <img
          class="w-auto h-16"
          src="/carefree-logo-white.png"
          alt="Your Company"
        >
      </div>
      <!-- Sidebar component, swap this element with another sidebar if you like -->
      <Sidebar />
    </div>

    <Toast />

    <!-- Main column -->
    <RouterView />
  </div>
</template>
