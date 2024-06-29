<template>
  <header class="lg:w-92 border-b border-gray-200 dark:border-gray-600 p-4 sm:p-6 lg:p-8">
    <div class="bg-white rounded-lg shadow-sm p-4 w-full">
      <h3 class="md:text-sm font-semibold text-gray-700">
        Stacks Settings
      </h3>
      <p class="mt-2 text-sm text-gray-500">
        List of available settings
      </p>
    </div>
    <!-- Side navigation -->
    <nav class="mt-4 flex flex-1 flex-col bg-white rounded-lg shadow-sm p-4 w-full">
      <ul
        role="list"
        class="-mx-2 mt-2 space-y-1"
      >
        <li>
          <RouterLink to="ai" class="sidebar-links group flex items-center justify-between">
            <div class="flex items-center gap-x-2">
              <div class="i-heroicons-sparkles text-gray-500 w-5 h-5 dark:text-gray-200 group-hover:text-gray-700 transition duration-150 ease-in-out" />
              AI
            </div>
            <div class="i-heroicons-chevron-right text-gray-500 w-5 h-5 dark:text-gray-200 group-hover:text-gray-700 transition duration-150 ease-in-out self-end" />
          </RouterLink>
        </li>
        <li>
          <RouterLink to="analytics" class="sidebar-links group flex items-center justify-between">
            <div class="flex items-center gap-x-2">
              <div class="i-heroicons-chart-bar text-gray-500 w-5 h-5 dark:text-gray-200 group-hover:text-gray-700 transition duration-150 ease-in-out" />
              Analytics
            </div>
            <div class="i-heroicons-chevron-right text-gray-500 w-5 h-5 dark:text-gray-200 group-hover:text-gray-700 transition duration-150 ease-in-out self-end" />
          </RouterLink>
        </li>
        <li>
          <RouterLink to="app" class="sidebar-links group flex items-center justify-between">
            <div class="flex items-center gap-x-2">
              <div class="i-heroicons-cog-6-tooth text-gray-500 w-5 h-5 dark:text-gray-200 group-hover:text-gray-700 transition duration-150 ease-in-out" />
              App
            </div>
            <div class="i-heroicons-chevron-right text-gray-500 w-5 h-5 dark:text-gray-200 group-hover:text-gray-700 transition duration-150 ease-in-out self-end" />
          </RouterLink>
        </li>
        <li>
          <RouterLink to="cache" class="sidebar-links group flex items-center justify-between">
            <div class="flex items-center gap-x-2">
              <div class="i-heroicons-server text-gray-500 w-5 h-5 dark:text-gray-200 group-hover:text-gray-700 transition duration-150 ease-in-out" />
              Cache
            </div>
            <div class="i-heroicons-chevron-right text-gray-500 w-5 h-5 dark:text-gray-200 group-hover:text-gray-700 transition duration-150 ease-in-out self-end" />
          </RouterLink>
        </li>
        <li>
          <RouterLink to="cli" class="sidebar-links group flex items-center justify-between">
            <div class="flex items-center gap-x-2">
              <div class="i-heroicons-command-line text-gray-500 w-5 h-5 dark:text-gray-200 group-hover:text-gray-700 transition duration-150 ease-in-out" />
              CLI
            </div>
            <div class="i-heroicons-chevron-right text-gray-500 w-5 h-5 dark:text-gray-200 group-hover:text-gray-700 transition duration-150 ease-in-out self-end" />
          </RouterLink>
        </li>
        <li>
          <RouterLink to="cloud" class="sidebar-links group flex items-center justify-between">
            <div class="flex items-center gap-x-2">
              <div class="i-heroicons-cloud text-gray-500 w-5 h-5 dark:text-gray-200 group-hover:text-gray-700 transition duration-150 ease-in-out" />
              Cloud
            </div>
            <div class="i-heroicons-chevron-right text-gray-500 w-5 h-5 dark:text-gray-200 group-hover:text-gray-700 transition duration-150 ease-in-out self-end" />
          </RouterLink>
        </li>
        <li>
          <RouterLink to="database" class="sidebar-links group flex items-center justify-between">
            <div class="flex items-center gap-x-2">
              <div class="i-heroicons-circle-stack text-gray-500 w-5 h-5 dark:text-gray-200 group-hover:text-gray-700 transition duration-150 ease-in-out" />
              Database
            </div>
            <div class="i-heroicons-chevron-right text-gray-500 w-5 h-5 dark:text-gray-200 group-hover:text-gray-700 transition duration-150 ease-in-out self-end" />
          </RouterLink>
        </li>
        <li>
          <RouterLink to="dns" class="sidebar-links group flex items-center justify-between">
            <div class="flex items-center gap-x-2">
              <div class="i-heroicons-window text-gray-500 w-5 h-5 dark:text-gray-200 group-hover:text-gray-700 transition duration-150 ease-in-out" />
              DNS
            </div>
            <div class="i-heroicons-chevron-right text-gray-500 w-5 h-5 dark:text-gray-200 group-hover:text-gray-700 transition duration-150 ease-in-out self-end" />
          </RouterLink>
        </li>
        <li>
          <RouterLink to="email" class="sidebar-links group flex items-center justify-between">
            <div class="flex items-center gap-x-2">
              <div class="i-heroicons-square-3-stack-3d text-gray-500 w-5 h-5 dark:text-gray-200 group-hover:text-gray-700 transition duration-150 ease-in-out" />
              Email
            </div>
            <div class="i-heroicons-chevron-right text-gray-500 w-5 h-5 dark:text-gray-200 group-hover:text-gray-700 transition duration-150 ease-in-out self-end" />
          </RouterLink>
        </li>
        <li>
          <RouterLink to="file-system" class="sidebar-links group flex items-center justify-between">
            <div class="flex items-center gap-x-2">
              <div class="i-heroicons-square-3-stack-3d text-gray-500 w-5 h-5 dark:text-gray-200 group-hover:text-gray-700 transition duration-150 ease-in-out" />
              File System
            </div>
            <div class="i-heroicons-chevron-right text-gray-500 w-5 h-5 dark:text-gray-200 group-hover:text-gray-700 transition duration-150 ease-in-out self-end" />
          </RouterLink>
        </li>
        <li>
          <RouterLink to="hashing" class="sidebar-links group flex items-center justify-between">
            <div class="flex items-center gap-x-2">
              <div class="i-heroicons-square-3-stack-3d text-gray-500 w-5 h-5 dark:text-gray-200 group-hover:text-gray-700 transition duration-150 ease-in-out" />
              Hashing
            </div>
            <div class="i-heroicons-chevron-right text-gray-500 w-5 h-5 dark:text-gray-200 group-hover:text-gray-700 transition duration-150 ease-in-out self-end" />
          </RouterLink>
        </li>
        <li>
          <RouterLink to="languages" class="sidebar-links group flex items-center justify-between">
            <div class="flex items-center gap-x-2">
              <div class="i-heroicons-square-3-stack-3d text-gray-500 w-5 h-5 dark:text-gray-200 group-hover:text-gray-700 transition duration-150 ease-in-out" />
              Languages
            </div>
            <div class="i-heroicons-chevron-right text-gray-500 w-5 h-5 dark:text-gray-200 group-hover:text-gray-700 transition duration-150 ease-in-out self-end" />
          </RouterLink>
        </li>
        <li>
          <RouterLink to="library" class="sidebar-links group flex items-center justify-between">
            <div class="flex items-center gap-x-2">
              <div class="i-heroicons-square-3-stack-3d text-gray-500 w-5 h-5 dark:text-gray-200 group-hover:text-gray-700 transition duration-150 ease-in-out" />
              Library
            </div>
            <div class="i-heroicons-chevron-right text-gray-500 w-5 h-5 dark:text-gray-200 group-hover:text-gray-700 transition duration-150 ease-in-out self-end" />
          </RouterLink>
        </li>
        <li>
          <RouterLink to="native" class="sidebar-links group flex items-center justify-between">
            <div class="flex items-center gap-x-2">
              <div class="i-heroicons-square-3-stack-3d text-gray-500 w-5 h-5 dark:text-gray-200 group-hover:text-gray-700 transition duration-150 ease-in-out" />
              Native
            </div>
            <div class="i-heroicons-chevron-right text-gray-500 w-5 h-5 dark:text-gray-200 group-hover:text-gray-700 transition duration-150 ease-in-out self-end" />
          </RouterLink>
        </li>
        <li>
          <RouterLink to="mail" class="sidebar-links group flex items-center justify-between">
            <div class="flex items-center gap-x-2">
              <div class="i-heroicons-square-3-stack-3d text-gray-500 w-5 h-5 dark:text-gray-200 group-hover:text-gray-700 transition duration-150 ease-in-out" />
              Mail
            </div>
            <div class="i-heroicons-chevron-right text-gray-500 w-5 h-5 dark:text-gray-200 group-hover:text-gray-700 transition duration-150 ease-in-out self-end" />
          </RouterLink>
        </li>
        <li>
          <RouterLink to="queue" class="sidebar-links group flex items-center justify-between">
            <div class="flex items-center gap-x-2">
              <div class="i-heroicons-square-3-stack-3d text-gray-500 w-5 h-5 dark:text-gray-200 group-hover:text-gray-700 transition duration-150 ease-in-out" />
              Queue
            </div>
            <div class="i-heroicons-chevron-right text-gray-500 w-5 h-5 dark:text-gray-200 group-hover:text-gray-700 transition duration-150 ease-in-out self-end" />
          </RouterLink>
        </li>
        <li>
          <RouterLink to="search-engine" class="sidebar-links group flex items-center justify-between">
            <div class="flex items-center gap-x-2">
              <div class="i-heroicons-square-3-stack-3d text-gray-500 w-5 h-5 dark:text-gray-200 group-hover:text-gray-700 transition duration-150 ease-in-out" />
              Search Engine
            </div>
            <div class="i-heroicons-chevron-right text-gray-500 w-5 h-5 dark:text-gray-200 group-hover:text-gray-700 transition duration-150 ease-in-out self-end" />
          </RouterLink>
        </li>
        <li>
          <RouterLink to="security" class="sidebar-links group flex items-center justify-between">
            <div class="flex items-center gap-x-2">
              <div class="i-heroicons-square-3-stack-3d text-gray-500 w-5 h-5 dark:text-gray-200 group-hover:text-gray-700 transition duration-150 ease-in-out" />
              Security
            </div>
            <div class="i-heroicons-chevron-right text-gray-500 w-5 h-5 dark:text-gray-200 group-hover:text-gray-700 transition duration-150 ease-in-out self-end" />
          </RouterLink>
        </li>
        <li>
          <RouterLink to="service" class="sidebar-links group flex items-center justify-between">
            <div class="flex items-center gap-x-2">
              <div class="i-heroicons-square-3-stack-3d text-gray-500 w-5 h-5 dark:text-gray-200 group-hover:text-gray-700 transition duration-150 ease-in-out" />
              Service
            </div>
            <div class="i-heroicons-chevron-right text-gray-500 w-5 h-5 dark:text-gray-200 group-hover:text-gray-700 transition duration-150 ease-in-out self-end" />
          </RouterLink>
        </li>
        <li>
          <RouterLink to="storage" class="sidebar-links group flex items-center justify-between">
            <div class="flex items-center gap-x-2">
              <div class="i-heroicons-square-3-stack-3d text-gray-500 w-5 h-5 dark:text-gray-200 group-hover:text-gray-700 transition duration-150 ease-in-out" />
              Storage
            </div>
            <div class="i-heroicons-chevron-right text-gray-500 w-5 h-5 dark:text-gray-200 group-hover:text-gray-700 transition duration-150 ease-in-out self-end" />
          </RouterLink>
        </li>
        <li>
          <RouterLink to="team" class="sidebar-links group flex items-center justify-between">
            <div class="flex items-center gap-x-2">
              <div class="i-heroicons-square-3-stack-3d text-gray-500 w-5 h-5 dark:text-gray-200 group-hover:text-gray-700 transition duration-150 ease-in-out" />
              Team
            </div>
            <div class="i-heroicons-chevron-right text-gray-500 w-5 h-5 dark:text-gray-200 group-hover:text-gray-700 transition duration-150 ease-in-out self-end" />
          </RouterLink>
        </li>
        <li>
          <RouterLink to="ui" class="sidebar-links group flex items-center justify-between">
            <div class="flex items-center gap-x-2">
              <div class="i-heroicons-square-3-stack-3d text-gray-500 w-5 h-5 dark:text-gray-200 group-hover:text-gray-700 transition duration-150 ease-in-out" />
              UI
            </div>
            <div class="i-heroicons-chevron-right text-gray-500 w-5 h-5 dark:text-gray-200 group-hover:text-gray-700 transition duration-150 ease-in-out self-end" />
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
