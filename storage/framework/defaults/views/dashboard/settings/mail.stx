<route lang="yaml">
  meta:
    requiresAuth: true
</route>

<script setup lang="ts">
</script>

<template>
  <main>
    <SettingsHeader />

    <!-- Settings forms -->
    <div class="divide-y divide-white/5">
      <div class="grid grid-cols-1 max-w-7xl gap-x-8 gap-y-10 px-4 py-16 md:grid-cols-3 lg:px-8 sm:px-6">
        <div>
          <h2 class="text-base text-gray-900 font-semibold leading-7 dark:text-gray-100">
            Main Config
          </h2>
          <p class="mt-1 text-sm text-gray-600 leading-6">
            Update mail settings.
          </p>
        </div>

        <form class="md:col-span-2">
          <div class="grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6 sm:max-w-xl">
            <div class="sm:col-span-full">
              <label
                for="mail-from"
                class="block text-sm text-gray-900 font-medium leading-6 dark:text-gray-100"
              >Mail From</label>
              <div class="mt-2">
                <input
                  id="mail-from"
                  type="text"
                  value="no-reply@stacks.dev"
                  class="block w-full border border-gray-300 rounded-md px-4 py-2 text-gray-900 shadow-sm dark:border-gray-600 required:border-red-500 focus:border-none dark:bg-blue-gray-800 dark:text-gray-100 dark:text-gray-200 focus:ring-2 focus:ring-blue-500"
                >
              </div>
            </div>

            <div class="sm:col-span-full">
              <label
                for="mail-to"
                class="block text-sm text-gray-900 font-medium leading-6 dark:text-gray-100"
              >Mail To</label>
              <div class="mt-2">
                <input
                  id="mail-to"
                  type="text"
                  value="chris@stacks.dev"
                  class="block w-full border border-gray-300 rounded-md px-4 py-2 text-gray-900 shadow-sm dark:border-gray-600 required:border-red-500 focus:border-none dark:bg-blue-gray-800 dark:text-gray-100 dark:text-gray-200 focus:ring-2 focus:ring-blue-500"
                >
              </div>
            </div>

            <div class="sm:col-span-full">
              <label
                for="mail-driver"
                class="block text-sm text-gray-900 font-medium leading-6 dark:text-gray-100"
              >Driver</label>
              <div class="mt-2">
                <input
                  id="mail-driver"
                  type="text"
                  value="SMTP"
                  class="block w-full border border-gray-300 rounded-md px-4 py-2 text-gray-900 shadow-sm dark:border-gray-600 required:border-red-500 focus:border-none dark:bg-blue-gray-800 dark:text-gray-100 dark:text-gray-200 focus:ring-2 focus:ring-blue-500"
                >
              </div>
            </div>

            <div class="sm:col-span-3">
              <label
                for="mail-host"
                class="block text-sm text-gray-900 font-medium leading-6 dark:text-gray-100"
              >Host</label>
              <div class="mt-2">
                <input
                  id="mail-host"
                  type="text"
                  value="127.0.0.1"
                  class="block w-full border border-gray-300 rounded-md px-4 py-2 text-gray-900 shadow-sm dark:border-gray-600 required:border-red-500 focus:border-none dark:bg-blue-gray-800 dark:text-gray-100 dark:text-gray-200 focus:ring-2 focus:ring-blue-500"
                >
              </div>
            </div>

            <div class="sm:col-span-3">
              <label
                for="mail-port"
                class="block text-sm text-gray-900 font-medium leading-6 dark:text-gray-100"
              >Port</label>
              <div class="mt-2">
                <input
                  id="mail-port"
                  type="text"
                  value="2525"
                  class="block w-full border border-gray-300 rounded-md px-4 py-2 text-gray-900 shadow-sm dark:border-gray-600 required:border-red-500 focus:border-none dark:bg-blue-gray-800 dark:text-gray-100 dark:text-gray-200 focus:ring-2 focus:ring-blue-500"
                >
              </div>
            </div>

            <div class="sm:col-span-3">
              <label
                for="mail-username"
                class="block text-sm text-gray-900 font-medium leading-6 dark:text-gray-100"
              >Username</label>
              <div class="mt-2">
                <input
                  id="mail-username"
                  type="text"
                  value="stacks-inbox"
                  class="block w-full border border-gray-300 rounded-md px-4 py-2 text-gray-900 shadow-sm dark:border-gray-600 required:border-red-500 focus:border-none dark:bg-blue-gray-800 dark:text-gray-100 dark:text-gray-200 focus:ring-2 focus:ring-blue-500"
                >
              </div>
            </div>

            <div class="sm:col-span-3">
              <label
                for="mail-password"
                class="block text-sm text-gray-900 font-medium leading-6 dark:text-gray-100"
              >Password</label>
              <div class="mt-2">
                <input
                  id="mail-password"
                  type="password"
                  value=""
                  class="block w-full border border-gray-300 rounded-md px-4 py-2 text-gray-900 shadow-sm dark:border-gray-600 required:border-red-500 focus:border-none dark:bg-blue-gray-800 dark:text-gray-100 dark:text-gray-200 focus:ring-2 focus:ring-blue-500"
                >
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  </main>
</template>
