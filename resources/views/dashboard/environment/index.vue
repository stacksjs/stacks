<script setup lang="ts">
const envValues = ref('')

useHead({
  title: 'Dashboard - Environment',
})
</script>

<template>
  <div class="min-h-screen py-4 dark:bg-blue-gray-800 lg:py-8">
    <div class="px-4 lg:px-8 sm:px-6">
      <div class="sm:flex sm:items-center">
        <div class="sm:flex-auto">
          <h1 class="text-base text-gray-900 font-semibold leading-6">
            Environment Variables
          </h1>
          <p class="mt-2 text-sm text-gray-700">
            This is your project's <code class="text-red-400">.env</code> file. Be careful when editing production values.
          </p>
        </div>
        <!-- <div class="mt-4 sm:ml-16 sm:mt-0 sm:flex-none">
          <button type="button" class="block rounded-md bg-blue-600 px-3 py-2 text-center text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
            Add Record
          </button>
        </div> -->
      </div>

      <div class="mt-8 flow-root">
        <div class="overflow-x-auto -mx-4 -my-2 lg:-mx-8 sm:-mx-6">
          <div class="inline-block min-w-full py-2 align-middle lg:px-8 sm:px-6">
            <div class="overflow-hidden sm:rounded-lg">
              <form class="">
                <textarea id="comment" v-model="envValues" v-highlightjs rows="10" name="comment" class="block w-full border-0 rounded-md py-1.5 text-gray-900 shadow-sm ring-1 ring-gray-300 ring-inset sm:text-sm placeholder:text-gray-400 sm:leading-6 focus:ring-2 focus:ring-blue-600 focus:ring-inset" />
                <div class="mt-4 flex justify-end">
                  <AppButton passed-class="primary-button" loading-text="Saving..." button-text="Save" />
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
