<script setup lang="ts">
const envValues = ref('')

useHead({
  title: 'Dashboard - Environment',
})
</script>

<template>
  <div class="min-h-screen py-4 lg:py-8 dark:bg-blue-gray-800">
    <div class="px-4 sm:px-6 lg:px-8">
      <div class="sm:flex sm:items-center">
        <div class="sm:flex-auto">
          <h1 class="text-base font-semibold leading-6 text-gray-900">
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
        <div class="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div class="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
            <div class="overflow-hidden sm:rounded-lg">
              <form class="">
                <textarea id="comment" v-model="envValues" v-highlightjs rows="10" name="comment" class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6" />
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
