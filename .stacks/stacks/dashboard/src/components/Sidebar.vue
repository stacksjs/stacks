<template>
  <div>
    <!-- Static sidebar for desktop -->
    <div class="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-72 lg:flex-col">
      <!-- Sidebar component, swap this element with another sidebar if you like -->
      <div class="flex grow flex-col gap-y-5 overflow-y-auto border-r border-gray-200 dark:border-gray-600 dark:border-gray-600 dark:bg-gray-900 bg-white px-6 pb-4">
        <div class="flex h-16 shrink-0 items-center">
          <img
            class="h-12 rounded-md mt-4 w-auto"
            src="/stacks.png"
            alt="Your Company"
          >
        </div>
        <nav class="flex flex-1 flex-col">
          <ul
            role="list"
            class="flex flex-1 flex-col gap-y-7"
          >
            <li>
              <ul
                role="list"
                class="-mx-2 space-y-1"
              >
                <li>
                  <!-- Current: "bg-gray-50 text-blue-600", Default: "text-gray-700 hover:text-blue-600 hover:bg-gray-50" -->
                  <router-link
                    to="/"
                    class="sidebar-links group"
                  >
                    <div class="i-heroicons-home w-6 h-6" />
                    Dashboard
                  </router-link>
                </li>
                <li>
                  <router-link
                    to="/deployments"
                    class="sidebar-links group"
                  >
                    <div class="i-heroicons-clock w-6 h-6" />
                    Deployments
                  </router-link>
                </li>
                <li>
                  <router-link
                    to="/commands"
                    class="sidebar-links group"
                  >
                    <div class="i-heroicons-command-line w-6 h-6" />
                    Commands
                  </router-link>
                </li>
                <li>
                  <router-link
                    to="/dns"
                    class="sidebar-links group"
                  >
                    <div class="i-heroicons-cloud w-6 h-6" />
                    DNS
                  </router-link>
                </li>
                <li>
                  <router-link
                    to="/environment"
                    class="sidebar-links group"
                  >
                    <div class="i-heroicons-cpu-chip w-6 h-6" />
                    Environment
                  </router-link>
                </li>
                <li>
                  <router-link
                    to="/dependencies"
                    class="sidebar-links group"
                  >
                    <div class="i-heroicons-cube w-6 h-6" />
                    Dependencies
                  </router-link>
                </li>
                <li>
                  <router-link
                    to="/queue"
                    class="sidebar-links group"
                  >
                    <div class="i-heroicons-queue-list w-6 h-6" />
                    Queue
                  </router-link>
                </li>
                <li>
                  <router-link
                    to="/library"
                    class="sidebar-links group"
                  >
                    <div class="i-heroicons-building-library w-6 h-6" />
                    Library
                  </router-link>
                </li>
                <li>
                  <router-link
                    to="/health"
                    class="sidebar-links group"
                  >
                    <div class="i-heroicons-heart w-6 h-6" />
                    Health
                  </router-link>
                </li>
              </ul>
            </li>
            <li>
              <div class="text-xs font-semibold leading-6 text-gray-400">
                Your Models
              </div>
              <ul
                role="list"
                class="-mx-2 mt-2 space-y-1"
              >
                <li>
                  <!-- Current: "bg-gray-50 text-blue-600", Default: "text-gray-700 hover:text-blue-600 hover:bg-gray-50" -->
                  <router-link
                    to="/models/users"
                    class="sidebar-links"
                  >
                    <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border text-[0.625rem] font-medium bg-white text-gray-400 border-gray-200 dark:border-gray-600 group-hover:border-blue-600 group-hover:text-blue-600">U</span>
                    <span class="truncate">Users</span>
                  </router-link>
                </li>
                <li>
                  <router-link
                    to="/models/events"
                    class="sidebar-links"
                  >
                    <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border text-[0.625rem] font-medium bg-white text-gray-400 border-gray-200 dark:border-gray-600 group-hover:border-blue-600 group-hover:text-blue-600">E</span>
                    <span class="truncate">Events</span>
                  </router-link>
                </li>
              </ul>
            </li>
            <li>
              <div class="text-xs font-semibold leading-6 text-gray-400">
                Your teams
              </div>
              <ul
                role="list"
                class="-mx-2 mt-2 space-y-1"
              >
                <li>
                  <!-- Current: "bg-gray-50 text-blue-600", Default: "text-gray-700 hover:text-blue-600 hover:bg-gray-50" -->
                  <router-link
                    to="/teams/1"
                    class="sidebar-links"
                  >
                    <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border text-[0.625rem] font-medium bg-white text-gray-400 border-gray-200 dark:border-gray-600 group-hover:border-blue-600 group-hover:text-blue-600">H</span>
                    <span class="truncate">Team A</span>
                  </router-link>
                </li>
                <li>
                  <!-- Current: "bg-gray-50 text-blue-600", Default: "text-gray-700 hover:text-blue-600 hover:bg-gray-50" -->
                  <router-link
                    to="/teams/2"
                    class="sidebar-links"
                  >
                    <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border text-[0.625rem] font-medium bg-white text-gray-400 border-gray-200 dark:border-gray-600 group-hover:border-blue-600 group-hover:text-blue-600">H</span>
                    <span class="truncate">Team B</span>
                  </router-link>
                </li>
                <li>
                  <!-- Current: "bg-gray-50 text-blue-600", Default: "text-gray-700 hover:text-blue-600 hover:bg-gray-50" -->
                  <router-link
                    to="/teams/3"
                    class="sidebar-links"
                  >
                    <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border text-[0.625rem] font-medium bg-white text-gray-400 border-gray-200 dark:border-gray-600 group-hover:border-blue-600 group-hover:text-blue-600">H</span>
                    <span class="truncate">Team C</span>
                  </router-link>
                </li>
              </ul>
            </li>
            <li class="mt-auto">
              <router-link
                to="/settings/cache"
                class="sidebar-links group"
              >
                <div class="i-heroicons-cog w-6 h-6" />
                Settings
              </router-link>
            </li>
          </ul>
        </nav>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sidebar-links {
  @apply text-gray-700 dark:text-gray-200 hover:text-blue-600 dark-hover:bg-gray-700 hover:bg-blue-50 flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold
}

.router-link-active, .router-link-exact-active {
  @apply dark:bg-gray-700 bg-gray-50 dark:text-blue-300 text-blue-600 p-2 flex items-center text-sm rounded-md !important
}
</style>
