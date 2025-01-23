<template>
  <header class="border-b border-gray-200 dark:border-gray-600">
    <!-- Secondary navigation -->
    <nav class="flex overflow-x-auto py-4">
      <ul
        role="list"
        class="min-w-full flex flex-none gap-x-6 px-4 text-sm text-gray-600 font-semibold leading-6 lg:px-8 sm:px-6"
      >
        <li>
          <RouterLink to="/settings/ai">
            AI
          </RouterLink>
        </li>
        <li>
          <RouterLink to="/settings/analytics">
            Analytics
          </RouterLink>
        </li>
        <li>
          <RouterLink to="/settings/app">
            App
          </RouterLink>
        </li>
        <li>
          <RouterLink to="/settings/cache">
            Cache
          </RouterLink>
        </li>
        <li>
          <RouterLink to="/settings/cli">
            CLI
          </RouterLink>
        </li>
        <li>
          <RouterLink to="/settings/cli">
            Cloud
          </RouterLink>
        </li>
        <li>
          <RouterLink to="/settings/database">
            Database
          </RouterLink>
        </li>
        <li>
          <RouterLink to="/settings/dns">
            DNS
          </RouterLink>
        </li>
        <!-- <li><RouterLink to="/settings/docs">Docs</RouterLink></li> -->
        <li>
          <RouterLink to="/settings/email">
            Email
          </RouterLink>
        </li>
        <li>
          <RouterLink to="/settings/file-systems">
            File Systems
          </RouterLink>
        </li>
        <!-- <li><RouterLink to="/settings/storage">git</RouterLink></li> -->
        <li>
          <RouterLink to="/settings/hashing">
            Hashing
          </RouterLink>
        </li>
        <li>
          <!-- ./lang/* -->
          <RouterLink to="/settings/languages">
            Languages
          </RouterLink>
        </li>
        <li>
          <RouterLink to="/settings/library">
            Library
          </RouterLink>
        </li>
        <li>
          <RouterLink to="/settings/native">
            Native
          </RouterLink>
        </li>
        <li>
          <RouterLink to="/settings/mail">
            Mail
          </RouterLink>
        </li>
        <li>
          <RouterLink to="/settings/queue">
            Queue
          </RouterLink>
        </li>
        <li>
          <RouterLink to="/settings/search-engine">
            Search Engine
          </RouterLink>
        </li>
        <li>
          <RouterLink to="/settings/security">
            Security
          </RouterLink>
        </li>
        <li>
          <RouterLink to="/settings/services">
            Services
          </RouterLink>
        </li>
        <li>
          <RouterLink to="/settings/storage">
            Storage
          </RouterLink>
        </li>
        <li>
          <RouterLink to="/settings/team">
            Team
          </RouterLink>
        </li>
        <li>
          <RouterLink to="/settings/ui">
            UI
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
