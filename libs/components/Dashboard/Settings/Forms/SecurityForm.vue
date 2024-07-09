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
              Firewall
            </h2>
            <p class="mt-1 text-sm leading-6 text-gray-600">
              Update your firewall settings.
            </p>
          </div>

          <div class="md:col-span-2">
            <div class="grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6">
              <div class="col-span-2">
                <label
                  for="api-deploy"
                  class="block cursor-pointer text-sm font-medium leading-6 text-gray-900 dark:text-gray-100"
                >Enabled</label>
                <div class="mt-2">
                  <!-- Enabled: "bg-indigo-600", Not Enabled: "bg-gray-200" -->
                  <button
                    type="button"
                    class="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent bg-indigo-600 transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2"
                    role="switch" aria-checked="false"
                  >
                    <span class="sr-only">Api Deploy</span>
                    <!-- Enabled: "translate-x-5", Not Enabled: "translate-x-0" -->
                    <span
                      aria-hidden="true"
                      class="pointer-events-none inline-block h-5 w-5 translate-x-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
                    />
                  </button>
                </div>
              </div>
              <div class="col-span-2">
                <label
                  for="api-deploy"
                  class="block cursor-pointer text-sm font-medium leading-6 text-gray-900 dark:text-gray-100"
                >Use Ip Reputation Lists</label>
                <div class="mt-2">
                  <!-- Enabled: "bg-indigo-600", Not Enabled: "bg-gray-200" -->
                  <button
                    type="button"
                    class="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent bg-indigo-600 transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2"
                    role="switch" aria-checked="false"
                  >
                    <span class="sr-only">Use Ip Reputation Lists</span>
                    <!-- Enabled: "translate-x-5", Not Enabled: "translate-x-0" -->
                    <span
                      aria-hidden="true"
                      class="pointer-events-none inline-block h-5 w-5 translate-x-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
                    />
                  </button>
                </div>
              </div>
              <div class="col-span-2">
                <label
                  for="api-deploy"
                  class="block cursor-pointer text-sm font-medium leading-6 text-gray-900 dark:text-gray-100"
                >Use Known Bad Inputs Rule Set</label>
                <div class="mt-2">
                  <!-- Enabled: "bg-indigo-600", Not Enabled: "bg-gray-200" -->
                  <button
                    type="button"
                    class="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent bg-indigo-600 transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2"
                    role="switch" aria-checked="false"
                  >
                    <span class="sr-only">Use Ip Reputation Lists</span>
                    <!-- Enabled: "translate-x-5", Not Enabled: "translate-x-0" -->
                    <span
                      aria-hidden="true"
                      class="pointer-events-none inline-block h-5 w-5 translate-x-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
                    />
                  </button>
                </div>
              </div>
              <div class="col-span-2">
                <label
                  for="api-limit-per-minute"
                  class="block cursor-pointer text-sm font-medium leading-6 text-gray-900 dark:text-gray-100"
                >Rate Limit per minute</label>
                <div class="mt-2">
                  <input
                    id="api-limit-per-minute"
                    name="limit-per-minute"
                    type="text"
                    value="1000"
                    class="block w-full px-4 py-2 text-gray-900 border border-gray-300 rounded-md shadow-sm required:border-red-500 dark:bg-blue-gray-800 dark:text-gray-200 dark:text-gray-100 dark:border-gray-600 focus:border-none focus:ring-2 focus:ring-blue-500"
                  >
                </div>
              </div>
              <div class="col-span-2">
                <label
                  for="api-country-codes"
                  class="block cursor-pointer text-sm font-medium leading-6 text-gray-900 dark:text-gray-100"
                >Country Codes</label>
                <div class="mt-2">
                  <input
                    id="api-country-codes"
                    name="limit-per-minute"
                    type="text"
                    value="RU,IN"
                    class="block w-full px-4 py-2 text-gray-900 border border-gray-300 rounded-md shadow-sm required:border-red-500 dark:bg-blue-gray-800 dark:text-gray-200 dark:text-gray-100 dark:border-gray-600 focus:border-none focus:ring-2 focus:ring-blue-500"
                  >
                </div>
              </div>
              <div class="sm:col-span-full">
                <label for="ip-addresses" class="block text-sm font-medium leading-6 text-gray-900">IP Addresses</label>
                <div class="mt-2">
                  <input id="ip-addresses" type="text" name="env" placeholder="https://test.test" value="56.123.456.789" class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6">
                </div>
              </div>
              <div class="sm:col-span-3">
                <label for="query-string" class="block text-sm font-medium leading-6 text-gray-900">Query String</label>
                <div class="mt-2">
                  <input id="query-string" type="text" name="env" placeholder="https://test.test" value="foo,bar" class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6">
                </div>
              </div>
              <div class="sm:col-span-3">
                <label for="http-headers" class="block text-sm font-medium leading-6 text-gray-900">HTTP Headers</label>
                <div class="mt-2">
                  <input id="http-headers" type="text" name="env" placeholder="https://test.test" value="x-foo,x-bar" class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6">
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
