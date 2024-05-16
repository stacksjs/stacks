<template>
  <div>
    <!-- Static sidebar for desktop -->
    <div class="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
      <div class="flex grow flex-col gap-y-5 overflow-y-auto border-r border-gray-200 dark:border-gray-600 dark:border-gray-600 dark:bg-blue-gray-900 bg-white px-6 pb-4">
        <div class="flex h-16 shrink-0 items-center">
          <img
            class="h-12 rounded-lg mt-4 w-auto"
            src="/images/logos/logo.svg"
            alt="Stacks"
          >
        </div>
        <nav class="flex flex-1 flex-col">
          <ul
            role="list"
            class="flex flex-1 flex-col gap-y-8"
          >
            <li>
              <ul
                role="list"
                class="-mx-2 mt-2 space-y-1"
              >
                <li>
                  <RouterLink
                    to="/"
                    class="sidebar-links group"
                  >
                    <div class="i-heroicons-home text-gray-500 w-5 h-5 dark:text-gray-200 group-hover:text-gray-700 transition duration-150 ease-in-out" />
                    Dashboard
                  </RouterLink>
                </li>
              </ul>
            </li>

            <li>
              <div class="flex justify-between items-center">
                <div class="text-xs font-semibold leading-6 text-gray-400">
                  Library
                </div>

                <div class="i-heroicons-chevron-down text-gray-300 w-4 h-4 dark:text-gray-200 group-hover:text-gray-700 transition duration-150 ease-in-out" />
              </div>

              <ul
                role="list"
                class="-mx-2 mt-2 space-y-1"
              >
                <li>
                  <RouterLink
                    to="/functions"
                    class="sidebar-links group"
                  >
                    <div class="i-heroicons-code-bracket text-gray-500 w-5 h-5 dark:text-gray-200 group-hover:text-gray-700 transition duration-150 ease-in-out" />
                    Functions
                  </RouterLink>
                </li>

                <li>
                  <RouterLink
                    to="/components"
                    class="sidebar-links group"
                  >
                    <div class="i-heroicons-puzzle-piece text-gray-500 w-5 h-5 dark:text-gray-200 group-hover:text-gray-700 transition duration-150 ease-in-out" />
                    Components
                  </RouterLink>
                </li>

                <li>
                  <RouterLink
                    to="/releases"
                    class="sidebar-links group"
                  >
                    <div class="i-heroicons-building-library text-gray-500 w-5 h-5 dark:text-gray-200 group-hover:text-gray-700 transition duration-150 ease-in-out" />
                    Releases
                  </RouterLink>
                </li>
              </ul>
            </li>

            <li>
              <div class="flex justify-between items-center">
                <div class="text-xs font-semibold leading-6 text-gray-400">
                  App
                </div>

                <div class="i-heroicons-chevron-down text-gray-300 w-4 h-4 dark:text-gray-200 group-hover:text-gray-700 transition duration-150 ease-in-out" />
              </div>

              <ul
                role="list"
                class="-mx-2 mt-2 space-y-1"
              >
                <li>
                  <RouterLink
                    to="/deployments"
                    class="sidebar-links group"
                  >
                    <div class="i-heroicons-rocket-launch text-gray-500 w-5 h-5 dark:text-gray-200 group-hover:text-gray-700 transition duration-150 ease-in-out" />
                    Deployments
                  </RouterLink>
                </li>

                <li>
                  <RouterLink
                    to="/requests"
                    class="sidebar-links group"
                  >
                    <div class="i-heroicons-magnifying-glass text-gray-500 w-5 h-5 dark:text-gray-200 group-hover:text-gray-700 transition duration-150 ease-in-out" />
                    Requests
                  </RouterLink>
                </li>

                <li>
                  <RouterLink
                    to="/actions"
                    class="sidebar-links group"
                  >
                    <div class="i-heroicons-bolt text-gray-500 w-5 h-5 dark:text-gray-200 group-hover:text-gray-700 transition duration-150 ease-in-out" />
                    Actions
                  </RouterLink>
                </li>

                <li>
                  <RouterLink
                    to="/commands"
                    class="sidebar-links group"
                  >
                    <div class="i-heroicons-command-line text-gray-500 w-5 h-5 dark:text-gray-200 group-hover:text-gray-700 transition duration-150 ease-in-out" />
                    Commands
                  </RouterLink>
                </li>

                <li>
                  <RouterLink
                    to="/jobs"
                    class="sidebar-links group"
                  >
                    <div class="i-heroicons-queue-list text-gray-500 w-5 h-5 dark:text-gray-200 group-hover:text-gray-700 transition duration-150 ease-in-out" />
                    Jobs
                  </RouterLink>
                </li>

                <li>
                  <RouterLink
                    to="/notifications"
                    class="sidebar-links group"
                  >
                    <div class="i-heroicons-envelope text-gray-500 w-5 h-5 dark:text-gray-200 group-hover:text-gray-700 transition duration-150 ease-in-out" />
                    Notifications
                  </RouterLink>
                </li>
              </ul>
            </li>

            <li>
              <div class="flex justify-between items-center">
                <div class="text-xs font-semibold leading-6 text-gray-400">
                  Models
                </div>

                <div class="i-heroicons-chevron-down text-gray-300 w-4 h-4 dark:text-gray-200 group-hover:text-gray-700 transition duration-150 ease-in-out" />
              </div>

              <ul
                role="list"
                class="-mx-2 mt-2 space-y-1"
              >
                <li>
                  <!-- Current: "bg-gray-50 text-blue-600", Default: "text-gray-700 hover:text-blue-600 hover:bg-gray-50" -->
                  <RouterLink
                    to="/models/users"
                    class="sidebar-links"
                  >
                    <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border text-[0.625rem] font-medium bg-white text-gray-400 border-gray-200 dark:border-gray-600 group-hover:border-blue-600 group-hover:text-blue-600">U</span>
                    <span class="truncate">Users</span>
                  </RouterLink>
                </li>

                <li>
                  <RouterLink
                    to="/models/teams"
                    class="sidebar-links"
                  >
                    <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border text-[0.625rem] font-medium bg-white text-gray-400 border-gray-200 dark:border-gray-600 group-hover:border-blue-600 group-hover:text-blue-600">T</span>
                    <span class="truncate">Teams</span>
                  </RouterLink>
                </li>

                <li>
                  <RouterLink
                    to="/models/subscribers"
                    class="sidebar-links"
                  >
                    <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border text-[0.625rem] font-medium bg-white text-gray-400 border-gray-200 dark:border-gray-600 group-hover:border-blue-600 group-hover:text-blue-600">S</span>
                    <span class="truncate">Subscribers</span>
                  </RouterLink>
                </li>
              </ul>
            </li>

            <li>
              <div class="flex justify-between items-center">
                <div class="text-xs font-semibold leading-6 text-gray-400">
                  Management
                </div>

                <div class="i-heroicons-chevron-down text-gray-300 w-4 h-4 dark:text-gray-200 group-hover:text-gray-700 transition duration-150 ease-in-out" />
              </div>

              <ul
                role="list"
                class="-mx-2 mt-2 space-y-1"
              >
                <li>
                  <!-- Current: "bg-gray-50 text-blue-600", Default: "text-gray-700 hover:text-blue-600 hover:bg-gray-50" -->
                  <RouterLink
                    to="/dns"
                    class="sidebar-links"
                  >
                    <!-- <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border text-[0.625rem] font-medium bg-white text-gray-400 border-gray-200 dark:border-gray-600 group-hover:border-blue-600 group-hover:text-blue-600">U</span> -->
                    <div class="i-heroicons-document-magnifying-glass text-gray-500 w-5 h-5 dark:text-gray-200 group-hover:text-gray-700 transition duration-150 ease-in-out" />
                    <span class="truncate">DNS</span>
                  </RouterLink>
                </li>

                <li>
                  <!-- Current: "bg-gray-50 text-blue-600", Default: "text-gray-700 hover:text-blue-600 hover:bg-gray-50" -->
                  <RouterLink
                    to="/emails"
                    class="sidebar-links"
                  >
                    <!-- <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border text-[0.625rem] font-medium bg-white text-gray-400 border-gray-200 dark:border-gray-600 group-hover:border-blue-600 group-hover:text-blue-600">U</span> -->
                    <div class="i-heroicons-at-symbol text-gray-500 w-5 h-5 dark:text-gray-200 group-hover:text-gray-700 transition duration-150 ease-in-out" />
                    <span class="truncate">Emails</span>
                  </RouterLink>
                </li>

                <li>
                  <RouterLink
                    to="/logs"
                    class="sidebar-links group"
                  >
                    <div class="i-heroicons-document-text text-gray-500 w-5 h-5 dark:text-gray-200 group-hover:text-gray-700 transition duration-150 ease-in-out" />
                    Logs
                  </RouterLink>
                </li>
              </ul>
            </li>

            <li class="mt-auto flex items-center justify-between space-x-4">
              <div class="flex items-center">
                <RouterLink
                  to="/buddy"
                  class="px-3 py-3 text-sm font-semibold leading-6 text-gray-900 dark:text-gray-200 transition-all duration-150 ease-in-out flex items-center justify-center"
                  active-class="active"
                >
                  <div class="i-heroicons-chat-bubble-left-ellipsis text-gray-500 w-5 h-5 dark:text-gray-200 transition-all duration-150 ease-in-out" />
                </RouterLink>

                <RouterLink
                  to="/environment"
                  class="px-3 py-3 text-sm font-semibold leading-6 text-gray-900 dark:text-gray-200 transition-all duration-150 ease-in-out flex items-center justify-center"
                  active-class="active"
                >
                  <div class="i-heroicons-key text-gray-500 w-5 h-5 dark:text-gray-200 transition-all duration-150 ease-in-out" />
                </RouterLink>

                <RouterLink
                  to="/settings/billing"
                  class="px-3 py-3 text-sm font-semibold leading-6 text-gray-900 dark:text-gray-200 transition-all duration-150 ease-in-out flex items-center justify-center"
                  active-class="active"
                >
                  <div class="i-heroicons-cog-8-tooth text-gray-500 w-5 h-5 dark:text-gray-200 transition-all duration-150 ease-in-out" />
                </RouterLink>
              </div>
              <!-- <span class="inline-flex items-center rounded-md bg-slate-50 px-2 py-1 text-xs font-medium text-slate-700 ring-1 ring-inset ring-slate-600/20">Production</span> -->
              <!-- red for production -->
              <!-- blue for staging -->
              <!-- green for development -->
              <!-- gray for local -->
              <div class="flex-none rounded-full p-1 text-red-400 bg-red-400/10">
                <div class="h-2 w-2 rounded-full bg-current animate-pulse" />
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

.router-link-active, .router-link-exact-active {
  @apply dark:bg-blue-gray-700 bg-blue-gray-50 dark:text-blue-300 text-gray-600 flex items-center text-sm rounded-md !important
}
</style>
