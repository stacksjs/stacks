<script setup lang="ts">
// import IconButton from './Buttons/IconButton.vue'
// import Dropdown from './Elements/Dropdown.vue'
</script>

<template>
  <div>
    <!-- Static sidebar for desktop -->
    <div class="hidden lg:fixed lg:inset-y-0 lg:w-64 lg:flex lg:flex-col">
      <div
        class="flex grow flex-col gap-y-5 overflow-y-auto border-r border-gray-200 bg-white px-6 pb-4 dark:border-gray-600 dark:border-gray-600 dark:bg-blue-gray-900">
        <div class="h-16 flex shrink-0 items-center justify-between">
          <img class="mt-4 h-12 w-auto rounded-lg" src="/images/logos/logo.svg" alt="Stacks">

          <div
            class="i-hugeicons-ellipsis-horizontal mt-4 h-6 w-6 cursor-pointer text-gray-700 transition duration-150 ease-in-out hover:bg-gray-900 dark:text-gray-200 group-hover:text-gray-700 dark:hover:bg-blue-gray-100" />
        </div>
        <nav class="flex flex-1 flex-col">
          <ul role="list" class="flex flex-1 flex-col gap-y-8">
            <li>
              <ul role="list" class="mt-2 -mx-2 space-y-1">
                <li>
                  <RouterLink to="/" class="group sidebar-links">
                    <div
                      class="i-hugeicons-home-05 h-5 w-5 text-gray-500 transition duration-150 ease-in-out dark:text-gray-200 group-hover:text-gray-700" />
                    Dashboard
                  </RouterLink>
                </li>
              </ul>
            </li>

            <li>
              <!-- <Dropdown
                label="Library"
                open
                :elements="[
                  { to: '/', label: 'Components' },
                  { to: '/', label: 'Functions' },
                  { to: '/', label: 'Composability' },
                  { to: '/', label: 'Publishing' },
                ]"/> -->
            </li>

            <li>
              <div class="flex items-center justify-between">
                <div class="text-xs text-gray-400 font-semibold leading-6">
                  Library
                </div>

                <div
                  class="i-hugeicons-arrow-down-01 h-4 w-4 text-gray-300 transition duration-150 ease-in-out dark:text-gray-200 group-hover:text-gray-700" />
              </div>

              <ul role="list" class="mt-2 -mx-2 space-y-1">
                <li>
                  <!-- <IconButton to="/functions">
                    Functions
                  </IconButton> -->
                </li>

                <li>
                  <RouterLink to="/components" class="sidebar-links group">
                    <div
                      class="i-hugeicons-puzzle h-5 w-5 text-gray-500 transition duration-150 ease-in-out dark:text-gray-200 group-hover:text-gray-700" />
                    Components
                  </RouterLink>
                </li>

                <li>
                  <RouterLink to="/releases" class="sidebar-links group">
                    <div class="i-hugeicons-right-to-left-list-number h-5 w-5 text-gray-500 transition duration-150 ease-in-out dark:text-gray-200 group-hover:text-gray-700" />
                    Releases
                  </RouterLink>
                </li>

                <li>
                  <RouterLink to="/packages" class="sidebar-links group">
                    <div
                      class="i-hugeicons-package h-5 w-5 text-gray-500 transition duration-150 ease-in-out dark:text-gray-200 group-hover:text-gray-700" />
                    Packages
                  </RouterLink>
                </li>
              </ul>
            </li>

            <li>
              <div class="flex items-center justify-between">
                <div class="text-xs text-gray-400 font-semibold leading-6">
                  App
                </div>

                <div
                  class="i-hugeicons-arrow-down-01 h-4 w-4 text-gray-300 transition duration-150 ease-in-out dark:text-gray-200 group-hover:text-gray-700" />
              </div>

              <ul role="list" class="mt-2 -mx-2 space-y-1">
                <li>
                  <RouterLink to="/deployments" class="sidebar-links group">
                    <div
                      class="i-hugeicons-rocket h-5 w-5 text-gray-500 transition duration-150 ease-in-out dark:text-gray-200 group-hover:text-gray-700" />
                    Deployments
                  </RouterLink>
                </li>

                <li>
                  <RouterLink to="/requests" class="sidebar-links group">
                    <div
                      class="i-hugeicons-search-01 h-5 w-5 text-gray-500 transition duration-150 ease-in-out dark:text-gray-200 group-hover:text-gray-700" />
                    Requests
                  </RouterLink>
                </li>

                <li>
                  <RouterLink to="/actions" class="sidebar-links group">
                    <div class="i-hugeicons-function-of-x h-5 w-5 text-gray-500 transition duration-150 ease-in-out dark:text-gray-200 group-hover:text-gray-700" />
                    Actions
                  </RouterLink>
                </li>

                <li>
                  <RouterLink to="/commands" class="sidebar-links group">
                    <div
                      class="i-hugeicons-command-line h-5 w-5 text-gray-500 transition duration-150 ease-in-out dark:text-gray-200 group-hover:text-gray-700" />
                    Commands
                  </RouterLink>
                </li>

                <li>
                  <RouterLink to="/jobs" class="sidebar-links group">
                    <div
                      class="i-hugeicons-queue-02 h-5 w-5 text-gray-500 transition duration-150 ease-in-out dark:text-gray-200 group-hover:text-gray-700" />
                    Jobs
                  </RouterLink>
                </li>

                <li>
                  <RouterLink to="/notifications" class="sidebar-links group">
                    <div
                      class="i-hugeicons-notification-square h-5 w-5 text-gray-500 transition duration-150 ease-in-out dark:text-gray-200 group-hover:text-gray-700" />
                    Notifications
                  </RouterLink>
                </li>
              </ul>
            </li>

            <li>
              <div class="flex items-center justify-between">
                <div class="text-xs text-gray-400 font-semibold leading-6">
                  Models
                </div>

                <div
                  class="i-hugeicons-arrow-down-01 h-4 w-4 text-gray-300 transition duration-150 ease-in-out dark:text-gray-200 group-hover:text-gray-700" />
              </div>

              <ul role="list" class="mt-2 -mx-2 space-y-1">
                <li>
                  <!-- Current: "bg-gray-50 text-blue-600", Default: "text-gray-700 hover:text-blue-600 hover:bg-gray-50" -->
                  <RouterLink to="/models/users" class="sidebar-links">
                    <span
                      class="h-6 w-6 flex shrink-0 items-center justify-center border border-gray-200 rounded-lg bg-white text-[0.625rem] text-gray-400 font-medium dark:border-gray-600 group-hover:border-blue-600 group-hover:text-blue-600">U</span>
                    <span class="truncate">Users</span>
                  </RouterLink>
                </li>

                <li>
                  <RouterLink to="/models/teams" class="sidebar-links">
                    <span
                      class="h-6 w-6 flex shrink-0 items-center justify-center border border-gray-200 rounded-lg bg-white text-[0.625rem] text-gray-400 font-medium dark:border-gray-600 group-hover:border-blue-600 group-hover:text-blue-600">T</span>
                    <span class="truncate">Teams</span>
                  </RouterLink>
                </li>

                <li>
                  <RouterLink to="/models/subscribers" class="sidebar-links">
                    <span
                      class="h-6 w-6 flex shrink-0 items-center justify-center border border-gray-200 rounded-lg bg-white text-[0.625rem] text-gray-400 font-medium dark:border-gray-600 group-hover:border-blue-600 group-hover:text-blue-600">S</span>
                    <span class="truncate">Subscribers</span>
                  </RouterLink>
                </li>
              </ul>
            </li>

            <li>
              <div class="flex items-center justify-between">
                <div class="text-xs text-gray-400 font-semibold leading-6">
                  Management
                </div>

                <div
                  class="i-hugeicons-arrow-down-01 h-4 w-4 text-gray-300 transition duration-150 ease-in-out dark:text-gray-200 group-hover:text-gray-700" />
              </div>

              <ul role="list" class="mt-2 -mx-2 space-y-1">
                <li>
                  <!-- Current: "bg-gray-50 text-blue-600", Default: "text-gray-700 hover:text-blue-600 hover:bg-gray-50" -->
                  <RouterLink to="/dns" class="sidebar-links">
                    <!-- <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border text-[0.625rem] font-medium bg-white text-gray-400 border-gray-200 dark:border-gray-600 group-hover:border-blue-600 group-hover:text-blue-600">U</span> -->
                    <div
                      class="i-hugeicons-global-search h-5 w-5 text-gray-500 transition duration-150 ease-in-out dark:text-gray-200 group-hover:text-gray-700" />
                    <span class="truncate">DNS</span>
                  </RouterLink>
                </li>

                <li>
                  <!-- Current: "bg-gray-50 text-blue-600", Default: "text-gray-700 hover:text-blue-600 hover:bg-gray-50" -->
                  <RouterLink to="/emails" class="sidebar-links">
                    <!-- <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border text-[0.625rem] font-medium bg-white text-gray-400 border-gray-200 dark:border-gray-600 group-hover:border-blue-600 group-hover:text-blue-600">U</span> -->
                    <div
                      class="i-hugeicons-at h-5 w-5 text-gray-500 transition duration-150 ease-in-out dark:text-gray-200 group-hover:text-gray-700" />
                    <span class="truncate">Emails</span>
                  </RouterLink>
                </li>

                <li>
                  <RouterLink to="/logs" class="sidebar-links group">
                    <div
                      class="i-hugeicons-search-list-01 h-5 w-5 text-gray-500 transition duration-150 ease-in-out dark:text-gray-200 group-hover:text-gray-700" />
                    Logs
                  </RouterLink>
                </li>
              </ul>
            </li>

            <li class="mt-auto flex items-center justify-between space-x-4">
              <div class="flex items-center">
                <RouterLink to="/buddy"
                  class="flex items-center justify-center px-3 py-3 text-sm text-gray-900 font-semibold leading-6 transition-all duration-150 ease-in-out dark:text-gray-200"
                  active-class="active">
                  <div
                    class="i-hugeicons-bubble-chat h-5 w-5 text-gray-500 transition-all duration-150 ease-in-out dark:text-gray-200" />
                </RouterLink>

                <RouterLink to="/environment"
                  class="flex items-center justify-center px-3 py-3 text-sm text-gray-900 font-semibold leading-6 transition-all duration-150 ease-in-out dark:text-gray-200"
                  active-class="active">
                  <div
                    class="i-hugeicons-key-01 h-5 w-5 text-gray-500 transition-all duration-150 ease-in-out dark:text-gray-200" />
                </RouterLink>

                <RouterLink to="/settings/ai"
                  class="flex items-center justify-center px-3 py-3 text-sm text-gray-900 font-semibold leading-6 transition-all duration-150 ease-in-out dark:text-gray-200"
                  active-class="active">
                  <div
                    class="i-hugeicons-settings-02 h-5 w-5 text-gray-500 transition-all duration-150 ease-in-out dark:text-gray-200" />
                </RouterLink>
              </div>
              <!-- <span class="inline-flex items-center rounded-md bg-slate-50 px-2 py-1 text-xs font-medium text-slate-700 ring-1 ring-inset ring-slate-600/20">Production</span> -->
              <!-- red for production -->
              <!-- blue for staging -->
              <!-- green for development -->
              <!-- gray for local -->
              <div class="flex-none rounded-full bg-red-400/10 p-1 text-red-400">
                <div class="h-2 w-2 animate-pulse rounded-full bg-current" />
              </div>
            </li>
          </ul>
        </nav>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sidebar-links {
  @apply text-blue-gray-600 dark:text-blue-gray-200 hover:text-blue-gray-800 duration-150 ease-in-out transition dark-hover:bg-gray-700 hover:bg-blue-gray-50 flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold
}
</style>
