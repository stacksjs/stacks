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
              Default Queue Settings
            </h2>
            <p class="mt-1 text-sm text-gray-600 leading-6">
              Update your default Queue settings
            </p>
          </div>

          <div class="md:col-span-2">
            <div class="grid grid-cols-1 w-full gap-x-6 gap-y-8 sm:grid-cols-6">
              <div class="sm:col-span-3">
                <label for="type" class="block text-sm text-gray-900 font-medium leading-6">Default</label>
                <div class="mt-2">
                  <select id="type" name="type" class="block w-full border-0 rounded-md py-1.5 text-gray-900 shadow-sm ring-1 ring-gray-300 ring-inset sm:max-w-xs sm:text-sm sm:leading-6 focus:ring-2 focus:ring-indigo-600 focus:ring-inset">
                    <option selected>
                      sync
                    </option>
                    <option>database</option>
                    <option>redis</option>
                    <option>sqs</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 max-w-7xl gap-x-8 gap-y-10 py-16 md:grid-cols-3">
          <div>
            <h2 class="text-base text-gray-900 font-semibold leading-7 dark:text-gray-100">
              Sync Queue
            </h2>
            <p class="mt-1 text-sm text-gray-600 leading-6">
              Update your Sync Queue configurations
            </p>
          </div>

          <div class="md:col-span-2">
            <div class="grid grid-cols-1 w-full gap-x-6 gap-y-8 sm:grid-cols-6">
              <div class="sm:col-span-3">
                <label for="local-driver" class="block text-sm text-gray-900 font-medium leading-6">Driver</label>
                <div class="mt-2">
                  <input id="driver" type="text" name="driver" value="sync" disabled class="block w-full cursor-not-allowed border-0 rounded-md bg-blue-gray-50 py-1.5 text-gray-900 shadow-sm ring-1 ring-gray-300 ring-inset sm:text-sm placeholder:text-gray-400 sm:leading-6 focus:ring-2 focus:ring-indigo-600 focus:ring-inset">
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 max-w-7xl gap-x-8 gap-y-10 py-16 md:grid-cols-3">
          <div>
            <h2 class="text-base text-gray-900 font-semibold leading-7 dark:text-gray-100">
              Database Queue
            </h2>
            <p class="mt-1 text-sm text-gray-600 leading-6">
              Update your database queue configurations
            </p>
          </div>

          <div class="md:col-span-2">
            <div class="grid grid-cols-1 w-full gap-x-6 gap-y-8 sm:grid-cols-6">
              <div class="sm:col-span-3">
                <label for="local-driver" class="block text-sm text-gray-900 font-medium leading-6">Driver</label>
                <div class="mt-2">
                  <input id="driver" type="text" name="driver" value="database" disabled class="block w-full cursor-not-allowed border-0 rounded-md bg-blue-gray-50 py-1.5 text-gray-900 shadow-sm ring-1 ring-gray-300 ring-inset sm:text-sm placeholder:text-gray-400 sm:leading-6 focus:ring-2 focus:ring-indigo-600 focus:ring-inset">
                </div>
              </div>

              <div class="sm:col-span-3">
                <label for="local-root" class="block text-sm text-gray-900 font-medium leading-6">Table</label>
                <div class="mt-2">
                  <input id="local-root" type="text" name="local-root" value="jobs" class="block w-full border-0 rounded-md py-1.5 text-gray-900 shadow-sm ring-1 ring-gray-300 ring-inset sm:text-sm placeholder:text-gray-400 sm:leading-6 focus:ring-2 focus:ring-indigo-600 focus:ring-inset">
                </div>
              </div>

              <div class="sm:col-span-3">
                <label for="local-root" class="block text-sm text-gray-900 font-medium leading-6">Queue</label>
                <div class="mt-2">
                  <input id="local-root" type="text" name="local-root" value="default" class="block w-full border-0 rounded-md py-1.5 text-gray-900 shadow-sm ring-1 ring-gray-300 ring-inset sm:text-sm placeholder:text-gray-400 sm:leading-6 focus:ring-2 focus:ring-indigo-600 focus:ring-inset">
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 max-w-7xl gap-x-8 gap-y-10 py-16 md:grid-cols-3">
          <div>
            <h2 class="text-base text-gray-900 font-semibold leading-7 dark:text-gray-100">
              Redis Queue
            </h2>
            <p class="mt-1 text-sm text-gray-600 leading-6">
              Update your redis queue configurations
            </p>
          </div>

          <div class="md:col-span-2">
            <div class="grid grid-cols-1 w-full gap-x-6 gap-y-8 sm:grid-cols-6">
              <div class="sm:col-span-3">
                <label for="local-driver" class="block text-sm text-gray-900 font-medium leading-6">Driver</label>
                <div class="mt-2">
                  <input id="driver" type="text" name="driver" value="redis" disabled class="block w-full cursor-not-allowed border-0 rounded-md bg-blue-gray-50 py-1.5 text-gray-900 shadow-sm ring-1 ring-gray-300 ring-inset sm:text-sm placeholder:text-gray-400 sm:leading-6 focus:ring-2 focus:ring-indigo-600 focus:ring-inset">
                </div>
              </div>

              <div class="sm:col-span-3">
                <label for="local-root" class="block text-sm text-gray-900 font-medium leading-6">Connection</label>
                <div class="mt-2">
                  <input id="local-root" type="text" name="local-root" value="default" class="block w-full border-0 rounded-md py-1.5 text-gray-900 shadow-sm ring-1 ring-gray-300 ring-inset sm:text-sm placeholder:text-gray-400 sm:leading-6 focus:ring-2 focus:ring-indigo-600 focus:ring-inset">
                </div>
              </div>

              <div class="sm:col-span-3">
                <label for="local-root" class="block text-sm text-gray-900 font-medium leading-6">Queue</label>
                <div class="mt-2">
                  <input id="local-root" type="text" name="local-root" value="default" class="block w-full border-0 rounded-md py-1.5 text-gray-900 shadow-sm ring-1 ring-gray-300 ring-inset sm:text-sm placeholder:text-gray-400 sm:leading-6 focus:ring-2 focus:ring-indigo-600 focus:ring-inset">
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 max-w-7xl gap-x-8 gap-y-10 py-16 md:grid-cols-3">
          <div>
            <h2 class="text-base text-gray-900 font-semibold leading-7 dark:text-gray-100">
              SQS Queue
            </h2>
            <p class="mt-1 text-sm text-gray-600 leading-6">
              Update your sqs queue configurations
            </p>
          </div>

          <div class="md:col-span-2">
            <div class="grid grid-cols-1 w-full gap-x-6 gap-y-8 sm:grid-cols-6">
              <div class="sm:col-span-3">
                <label for="local-driver" class="block text-sm text-gray-900 font-medium leading-6">Driver</label>
                <div class="mt-2">
                  <input id="driver" type="text" name="driver" value="sqs" disabled class="block w-full cursor-not-allowed border-0 rounded-md bg-blue-gray-50 py-1.5 text-gray-900 shadow-sm ring-1 ring-gray-300 ring-inset sm:text-sm placeholder:text-gray-400 sm:leading-6 focus:ring-2 focus:ring-indigo-600 focus:ring-inset">
                </div>
              </div>

              <div class="sm:col-span-3">
                <label for="local-root" class="block text-sm text-gray-900 font-medium leading-6">Key</label>
                <div class="mt-2">
                  <input id="local-root" type="text" name="local-root" value="" class="block w-full border-0 rounded-md py-1.5 text-gray-900 shadow-sm ring-1 ring-gray-300 ring-inset sm:text-sm placeholder:text-gray-400 sm:leading-6 focus:ring-2 focus:ring-indigo-600 focus:ring-inset">
                </div>
              </div>

              <div class="sm:col-span-3">
                <label for="local-root" class="block text-sm text-gray-900 font-medium leading-6">Secret</label>
                <div class="mt-2">
                  <input id="local-root" type="text" name="local-root" value="" class="block w-full border-0 rounded-md py-1.5 text-gray-900 shadow-sm ring-1 ring-gray-300 ring-inset sm:text-sm placeholder:text-gray-400 sm:leading-6 focus:ring-2 focus:ring-indigo-600 focus:ring-inset">
                </div>
              </div>

              <div class="sm:col-span-3">
                <label for="local-root" class="block text-sm text-gray-900 font-medium leading-6">Prefix</label>
                <div class="mt-2">
                  <input id="local-root" type="text" name="local-root" value="" class="block w-full border-0 rounded-md py-1.5 text-gray-900 shadow-sm ring-1 ring-gray-300 ring-inset sm:text-sm placeholder:text-gray-400 sm:leading-6 focus:ring-2 focus:ring-indigo-600 focus:ring-inset">
                </div>
              </div>

              <div class="sm:col-span-3">
                <label for="local-root" class="block text-sm text-gray-900 font-medium leading-6">Suffix</label>
                <div class="mt-2">
                  <input id="local-root" type="text" name="local-root" value="" class="block w-full border-0 rounded-md py-1.5 text-gray-900 shadow-sm ring-1 ring-gray-300 ring-inset sm:text-sm placeholder:text-gray-400 sm:leading-6 focus:ring-2 focus:ring-indigo-600 focus:ring-inset">
                </div>
              </div>

              <div class="sm:col-span-3">
                <label for="local-root" class="block text-sm text-gray-900 font-medium leading-6">Queue</label>
                <div class="mt-2">
                  <input id="local-root" type="text" name="local-root" value="default" class="block w-full border-0 rounded-md py-1.5 text-gray-900 shadow-sm ring-1 ring-gray-300 ring-inset sm:text-sm placeholder:text-gray-400 sm:leading-6 focus:ring-2 focus:ring-indigo-600 focus:ring-inset">
                </div>
              </div>

              <div class="sm:col-span-3">
                <label for="local-root" class="block text-sm text-gray-900 font-medium leading-6">Region</label>
                <div class="mt-2">
                  <input id="local-root" type="text" name="local-root" value="us-east-1" class="block w-full border-0 rounded-md py-1.5 text-gray-900 shadow-sm ring-1 ring-gray-300 ring-inset sm:text-sm placeholder:text-gray-400 sm:leading-6 focus:ring-2 focus:ring-indigo-600 focus:ring-inset">
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
