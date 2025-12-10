<script setup lang="ts">

</script>

<template>
  <form>
    <div class="space-y-12">
      <div class="border-b border-gray-900/10 pb-12">
        <div class="grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6">
          <div class="sm:col-span-3">
            <label for="name" class="block text-sm text-gray-900 font-medium leading-6">App Name</label>
            <div class="mt-2">
              <input id="name" type="text" name="name" placeholder="App Name" value="Stacks" class="block w-full border-0 rounded-md py-1.5 text-gray-900 shadow-sm ring-1 ring-gray-300 ring-inset sm:text-sm placeholder:text-gray-400 sm:leading-6 focus:ring-2 focus:ring-indigo-600 focus:ring-inset">
            </div>
          </div>
          <div class="sm:col-span-3">
            <label for="key" class="block text-sm text-gray-900 font-medium leading-6">App Key</label>
            <div class="mt-2">
              <input id="key" type="text" name="key" placeholder="" value="" class="block w-full border-0 rounded-md py-1.5 text-gray-900 shadow-sm ring-1 ring-gray-300 ring-inset sm:text-sm placeholder:text-gray-400 sm:leading-6 focus:ring-2 focus:ring-indigo-600 focus:ring-inset">
            </div>
          </div>
          <div class="sm:col-span-3">
            <label for="env" class="block text-sm text-gray-900 font-medium leading-6">App Url</label>
            <div class="mt-2">
              <input id="env" type="text" name="env" placeholder="https://test.test" value="stacks.localhost" class="block w-full border-0 rounded-md py-1.5 text-gray-900 shadow-sm ring-1 ring-gray-300 ring-inset sm:text-sm placeholder:text-gray-400 sm:leading-6 focus:ring-2 focus:ring-indigo-600 focus:ring-inset">
            </div>
          </div>

          <div class="sm:col-span-full">
            <label for="description" class="block text-sm text-gray-900 font-medium leading-6">Description</label>
            <div class="mt-2">
              <textarea id="description" name="description" rows="3" class="block w-full border-0 rounded-md py-1.5 text-gray-900 shadow-sm ring-1 ring-gray-300 ring-inset sm:text-sm placeholder:text-gray-400 sm:leading-6 focus:ring-2 focus:ring-indigo-600 focus:ring-inset" />
            </div>
          </div>

          <div class="sm:col-span-3">
            <label for="env" class="block text-sm text-gray-900 font-medium leading-6">Environment</label>
            <div class="mt-2">
              <input id="env" type="text" name="env" placeholder="production" value="local" class="block w-full border-0 rounded-md py-1.5 text-gray-900 shadow-sm ring-1 ring-gray-300 ring-inset sm:text-sm placeholder:text-gray-400 sm:leading-6 focus:ring-2 focus:ring-indigo-600 focus:ring-inset">
            </div>
          </div>

          <div class="sm:col-span-3">
            <label for="env" class="block text-sm text-gray-900 font-medium leading-6">Redirect Urls</label>
            <div class="mt-2">
              <input id="env" type="text" name="env" placeholder="https://test.test" value="stacks.localhost,localhost:3000,stack.com" class="block w-full border-0 rounded-md py-1.5 text-gray-900 shadow-sm ring-1 ring-gray-300 ring-inset sm:text-sm placeholder:text-gray-400 sm:leading-6 focus:ring-2 focus:ring-indigo-600 focus:ring-inset">
            </div>
          </div>

          <div class="sm:col-span-2">
            <label for="default-config" class="block text-sm text-gray-900 font-medium leading-6">Deploy AI
              Endpoints</label>
            <div class="mt-2">
              <!-- Enabled: "bg-indigo-600", Not Enabled: "bg-gray-200" -->
              <button
                type="button"
                class="relative h-6 w-11 inline-flex flex-shrink-0 cursor-pointer border-2 border-transparent rounded-full bg-gray-200 transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-600"
                role="switch" aria-checked="false"
              >
                <span class="sr-only">App Debug</span>
                <!-- Enabled: "translate-x-5", Not Enabled: "translate-x-0" -->
                <span
                  aria-hidden="true"
                  class="pointer-events-none inline-block h-5 w-5 translate-x-0 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
                />
              </button>
            </div>
          </div>
          <div class="sm:col-span-2">
            <label for="default-config" class="block text-sm text-gray-900 font-medium leading-6">Maintenance Mode</label>
            <div class="mt-2">
              <!-- Enabled: "bg-indigo-600", Not Enabled: "bg-gray-200" -->
              <button
                type="button"
                class="relative h-6 w-11 inline-flex flex-shrink-0 cursor-pointer border-2 border-transparent rounded-full bg-gray-200 transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-600"
                role="switch" aria-checked="false"
              >
                <span class="sr-only">Maintenance Mode</span>
                <!-- Enabled: "translate-x-5", Not Enabled: "translate-x-0" -->
                <span
                  aria-hidden="true"
                  class="pointer-events-none inline-block h-5 w-5 translate-x-0 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
                />
              </button>
            </div>
          </div>
          <div class="sm:col-span-2">
            <label for="default-config" class="block text-sm text-gray-900 font-medium leading-6">Doc Mode</label>
            <div class="mt-2">
              <!-- Enabled: "bg-indigo-600", Not Enabled: "bg-gray-200" -->
              <button
                type="button"
                class="relative h-6 w-11 inline-flex flex-shrink-0 cursor-pointer border-2 border-transparent rounded-full bg-indigo-600 transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-600"
                role="switch" aria-checked="false"
              >
                <span class="sr-only">Doc Mode</span>
                <!-- Enabled: "translate-x-5", Not Enabled: "translate-x-0" -->
                <span
                  aria-hidden="true"
                  class="pointer-events-none inline-block h-5 w-5 translate-x-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
                />
              </button>
            </div>
          </div>

          <div class="sm:col-span-2">
            <label for="timezone" class="block text-sm text-gray-900 font-medium leading-6">Timezone</label>
            <div class="mt-2">
              <input id="timezone" type="text" name="timezone" placeholder="UTC" value="America/Los_Angeles" class="block w-full border-0 rounded-md py-1.5 text-gray-900 shadow-sm ring-1 ring-gray-300 ring-inset sm:text-sm placeholder:text-gray-400 sm:leading-6 focus:ring-2 focus:ring-indigo-600 focus:ring-inset">
            </div>
          </div>
          <div class="sm:col-span-2">
            <label for="locale" class="block text-sm text-gray-900 font-medium leading-6">Locale</label>
            <div class="mt-2">
              <input id="locale" type="text" name="locale" placeholder="UTC" value="en" class="block w-full border-0 rounded-md py-1.5 text-gray-900 shadow-sm ring-1 ring-gray-300 ring-inset sm:text-sm placeholder:text-gray-400 sm:leading-6 focus:ring-2 focus:ring-indigo-600 focus:ring-inset">
            </div>
          </div>
          <div class="sm:col-span-2">
            <label for="fallback-locale" class="block text-sm text-gray-900 font-medium leading-6">Fallback Locale</label>
            <div class="mt-2">
              <input id="fallback-locale" type="text" name="fallback-locale" placeholder="UTC" value="en" class="block w-full border-0 rounded-md py-1.5 text-gray-900 shadow-sm ring-1 ring-gray-300 ring-inset sm:text-sm placeholder:text-gray-400 sm:leading-6 focus:ring-2 focus:ring-indigo-600 focus:ring-inset">
            </div>
          </div>
          <div class="sm:col-span-2">
            <label for="cipher" class="block text-sm text-gray-900 font-medium leading-6">Cipher</label>
            <div class="mt-2">
              <input id="cipher" type="text" name="cipher" placeholder="AES-256-CBC" value="aes-256-cbc" class="block w-full border-0 rounded-md py-1.5 text-gray-900 shadow-sm ring-1 ring-gray-300 ring-inset sm:text-sm placeholder:text-gray-400 sm:leading-6 focus:ring-2 focus:ring-indigo-600 focus:ring-inset">
            </div>
          </div>
        </div>
      </div>
    </div>
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
