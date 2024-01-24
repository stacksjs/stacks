<script setup lang="ts">
</script>

<template>
  <main>
    <SettingsHeader />

    <!-- Settings forms -->
    <div class="divide-y divide-white/5">
      <div class="grid max-w-7xl grid-cols-1 gap-x-8 gap-y-10 px-4 py-16 sm:px-6 md:grid-cols-3 lg:px-8">
        <div>
          <h2 class="text-base font-semibold leading-7 text-gray-900 dark:text-gray-100">
            Redis
          </h2>
          <p class="mt-1 text-sm leading-6 text-gray-600">
            Update your redis settings.
          </p>
        </div>

        <form class="md:col-span-2">
          <div class="grid grid-cols-1 gap-x-6 gap-y-8 sm:max-w-xl sm:grid-cols-6">
            <div class="col-span-3">
              <label
                for="redis-host"
                class="block cursor-pointer text-sm font-medium leading-6 text-gray-900 dark:text-gray-100"
              >Host</label>
              <div class="mt-2">
                <input
                  id="redis-host"
                  type="text"
                  value="127.0.0.1"
                  class="block w-full px-4 py-2 text-gray-900 border border-gray-300 rounded-md shadow-sm required:border-red-500 dark:bg-blue-gray-800 dark:text-gray-200 dark:text-gray-100 dark:border-gray-600 focus:border-none focus:ring-2 focus:ring-blue-500"
                >
              </div>
            </div>

            <div class="col-span-3">
              <label
                for="redis-port"
                class="block cursor-pointer text-sm font-medium leading-6 text-gray-900 dark:text-gray-100"
              >Port</label>
              <div class="mt-2">
                <input
                  id="redis-port"
                  type="text"
                  value="6379"
                  class="block w-full px-4 py-2 text-gray-900 border border-gray-300 rounded-md shadow-sm required:border-red-500 dark:bg-blue-gray-800 dark:text-gray-200 dark:text-gray-100 dark:border-gray-600 focus:border-none focus:ring-2 focus:ring-blue-500"
                >
              </div>
            </div>

            <div class="col-span-full">
              <label
                for="redis-password"
                class="block cursor-pointer text-sm font-medium leading-6 text-gray-900 dark:text-gray-100"
              >Password</label>
              <div class="mt-2">
                <input
                  id="redis-password"
                  type="password"
                  value=""
                  class="block w-full px-4 py-2 text-gray-900 border border-gray-300 rounded-md shadow-sm required:border-red-500 dark:bg-blue-gray-800 dark:text-gray-200 dark:text-gray-100 dark:border-gray-600 focus:border-none focus:ring-2 focus:ring-blue-500"
                >
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  </main>
</template>
