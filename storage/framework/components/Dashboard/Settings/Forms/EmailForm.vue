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
              Default Email Settings
            </h2>
            <p class="mt-1 text-sm text-gray-600 leading-6">
              Update your default email settings
            </p>
          </div>

          <div class="md:col-span-2">
            <div class="grid grid-cols-1 w-full gap-x-6 gap-y-8 sm:grid-cols-6">
              <div class="sm:col-span-3">
                <label for="from" class="block text-sm text-gray-900 font-medium leading-6">From Name</label>
                <div class="mt-2">
                  <input id="from" type="text" name="from" value="Stacks" class="block w-full border-0 rounded-md py-1.5 text-gray-900 shadow-sm ring-1 ring-gray-300 ring-inset sm:text-sm placeholder:text-gray-400 sm:leading-6 focus:ring-2 focus:ring-indigo-600 focus:ring-inset">
                </div>
              </div>

              <div class="sm:col-span-3">
                <label for="address" class="block text-sm text-gray-900 font-medium leading-6">From Address</label>
                <div class="mt-2">
                  <input id="address" type="text" name="address" value="no-reply@stacksjs.org" class="block w-full border-0 rounded-md py-1.5 text-gray-900 shadow-sm ring-1 ring-gray-300 ring-inset sm:text-sm placeholder:text-gray-400 sm:leading-6 focus:ring-2 focus:ring-indigo-600 focus:ring-inset">
                </div>
              </div>

              <div class="sm:col-span-full">
                <label for="mailboxes" class="block text-sm text-gray-900 font-medium leading-6">Mailboxes</label>
                <div class="mt-2">
                  <input id="maiboxes" type="text" name="mailboxes" value="chris@stacksjs.org,blake@stacksjs.org,glenn@stacksjs.org" class="block w-full border-0 rounded-md py-1.5 text-gray-900 shadow-sm ring-1 ring-gray-300 ring-inset sm:text-sm placeholder:text-gray-400 sm:leading-6 focus:ring-2 focus:ring-indigo-600 focus:ring-inset">
                </div>
              </div>

              <div class="sm:col-span-3">
                <label for="url" class="block text-sm text-gray-900 font-medium leading-6">Url</label>
                <div class="mt-2">
                  <input id="url" type="text" name="url" value="http://localhost:3000" class="block w-full border-0 rounded-md py-1.5 text-gray-900 shadow-sm ring-1 ring-gray-300 ring-inset sm:text-sm placeholder:text-gray-400 sm:leading-6 focus:ring-2 focus:ring-indigo-600 focus:ring-inset">
                </div>
              </div>

              <div class="sm:col-span-3">
                <label for="type" class="block text-sm text-gray-900 font-medium leading-6">Charset</label>
                <div class="mt-2">
                  <select id="type" name="type" class="block w-full border-0 rounded-md py-1.5 text-gray-900 shadow-sm ring-1 ring-gray-300 ring-inset sm:max-w-xs sm:text-sm sm:leading-6 focus:ring-2 focus:ring-indigo-600 focus:ring-inset">
                    <option selected>
                      UTF-8
                    </option>
                  </select>
                </div>
              </div>

              <div class="sm:col-span-2">
                <label for="default-config" class="block text-sm text-gray-900 font-medium leading-6">Scan Server</label>
                <div class="mt-2">
                  <!-- Enabled: "bg-indigo-600", Not Enabled: "bg-gray-200" -->
                  <button
                    type="button"
                    class="relative h-6 w-11 inline-flex flex-shrink-0 cursor-pointer border-2 border-transparent rounded-full bg-indigo-600 transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-600"
                    role="switch" aria-checked="false"
                  >
                    <span class="sr-only">Enable Docs</span>
                    <!-- Enabled: "translate-x-5", Not Enabled: "translate-x-0" -->
                    <span
                      aria-hidden="true"
                      class="pointer-events-none inline-block h-5 w-5 translate-x-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
                    />
                  </button>
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
