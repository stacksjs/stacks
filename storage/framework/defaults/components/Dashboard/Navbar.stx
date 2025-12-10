<script setup lang="ts">
import { useDark, useLocalStorage } from '@vueuse/core'
import { ref, watch, computed } from 'vue'
import Tooltip from './Tooltip.vue'

import { useAuth } from '../../functions/auth'

const router = useRouter()

const route = useRoute()

const showDropdown = ref(false)
const isDark = useDark()
const theme = ref(isDark.value ? 'dark' : 'light')

// Import the sidebar collapsed state from localStorage
const isSidebarCollapsed = useLocalStorage('sidebar-collapsed', false)

// Compute classes based on sidebar state
const navbarClasses = computed(() => {
  return {
    'navbar-expanded': !isSidebarCollapsed.value,
    'navbar-collapsed': isSidebarCollapsed.value
  }
})

watch(theme, (currentVal) => {
  if (currentVal === 'light')
    isDark.value = false
  else isDark.value = true

  useToggle(isDark)
})

const { logout } = useAuth()

async function doLogout() {
  await logout()
  router.push('/login')
}
</script>

<template>
  <div
    class="sticky top-0 z-10 h-16 flex shrink-0 items-center gap-x-4 border-b border-gray-200 bg-white px-4 shadow-sm sm:gap-x-6 dark:border-gray-600 dark:border-gray-600 dark:bg-blue-gray-900 lg:px-8 sm:px-6 transition-all duration-300"
    :class="navbarClasses"
  >
    <Tooltip text="Open sidebar" :dark="isDark" :usePortal="true">
      <button type="button" class="p-2.5 text-gray-700 -m-2.5 lg:hidden">
        <span class="sr-only">Open sidebar</span>
        <div class="i-hugeicons-menu-01 h-6 w-6" />
      </button>
    </Tooltip>

    <!-- Separator -->
    <div class="h-6 w-px bg-gray-200 lg:hidden" aria-hidden="true" />

    <div class="flex flex-1 self-stretch gap-x-4 lg:gap-x-6">
      <form
        class="relative flex flex-1"
        action="#"
        method="GET"
      >
        <label for="search-field" class="sr-only">Search</label>

        <div class="i-hugeicons-search-01 pointer-events-none absolute inset-y-0 left-0 h-full w-5 text-gray-400" />
        <input
          id="search-field"
          class="block h-full w-full border-none py-0 pl-8 pr-0 text-gray-900 dark:bg-blue-gray-900 sm:text-sm dark:text-gray-100 placeholder:text-gray-400 focus:ring-0"
          placeholder="Search..."
          type="search"
          name="search"
        >
      </form>
      <div class="flex items-center gap-x-4 lg:gap-x-6">
        <Tooltip text="View Errors" :dark="isDark" :usePortal="true">
          <button
            type="button"
            class="header-icon-button"
          >
            <span class="sr-only">View Errors</span>
            <RouterLink
              to="/errors"
              class="header-link"
              :class="{ 'active-header-link': route.path === '/errors' }"
            >
              <div class="i-hugeicons-alert-01 h-6 w-6 transition duration-150 ease-in-out" />
            </RouterLink>
          </button>
        </Tooltip>

        <Tooltip text="View Health Page" :dark="isDark" :usePortal="true">
          <button
            type="button"
            class="header-icon-button"
          >
            <span class="sr-only">View Health Page</span>
            <RouterLink
              to="/health"
              class="header-link"
              :class="{ 'active-header-link': route.path === '/health' }"
            >
              <div class="i-hugeicons-health h-6 w-6 transition duration-150 ease-in-out" />
            </RouterLink>
          </button>
        </Tooltip>

        <Tooltip text="View Cloud Insights Page" :dark="isDark" :usePortal="true">
          <button
            type="button"
            class="header-icon-button"
          >
            <span class="sr-only">View Cloud Insights Page</span>
            <RouterLink
              to="/insights"
              class="header-link"
              :class="{ 'active-header-link': route.path === '/insights' }"
            >
              <div class="i-hugeicons-pulse-01 h-6 w-6 transition duration-150 ease-in-out" />
            </RouterLink>
          </button>
        </Tooltip>

        <Tooltip text="View Inbox" :dark="isDark" :usePortal="true">
          <button
            type="button"
            class="header-icon-button"
          >
            <span class="sr-only">View Inbox</span>
            <RouterLink
              to="/inbox"
              class="header-link"
              :class="{ 'active-header-link': route.path.startsWith('/inbox') }"
            >
              <div class="i-hugeicons-mail-02 h-6 w-6 transition duration-150 ease-in-out" />
            </RouterLink>
          </button>
        </Tooltip>

        <Tooltip text="View notifications" :dark="isDark" :usePortal="true">
          <button
            type="button"
            class="header-icon-button"
          >
            <span class="sr-only">View notifications</span>
            <RouterLink
              to="/notifications"
              class="header-link"
              :class="{ 'active-header-link': route.path === '/notifications' }"
            >
              <div class="i-hugeicons-notification-02 h-6 w-6" />
            </RouterLink>
          </button>
        </Tooltip>

        <!-- Separator -->
        <div
          class="hidden lg:block lg:h-6 lg:w-px lg:bg-gray-200"
          aria-hidden="true"
        />

        <!-- Profile dropdown -->
        <div class="relative ml-3">
          <div>
            <Tooltip :text="$user?.name || 'User profile'" :dark="isDark" :usePortal="true">
              <button id="user-menu-button" type="button" class="relative flex rounded-full bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-white focus:ring-offset-gray-800" aria-expanded="false" aria-haspopup="true" @click="showDropdown = !showDropdown">
                <span class="absolute -inset-1.5" />
                <span class="sr-only">Open user menu</span>
                <img class="h-8 w-8 rounded-full" src="https://avatars.githubusercontent.com/u/6228425" alt="">
              </button>
            </Tooltip>
          </div>

          <transition
            enter-active-class="transition ease-out duration-100"
            enter-from-class="transform opacity-0 scale-95"
            enter-to-class="transform opacity-100 scale-100"
            leave-active-class="transition ease-in duration-75"
            leave-from-class="transform opacity-100 scale-100"
            leave-to-class="transform opacity-0 scale-95"
          >
            <div v-show="showDropdown" class="absolute right-0 z-10 mt-2 w-48 origin-top-right rounded-md bg-white dark:bg-blue-gray-800 py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none" role="menu" aria-orientation="vertical" aria-labelledby="user-menu-button" tabindex="-1">
              <!-- Active: "bg-gray-100", Not Active: "" -->
              <a id="user-menu-item-0" href="#" class="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700" role="menuitem" tabindex="-1">Your Profile</a>
              <a id="user-menu-item-0" href="#" class="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700" role="menuitem" tabindex="-1">Documentation</a>
              <a id="user-menu-item-1" href="#" class="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700" role="menuitem" tabindex="-1">Billing</a>
              <a id="user-menu-item-1" href="#" class="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700" role="menuitem" tabindex="-1">Settings</a>
              <a id="user-menu-item-2" @click="doLogout" href="#" class="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700" role="menuitem" tabindex="-1">Sign out</a>
              <a
                id="user-menu-item-4"
                href="#"
                class="my-1 flex justify-between px-4 py-2 text-sm text-gray-500 dark:text-gray-400 leading-6 hover:bg-blue-gray-50 hover:text-blue-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-200"
                role="menuitem"
                tabindex="-1"
              >
                <label for="small" class="mr-2 self-center text-sm text-gray-500 dark:text-gray-300">
                  Theme
                </label>

                <select
                  id="small"
                  v-model="theme"
                  class="border border-gray-300 rounded-lg bg-gray-50 text-sm text-gray-500 dark:border-gray-600 focus:border-blue-500 dark:bg-blue-gray-700 dark:text-white focus:ring-blue-500 dark:focus:border-blue-500 dark:focus:ring-blue-500 dark:placeholder-gray-400"
                >
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                  <option value="light">Auto</option>
                </select>
              </a>
            </div>
          </transition>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.header-icon-button {
  @apply p-2.5 -m-2.5;
}

.header-link {
  @apply text-gray-400 hover:text-blue-gray-500 transition-colors duration-150;
}

.header-link div {
  @apply transition-colors duration-150;
}

.active-header-link {
  @apply text-blue-600 dark:text-blue-400;
}

.active-header-link div {
  @apply text-blue-600 dark:text-blue-400;
}

/* Update dropdown menu items */
.user-menu-item {
  @apply block px-4 py-2 text-sm text-gray-700 hover:bg-blue-gray-50 hover:text-blue-gray-600;
}

.user-menu-item.active {
  @apply bg-blue-gray-50 text-blue-600;
}

/* Navbar responsive styles - width only, no margin */
.navbar-expanded {
  width: 100%;
}

.navbar-collapsed {
  width: 100%;
}

@media (max-width: 1023px) {
  .navbar-expanded,
  .navbar-collapsed {
    width: 100%;
  }
}
</style>
