<script setup lang="ts">
const envValues = ref('')
const envReader = useEnvReader()

onMounted(async () => {
  envValues.value = await envReader.read()
})

useHead({
  title: 'Dashboard - Environment',
})
</script>

<template>
  <div class="px-4 sm:px-6 lg:px-8 py-8">
    <form class="rounded-lg bg-white px-6 py-4 text-sm dark:bg-blue-gray-800">
      <div class="flex items-center justify-between">
        <h5 class="dark:text-gray-100">
          Commands
        </h5>
      </div>
      <div class="py-2">
        <div class="bg-gray-50 text-gray-600 dark:bg-blue-gray-700 dark:text-gray-400 flex flex-row rounded-lg p-4 text-sm">
          <div class="i-heroicons-information-circle text-gray-400 h-6 w-6 flex-shrink-0" />
          <div class="ml-4 mt-0.5 flex flex-grow">
            <p class="">
              Below you may edit the <code class="text-red-400">.env</code> file for your application, which is the default environment file that is loaded by Laravel applications. If the application is uninstalled, the environment file will also be removed.
            </p>
          </div>
        </div>
      </div>
      <div class="mt-8">
        <textarea
          v-highlightjs
          rows="10"
          class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-800 dark:text-gray-100"
        >
          {{ envValues }}
        </textarea>
      </div>
      <div>
        <div class="mt-4 flex justify-end">
          <AppButton passed-class="primary-button" loading-text="Saving..." button-text="Save" />
        </div>
      </div>
    </form>
  </div>
</template>
