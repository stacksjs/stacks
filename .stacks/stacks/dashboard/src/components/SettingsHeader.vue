<template>
  <header class="border-b border-gray-200 dark:border-gray-600">
    <!-- Secondary navigation -->
    <nav class="flex overflow-x-auto py-4">
      <ul
        role="list"
        class="flex min-w-full flex-none gap-x-6 px-4 text-sm font-semibold leading-6 text-gray-600 sm:px-6 lg:px-8"
      >
        <li>
          <RouterLink
            to="/settings/cache"
          >
            Cache
          </RouterLink>
        </li>
        <li>
          <RouterLink
            to="/settings/database"
          >
            Database
          </RouterLink>
        </li>
        <li>
          <RouterLink
            to="/settings/storage"
          >
            Storage
          </RouterLink>
        </li>
        <li>
          <RouterLink
            to="/settings/mail"
          >
            Mail
          </RouterLink>
        </li>
        <li>
          <RouterLink
            to="/settings/queue"
          >
            Queue
          </RouterLink>
        </li>
        <li>
          <RouterLink
            to="/settings/services"
          >
            Services
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
