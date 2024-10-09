<template>
  <header class="border-b border-gray-200 p-4 lg:w-92 dark:border-gray-600 lg:p-8 sm:p-6">
    <div class="w-full rounded-lg bg-white p-4 shadow-sm">
      <h3 class="text-gray-700 font-semibold md:text-sm">
        Stacks Settings
      </h3>
      <p class="mt-2 text-sm text-gray-500">
        List of available settings
      </p>
    </div>
    <!-- Side navigation -->
    <nav class="mt-4 w-full flex flex-1 flex-col rounded-lg bg-white p-4 shadow-sm">
      <ul
        role="list"
        class="mt-2 -mx-2 space-y-1"
      >
        <li>
          <RouterLink to="ai" class="sidebar-links group flex items-center justify-between">
            <div class="flex items-center gap-x-2">
              <div class="i-heroicons-sparkles h-5 w-5 text-gray-500 transition duration-150 ease-in-out dark:text-gray-200 group-hover:text-gray-700" />
              AI
            </div>
            <div class="i-heroicons-chevron-right h-5 w-5 self-end text-gray-500 transition duration-150 ease-in-out dark:text-gray-200 group-hover:text-gray-700" />
          </RouterLink>
        </li>
        <li>
          <RouterLink to="analytics" class="sidebar-links group flex items-center justify-between">
            <div class="flex items-center gap-x-2">
              <div class="i-heroicons-chart-bar h-5 w-5 text-gray-500 transition duration-150 ease-in-out dark:text-gray-200 group-hover:text-gray-700" />
              Analytics
            </div>
            <div class="i-heroicons-chevron-right h-5 w-5 self-end text-gray-500 transition duration-150 ease-in-out dark:text-gray-200 group-hover:text-gray-700" />
          </RouterLink>
        </li>
        <li>
          <RouterLink to="app" class="sidebar-links group flex items-center justify-between">
            <div class="flex items-center gap-x-2">
              <div class="i-heroicons-cog-6-tooth h-5 w-5 text-gray-500 transition duration-150 ease-in-out dark:text-gray-200 group-hover:text-gray-700" />
              App
            </div>
            <div class="i-heroicons-chevron-right h-5 w-5 self-end text-gray-500 transition duration-150 ease-in-out dark:text-gray-200 group-hover:text-gray-700" />
          </RouterLink>
        </li>
        <li>
          <RouterLink to="cache" class="sidebar-links group flex items-center justify-between">
            <div class="flex items-center gap-x-2">
              <div class="i-heroicons-server h-5 w-5 text-gray-500 transition duration-150 ease-in-out dark:text-gray-200 group-hover:text-gray-700" />
              Cache
            </div>
            <div class="i-heroicons-chevron-right h-5 w-5 self-end text-gray-500 transition duration-150 ease-in-out dark:text-gray-200 group-hover:text-gray-700" />
          </RouterLink>
        </li>
        <li>
          <RouterLink to="cli" class="sidebar-links group flex items-center justify-between">
            <div class="flex items-center gap-x-2">
              <div class="i-heroicons-command-line h-5 w-5 text-gray-500 transition duration-150 ease-in-out dark:text-gray-200 group-hover:text-gray-700" />
              CLI
            </div>
            <div class="i-heroicons-chevron-right h-5 w-5 self-end text-gray-500 transition duration-150 ease-in-out dark:text-gray-200 group-hover:text-gray-700" />
          </RouterLink>
        </li>
        <li>
          <RouterLink to="cloud" class="sidebar-links group flex items-center justify-between">
            <div class="flex items-center gap-x-2">
              <div class="i-heroicons-cloud h-5 w-5 text-gray-500 transition duration-150 ease-in-out dark:text-gray-200 group-hover:text-gray-700" />
              Cloud
            </div>
            <div class="i-heroicons-chevron-right h-5 w-5 self-end text-gray-500 transition duration-150 ease-in-out dark:text-gray-200 group-hover:text-gray-700" />
          </RouterLink>
        </li>
        <li>
          <RouterLink to="database" class="sidebar-links group flex items-center justify-between">
            <div class="flex items-center gap-x-2">
              <div class="i-heroicons-circle-stack h-5 w-5 text-gray-500 transition duration-150 ease-in-out dark:text-gray-200 group-hover:text-gray-700" />
              Database
            </div>
            <div class="i-heroicons-chevron-right h-5 w-5 self-end text-gray-500 transition duration-150 ease-in-out dark:text-gray-200 group-hover:text-gray-700" />
          </RouterLink>
        </li>
        <li>
          <RouterLink to="dns" class="sidebar-links group flex items-center justify-between">
            <div class="flex items-center gap-x-2">
              <div class="i-heroicons-window h-5 w-5 text-gray-500 transition duration-150 ease-in-out dark:text-gray-200 group-hover:text-gray-700" />
              DNS
            </div>
            <div class="i-heroicons-chevron-right h-5 w-5 self-end text-gray-500 transition duration-150 ease-in-out dark:text-gray-200 group-hover:text-gray-700" />
          </RouterLink>
        </li>
        <li>
          <RouterLink to="email" class="sidebar-links group flex items-center justify-between">
            <div class="flex items-center gap-x-2">
              <div class="i-heroicons-at-symbol h-5 w-5 text-gray-500 transition duration-150 ease-in-out dark:text-gray-200 group-hover:text-gray-700" />
              Email
            </div>
            <div class="i-heroicons-chevron-right h-5 w-5 self-end text-gray-500 transition duration-150 ease-in-out dark:text-gray-200 group-hover:text-gray-700" />
          </RouterLink>
        </li>
        <li>
          <RouterLink to="file-system" class="sidebar-links group flex items-center justify-between">
            <div class="flex items-center gap-x-2">
              <div class="i-heroicons-folder h-5 w-5 text-gray-500 transition duration-150 ease-in-out dark:text-gray-200 group-hover:text-gray-700" />
              File System
            </div>
            <div class="i-heroicons-chevron-right h-5 w-5 self-end text-gray-500 transition duration-150 ease-in-out dark:text-gray-200 group-hover:text-gray-700" />
          </RouterLink>
        </li>
        <li>
          <RouterLink to="hashing" class="sidebar-links group flex items-center justify-between">
            <div class="flex items-center gap-x-2">
              <div class="i-heroicons-hashtag h-5 w-5 text-gray-500 transition duration-150 ease-in-out dark:text-gray-200 group-hover:text-gray-700" />
              Hashing
            </div>
            <div class="i-heroicons-chevron-right h-5 w-5 self-end text-gray-500 transition duration-150 ease-in-out dark:text-gray-200 group-hover:text-gray-700" />
          </RouterLink>
        </li>
        <li>
          <RouterLink to="languages" class="sidebar-links group flex items-center justify-between">
            <div class="flex items-center gap-x-2">
              <div class="i-heroicons-language h-5 w-5 text-gray-500 transition duration-150 ease-in-out dark:text-gray-200 group-hover:text-gray-700" />
              Languages
            </div>
            <div class="i-heroicons-chevron-right h-5 w-5 self-end text-gray-500 transition duration-150 ease-in-out dark:text-gray-200 group-hover:text-gray-700" />
          </RouterLink>
        </li>
        <li>
          <RouterLink to="library" class="sidebar-links group flex items-center justify-between">
            <div class="flex items-center gap-x-2">
              <div class="i-heroicons-book-open h-5 w-5 text-gray-500 transition duration-150 ease-in-out dark:text-gray-200 group-hover:text-gray-700" />
              Library
            </div>
            <div class="i-heroicons-chevron-right h-5 w-5 self-end text-gray-500 transition duration-150 ease-in-out dark:text-gray-200 group-hover:text-gray-700" />
          </RouterLink>
        </li>
        <li>
          <RouterLink to="native" class="sidebar-links group flex items-center justify-between">
            <div class="flex items-center gap-x-2">
              <div class="i-heroicons-viewfinder-circle h-5 w-5 text-gray-500 transition duration-150 ease-in-out dark:text-gray-200 group-hover:text-gray-700" />
              Native
            </div>
            <div class="i-heroicons-chevron-right h-5 w-5 self-end text-gray-500 transition duration-150 ease-in-out dark:text-gray-200 group-hover:text-gray-700" />
          </RouterLink>
        </li>
        <li>
          <RouterLink to="mail" class="sidebar-links group flex items-center justify-between">
            <div class="flex items-center gap-x-2">
              <div class="i-heroicons-envelope h-5 w-5 text-gray-500 transition duration-150 ease-in-out dark:text-gray-200 group-hover:text-gray-700" />
              Mail
            </div>
            <div class="i-heroicons-chevron-right h-5 w-5 self-end text-gray-500 transition duration-150 ease-in-out dark:text-gray-200 group-hover:text-gray-700" />
          </RouterLink>
        </li>
        <li>
          <RouterLink to="queue" class="sidebar-links group flex items-center justify-between">
            <div class="flex items-center gap-x-2">
              <div class="i-heroicons-queue-list h-5 w-5 text-gray-500 transition duration-150 ease-in-out dark:text-gray-200 group-hover:text-gray-700" />
              Queue
            </div>
            <div class="i-heroicons-chevron-right h-5 w-5 self-end text-gray-500 transition duration-150 ease-in-out dark:text-gray-200 group-hover:text-gray-700" />
          </RouterLink>
        </li>
        <li>
          <RouterLink to="search-engine" class="sidebar-links group flex items-center justify-between">
            <div class="flex items-center gap-x-2">
              <div class="i-heroicons-magnifying-glass h-5 w-5 text-gray-500 transition duration-150 ease-in-out dark:text-gray-200 group-hover:text-gray-700" />
              Search Engine
            </div>
            <div class="i-heroicons-chevron-right h-5 w-5 self-end text-gray-500 transition duration-150 ease-in-out dark:text-gray-200 group-hover:text-gray-700" />
          </RouterLink>
        </li>
        <li>
          <RouterLink to="security" class="sidebar-links group flex items-center justify-between">
            <div class="flex items-center gap-x-2">
              <div class="i-heroicons-shield-check h-5 w-5 text-gray-500 transition duration-150 ease-in-out dark:text-gray-200 group-hover:text-gray-700" />
              Security
            </div>
            <div class="i-heroicons-chevron-right h-5 w-5 self-end text-gray-500 transition duration-150 ease-in-out dark:text-gray-200 group-hover:text-gray-700" />
          </RouterLink>
        </li>
        <li>
          <RouterLink to="services" class="sidebar-links group flex items-center justify-between">
            <div class="flex items-center gap-x-2">
              <div class="i-heroicons-briefcase h-5 w-5 text-gray-500 transition duration-150 ease-in-out dark:text-gray-200 group-hover:text-gray-700" />
              Services
            </div>
            <div class="i-heroicons-chevron-right h-5 w-5 self-end text-gray-500 transition duration-150 ease-in-out dark:text-gray-200 group-hover:text-gray-700" />
          </RouterLink>
        </li>
        <li>
          <RouterLink to="storage" class="sidebar-links group flex items-center justify-between">
            <div class="flex items-center gap-x-2">
              <div class="i-heroicons-circle-stack h-5 w-5 text-gray-500 transition duration-150 ease-in-out dark:text-gray-200 group-hover:text-gray-700" />
              Storage
            </div>
            <div class="i-heroicons-chevron-right h-5 w-5 self-end text-gray-500 transition duration-150 ease-in-out dark:text-gray-200 group-hover:text-gray-700" />
          </RouterLink>
        </li>
        <li>
          <RouterLink to="team" class="sidebar-links group flex items-center justify-between">
            <div class="flex items-center gap-x-2">
              <div class="i-heroicons-user-group h-5 w-5 text-gray-500 transition duration-150 ease-in-out dark:text-gray-200 group-hover:text-gray-700" />
              Team
            </div>
            <div class="i-heroicons-chevron-right h-5 w-5 self-end text-gray-500 transition duration-150 ease-in-out dark:text-gray-200 group-hover:text-gray-700" />
          </RouterLink>
        </li>
        <li>
          <RouterLink to="ui" class="sidebar-links group flex items-center justify-between">
            <div class="flex items-center gap-x-2">
              <div class="i-heroicons-rectangle-group h-5 w-5 text-gray-500 transition duration-150 ease-in-out dark:text-gray-200 group-hover:text-gray-700" />
              UI
            </div>
            <div class="i-heroicons-chevron-right h-5 w-5 self-end text-gray-500 transition duration-150 ease-in-out dark:text-gray-200 group-hover:text-gray-700" />
          </RouterLink>
        </li>
      </ul>
    </nav>
  </header>
</template>

<style scoped>
.sidebar-links {
  @apply text-gray-700 hover:text-blue-600 hover:bg-gray-50 flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold
}

.router-link-active, .router-link-exact-active {
  @apply text-blue-600 text-sm rounded-md !important
}
</style>
