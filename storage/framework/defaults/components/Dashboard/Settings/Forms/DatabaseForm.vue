<script setup lang="ts">

</script>

<template>
  <form>
    <main class="border-b border-gray-900/10">
      <!-- Settings forms -->
      <div class="divide-y divide-gray-900/10">
        <div class="grid grid-cols-1 max-w-7xl gap-x-8 gap-y-10 py-16 md:grid-cols-3">
          <div>
            <h2 class="text-base text-gray-900 font-semibold leading-7 dark:text-gray-100">
              MySQL
            </h2>
            <p class="mt-1 text-sm text-gray-600 leading-6">
              Update your MySQL driver settings.
            </p>
          </div>

          <div class="md:col-span-2">
            <div class="grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6 sm:max-w-xl">
              <div class="sm:col-span-3">
                <label
                  for="mysql-host"
                  class="block text-sm text-gray-900 font-medium leading-6 dark:text-gray-100"
                >Host</label>
                <div class="mt-2">
                  <input
                    id="mysql-host"
                    type="text"
                    name="name"
                    value="stacks"
                    class="block w-full border border-gray-300 rounded-md px-4 py-2 text-gray-900 shadow-sm dark:border-gray-600 required:border-red-500 focus:border-none dark:bg-blue-gray-800 dark:text-gray-100 dark:text-gray-200 focus:ring-2 focus:ring-blue-500"
                  >
                </div>
              </div>

              <div class="sm:col-span-3">
                <label
                  for="mysql-port"
                  class="block text-sm text-gray-900 font-medium leading-6 dark:text-gray-100"
                >Port</label>
                <div class="mt-2">
                  <input
                    id="mysql-port"
                    type="text"
                    name="name"
                    value="3306"
                    class="block w-full border border-gray-300 rounded-md px-4 py-2 text-gray-900 shadow-sm dark:border-gray-600 required:border-red-500 focus:border-none dark:bg-blue-gray-800 dark:text-gray-100 dark:text-gray-200 focus:ring-2 focus:ring-blue-500"
                  >
                </div>
              </div>

              <div class="sm:col-span-3">
                <label
                  for="mysql-username"
                  class="block text-sm text-gray-900 font-medium leading-6 dark:text-gray-100"
                >Username</label>
                <div class="mt-2">
                  <input
                    id="mysql-username"
                    type="text"
                    value="root"
                    class="block w-full border border-gray-300 rounded-md px-4 py-2 text-gray-900 shadow-sm dark:border-gray-600 required:border-red-500 focus:border-none dark:bg-blue-gray-800 dark:text-gray-100 dark:text-gray-200 focus:ring-2 focus:ring-blue-500"
                  >
                </div>
              </div>

              <div class="sm:col-span-3">
                <label
                  for="mysql-password"
                  class="block text-sm text-gray-900 font-medium leading-6 dark:text-gray-100"
                >Password</label>
                <div class="mt-2">
                  <input
                    id="mysql-password"
                    type="text"
                    name="last-name"
                    autocomplete="family-name"
                    class="block w-full border border-gray-300 rounded-md px-4 py-2 text-gray-900 shadow-sm dark:border-gray-600 required:border-red-500 focus:border-none dark:bg-blue-gray-800 dark:text-gray-100 dark:text-gray-200 focus:ring-2 focus:ring-blue-500"
                  >
                </div>
              </div>

              <div class="sm:col-span-full">
                <label
                  for="mysql-password"
                  class="block text-sm text-gray-900 font-medium leading-6 dark:text-gray-100"
                >Database</label>
                <div class="mt-2">
                  <input
                    id="mysql-password"
                    type="text"
                    name="last-name"
                    autocomplete="family-name"
                    class="block w-full border border-gray-300 rounded-md px-4 py-2 text-gray-900 shadow-sm dark:border-gray-600 required:border-red-500 focus:border-none dark:bg-blue-gray-800 dark:text-gray-100 dark:text-gray-200 focus:ring-2 focus:ring-blue-500"
                  >
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 max-w-7xl gap-x-8 gap-y-10 py-16 md:grid-cols-3">
          <div>
            <h2 class="text-base text-gray-900 font-semibold leading-7 dark:text-gray-100">
              SQLite
            </h2>
            <p class="mt-1 text-sm text-gray-600 leading-6">
              Update your SQLite driver settings.
            </p>
          </div>

          <div class="md:col-span-2">
            <div class="grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6 sm:max-w-xl">
              <div class="sm:col-span-3">
                <label
                  for="sqlite-host"
                  class="block text-sm text-gray-900 font-medium leading-6 dark:text-gray-100"
                >Host</label>
                <div class="mt-2">
                  <input
                    id="sqlite-host"
                    type="text"
                    name="name"
                    value="127.0.0.1"
                    class="block w-full border border-gray-300 rounded-md px-4 py-2 text-gray-900 shadow-sm dark:border-gray-600 required:border-red-500 focus:border-none dark:bg-blue-gray-800 dark:text-gray-100 dark:text-gray-200 focus:ring-2 focus:ring-blue-500"
                  >
                </div>
              </div>

              <div class="sm:col-span-3">
                <label
                  for="sqlite-prefix"
                  class="block text-sm text-gray-900 font-medium leading-6 dark:text-gray-100"
                >Prefix</label>
                <div class="mt-2">
                  <input
                    id="sqlite-prefix"
                    type="text"
                    name="name"
                    value="sqlite"
                    class="block w-full border border-gray-300 rounded-md px-4 py-2 text-gray-900 shadow-sm dark:border-gray-600 required:border-red-500 focus:border-none dark:bg-blue-gray-800 dark:text-gray-100 dark:text-gray-200 focus:ring-2 focus:ring-blue-500"
                  >
                </div>
              </div>

              <div class="sm:col-span-full">
                <label
                  for="mysql-password"
                  class="block text-sm text-gray-900 font-medium leading-6 dark:text-gray-100"
                >Database</label>
                <div class="mt-2">
                  <input
                    id="mysql-password"
                    type="text"
                    name="last-name"
                    autocomplete="family-name"
                    value="stacks"
                    class="block w-full border border-gray-300 rounded-md px-4 py-2 text-gray-900 shadow-sm dark:border-gray-600 required:border-red-500 focus:border-none dark:bg-blue-gray-800 dark:text-gray-100 dark:text-gray-200 focus:ring-2 focus:ring-blue-500"
                  >
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
    <div class="mt-6 flex items-center justify-end gap-x-6">
      <button type="button" class="text-sm text-gray-900 font-semibold leading-6">
        Cancel
      </button>
      <Button
        type="submit"
        class="rounded-md bg-indigo-600 px-3 py-2 text-sm text-white font-semibold shadow-sm hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-indigo-600 focus-visible:outline-offset-2 focus-visible:outline"
      >
        Save
      </Button>
    </div>
  </form>
</template>

<style scoped>

</style>
