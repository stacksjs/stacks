<script setup lang="ts">

</script>

<template>
  <form>
    <main class="border-b border-gray-900/10">
      <!-- Settings forms -->
      <div class="divide-y divide-gray-900/10">
        <div class="grid max-w-7xl grid-cols-1 gap-x-8 gap-y-10 py-16 md:grid-cols-3">
          <div>
            <h2 class="text-base font-semibold leading-7 text-gray-900 dark:text-gray-100">
              Default Queue Settings
            </h2>
            <p class="mt-1 text-sm leading-6 text-gray-600">
              Update your default Queue settings
            </p>
          </div>

          <div class="md:col-span-2">
            <div class="w-full grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6">
              <div class="sm:col-span-3">
                <label for="type" class="block text-sm font-medium leading-6 text-gray-900">Default</label>
                <div class="mt-2">
                  <select id="type" name="type" class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:max-w-xs sm:text-sm sm:leading-6">
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

        <div class="grid max-w-7xl grid-cols-1 gap-x-8 gap-y-10 py-16 md:grid-cols-3">
          <div>
            <h2 class="text-base font-semibold leading-7 text-gray-900 dark:text-gray-100">
              Sync Queue
            </h2>
            <p class="mt-1 text-sm leading-6 text-gray-600">
              Update your Sync Queue configurations
            </p>
          </div>

          <div class="md:col-span-2">
            <div class="w-full grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6">
              <div class="sm:col-span-3">
                <label for="local-driver" class="block text-sm font-medium leading-6 text-gray-900">Driver</label>
                <div class="mt-2">
                  <input id="driver" type="text" name="driver" value="sync" disabled class="cursor-not-allowed bg-blue-gray-50 block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6">
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="grid max-w-7xl grid-cols-1 gap-x-8 gap-y-10 py-16 md:grid-cols-3">
          <div>
            <h2 class="text-base font-semibold leading-7 text-gray-900 dark:text-gray-100">
              Database Queue
            </h2>
            <p class="mt-1 text-sm leading-6 text-gray-600">
              Update your database queue configurations
            </p>
          </div>

          <div class="md:col-span-2">
            <div class="w-full grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6">
              <div class="sm:col-span-3">
                <label for="local-driver" class="block text-sm font-medium leading-6 text-gray-900">Driver</label>
                <div class="mt-2">
                  <input id="driver" type="text" name="driver" value="database" disabled class="cursor-not-allowed bg-blue-gray-50 block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6">
                </div>
              </div>

              <div class="sm:col-span-3">
                <label for="local-root" class="block text-sm font-medium leading-6 text-gray-900">Table</label>
                <div class="mt-2">
                  <input id="local-root" type="text" name="local-root" value="jobs" class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6">
                </div>
              </div>

              <div class="sm:col-span-3">
                <label for="local-root" class="block text-sm font-medium leading-6 text-gray-900">Queue</label>
                <div class="mt-2">
                  <input id="local-root" type="text" name="local-root" value="default" class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6">
                </div>
              </div>
            </div>
          </div>
        </div>



        <div class="grid max-w-7xl grid-cols-1 gap-x-8 gap-y-10 py-16 md:grid-cols-3">
          <div>
            <h2 class="text-base font-semibold leading-7 text-gray-900 dark:text-gray-100">
              Redis Queue
            </h2>
            <p class="mt-1 text-sm leading-6 text-gray-600">
              Update your redis queue configurations
            </p>
          </div>

          <div class="md:col-span-2">
            <div class="w-full grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6">
              <div class="sm:col-span-3">
                <label for="local-driver" class="block text-sm font-medium leading-6 text-gray-900">Driver</label>
                <div class="mt-2">
                  <input id="driver" type="text" name="driver" value="redis" disabled class="cursor-not-allowed bg-blue-gray-50 block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6">
                </div>
              </div>

              <div class="sm:col-span-3">
                <label for="local-root" class="block text-sm font-medium leading-6 text-gray-900">Connection</label>
                <div class="mt-2">
                  <input id="local-root" type="text" name="local-root" value="default" class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6">
                </div>
              </div>

              <div class="sm:col-span-3">
                <label for="local-root" class="block text-sm font-medium leading-6 text-gray-900">Queue</label>
                <div class="mt-2">
                  <input id="local-root" type="text" name="local-root" value="default" class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6">
                </div>
              </div>
            </div>
          </div>
        </div>


        <div class="grid max-w-7xl grid-cols-1 gap-x-8 gap-y-10 py-16 md:grid-cols-3">
          <div>
            <h2 class="text-base font-semibold leading-7 text-gray-900 dark:text-gray-100">
              SQS Queue
            </h2>
            <p class="mt-1 text-sm leading-6 text-gray-600">
              Update your sqs queue configurations
            </p>
          </div>

          <div class="md:col-span-2">
            <div class="w-full grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6">
              <div class="sm:col-span-3">
                <label for="local-driver" class="block text-sm font-medium leading-6 text-gray-900">Driver</label>
                <div class="mt-2">
                  <input id="driver" type="text" name="driver" value="sqs" disabled class="cursor-not-allowed bg-blue-gray-50 block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6">
                </div>
              </div>

              <div class="sm:col-span-3">
                <label for="local-root" class="block text-sm font-medium leading-6 text-gray-900">Key</label>
                <div class="mt-2">
                  <input id="local-root" type="text" name="local-root" value="" class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6">
                </div>
              </div>

              <div class="sm:col-span-3">
                <label for="local-root" class="block text-sm font-medium leading-6 text-gray-900">Secret</label>
                <div class="mt-2">
                  <input id="local-root" type="text" name="local-root" value="" class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6">
                </div>
              </div>

              <div class="sm:col-span-3">
                <label for="local-root" class="block text-sm font-medium leading-6 text-gray-900">Prefix</label>
                <div class="mt-2">
                  <input id="local-root" type="text" name="local-root" value="" class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6">
                </div>
              </div>

              <div class="sm:col-span-3">
                <label for="local-root" class="block text-sm font-medium leading-6 text-gray-900">Suffix</label>
                <div class="mt-2">
                  <input id="local-root" type="text" name="local-root" value="" class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6">
                </div>
              </div>

              <div class="sm:col-span-3">
                <label for="local-root" class="block text-sm font-medium leading-6 text-gray-900">Queue</label>
                <div class="mt-2">
                  <input id="local-root" type="text" name="local-root" value="default" class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6">
                </div>
              </div>

              <div class="sm:col-span-3">
                <label for="local-root" class="block text-sm font-medium leading-6 text-gray-900">Region</label>
                <div class="mt-2">
                  <input id="local-root" type="text" name="local-root" value="us-east-1" class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6">
                </div>
              </div>
            </div>
          </div>
        </div>


      </div>
    </main>
    <div class="mt-6 flex items-center justify-end gap-x-6">
      <button type="button" class="text-sm font-semibold leading-6 text-gray-900">
        Cancel
      </button>
      <Button
        type="submit"
        class="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
      >
        Save
      </Button>
    </div>
  </form>
</template>

<style scoped>

</style>
