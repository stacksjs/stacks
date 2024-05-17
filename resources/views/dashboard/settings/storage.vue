<script setup lang="ts">
</script>

<template>
  <main>
    <SettingsHeader />

    <!-- Settings forms -->
    <div class="divide-y divide-white/5">
      <div class="grid max-w-7xl grid-cols-1 gap-x-8 gap-y-10 px-4 py-16 sm:px-6 md:grid-cols-3 lg:px-8">
        <div>
          <h2 class="text-base font-semibold leading-7 text-gray-900 dark:text-gray-100">
            AWS S3
          </h2>
          <p class="mt-1 text-sm leading-6 text-gray-600">
            Update your s3 settings.
          </p>
        </div>

        <form class="md:col-span-2">
          <div class="grid grid-cols-1 gap-x-6 gap-y-8 sm:max-w-xl sm:grid-cols-6">
            <div class="sm:col-span-3">
              <label
                for="s3-key"
                class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-100"
              >Key</label>
              <div class="mt-2">
                <input
                  id="s3-key"
                  type="text"
                  name="name"
                  value="JKHJK$KJAHKS"
                  class="block w-full px-4 py-2 text-gray-900 border border-gray-300 rounded-md shadow-sm required:border-red-500 dark:bg-blue-gray-800 dark:text-gray-200 dark:text-gray-100 dark:border-gray-600 focus:border-none focus:ring-2 focus:ring-blue-500"
                >
              </div>
            </div>

            <div class="sm:col-span-3">
              <label
                for="s3-secret"
                class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-100"
              >Secret</label>
              <div class="mt-2">
                <input
                  id="s3-secret"
                  type="text"
                  name="name"
                  value="kldsanko3njksdasjfasdn2m"
                  class="block w-full px-4 py-2 text-gray-900 border border-gray-300 rounded-md shadow-sm required:border-red-500 dark:bg-blue-gray-800 dark:text-gray-200 dark:text-gray-100 dark:border-gray-600 focus:border-none focus:ring-2 focus:ring-blue-500"
                >
              </div>
            </div>

            <div class="sm:col-span-3">
              <label
                for="aws-region"
                class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-100"
              >Region</label>
              <div class="mt-2">
                <input
                  id="aws-region"
                  type="text"
                  value="us-east-1"
                  class="block w-full px-4 py-2 text-gray-900 border border-gray-300 rounded-md shadow-sm required:border-red-500 dark:bg-blue-gray-800 dark:text-gray-200 dark:text-gray-100 dark:border-gray-600 focus:border-none focus:ring-2 focus:ring-blue-500"
                >
              </div>
            </div>

            <div class="sm:col-span-3">
              <label
                for="aws-bucket"
                class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-100"
              >Bucket</label>
              <div class="mt-2">
                <input
                  id="aws-bucket"
                  type="text"
                  value="stacks"
                  class="block w-full px-4 py-2 text-gray-900 border border-gray-300 rounded-md shadow-sm required:border-red-500 dark:bg-blue-gray-800 dark:text-gray-200 dark:text-gray-100 dark:border-gray-600 focus:border-none focus:ring-2 focus:ring-blue-500"
                >
              </div>
            </div>

            <div class="sm:col-span-full">
              <label
                for="aws-url"
                class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-100"
              >URL</label>
              <div class="mt-2">
                <input
                  id="aws-url"
                  type="text"
                  name="last-name"
                  value="stacks.s3.amazonaws.com"
                  class="block w-full px-4 py-2 text-gray-900 border border-gray-300 rounded-md shadow-sm required:border-red-500 dark:bg-blue-gray-800 dark:text-gray-200 dark:text-gray-100 dark:border-gray-600 focus:border-none focus:ring-2 focus:ring-blue-500"
                >
              </div>
            </div>
          </div>
        </form>
      </div>

      <div class="grid max-w-7xl grid-cols-1 gap-x-8 gap-y-10 px-4 py-16 sm:px-6 md:grid-cols-3 lg:px-8">
        <div>
          <h2 class="text-base font-semibold leading-7 text-gray-900 dark:text-gray-100">
            Dropbox
          </h2>
          <p class="mt-1 text-sm leading-6 text-gray-600">
            Update your Dropbox driver settings.
          </p>
        </div>

        <form class="md:col-span-2">
          <div class="grid grid-cols-1 gap-x-6 gap-y-8 sm:max-w-xl sm:grid-cols-6">
            <div class="sm:col-span-3">
              <label
                for="dropbox-key"
                class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-100"
              >Key</label>
              <div class="mt-2">
                <input
                  id="dropbox-key"
                  type="text"
                  value="JKHJK$KJAHKS"
                  class="block w-full px-4 py-2 text-gray-900 border border-gray-300 rounded-md shadow-sm required:border-red-500 dark:bg-blue-gray-800 dark:text-gray-200 dark:text-gray-100 dark:border-gray-600 focus:border-none focus:ring-2 focus:ring-blue-500"
                >
              </div>
            </div>

            <div class="sm:col-span-3">
              <label
                for="dropbox-secret"
                class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-100"
              >Secret</label>
              <div class="mt-2">
                <input
                  id="dropbox-secret"
                  type="text"
                  name="name"
                  value="kldsanko3njksdasjfasdn2m"
                  class="block w-full px-4 py-2 text-gray-900 border border-gray-300 rounded-md shadow-sm required:border-red-500 dark:bg-blue-gray-800 dark:text-gray-200 dark:text-gray-100 dark:border-gray-600 focus:border-none focus:ring-2 focus:ring-blue-500"
                >
              </div>
            </div>

            <div class="sm:col-span-full">
              <label
                for="dropbox-box"
                class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-100"
              >Box</label>
              <div class="mt-2">
                <input
                  id="dropbox-box"
                  type="text"
                  value="stacks"
                  class="block w-full px-4 py-2 text-gray-900 border border-gray-300 rounded-md shadow-sm required:border-red-500 dark:bg-blue-gray-800 dark:text-gray-200 dark:text-gray-100 dark:border-gray-600 focus:border-none focus:ring-2 focus:ring-blue-500"
                >
              </div>
            </div>
          </div>
        </form>
      </div>

      <div class="grid max-w-7xl grid-cols-1 gap-x-8 gap-y-10 px-4 py-16 sm:px-6 md:grid-cols-3 lg:px-8">
        <div>
          <h2 class="text-base font-semibold leading-7 text-gray-900 dark:text-gray-100">
            Meema
          </h2>
          <p class="mt-1 text-sm leading-6 text-gray-600">
            Update your meema driver settings.
          </p>
        </div>

        <form class="md:col-span-2">
          <div class="grid grid-cols-1 gap-x-6 gap-y-8 sm:max-w-xl sm:grid-cols-6">
            <div class="sm:col-span-3">
              <label
                for="meema-key"
                class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-100"
              >Key</label>
              <div class="mt-2">
                <input
                  id="meema-key"
                  type="text"
                  name="name"
                  value="HJDSU41HJJKAD"
                  class="block w-full px-4 py-2 text-gray-900 border border-gray-300 rounded-md shadow-sm required:border-red-500 dark:bg-blue-gray-800 dark:text-gray-200 dark:text-gray-100 dark:border-gray-600 focus:border-none focus:ring-2 focus:ring-blue-500"
                >
              </div>
            </div>

            <div class="sm:col-span-3">
              <label
                for="meema-secret"
                class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-100"
              >Secret</label>
              <div class="mt-2">
                <input
                  id="meema-secret"
                  type="text"
                  value="jkhnb523nbmnb9dsanmeop"
                  class="block w-full px-4 py-2 text-gray-900 border border-gray-300 rounded-md shadow-sm required:border-red-500 dark:bg-blue-gray-800 dark:text-gray-200 dark:text-gray-100 dark:border-gray-600 focus:border-none focus:ring-2 focus:ring-blue-500"
                >
              </div>
            </div>

            <div class="sm:col-span-3">
              <label
                for="meema-region"
                class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-100"
              >Region</label>
              <div class="mt-2">
                <input
                  id="meema-region"
                  type="text"
                  value="us-east-1"
                  class="block w-full px-4 py-2 text-gray-900 border border-gray-300 rounded-md shadow-sm required:border-red-500 dark:bg-blue-gray-800 dark:text-gray-200 dark:text-gray-100 dark:border-gray-600 focus:border-none focus:ring-2 focus:ring-blue-500"
                >
              </div>
            </div>

            <div class="sm:col-span-3">
              <label
                for="meema-bucket"
                class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-100"
              >Baacket</label>
              <div class="mt-2">
                <input
                  id="meema-bucket"
                  type="text"
                  value="stacks"
                  class="block w-full px-4 py-2 text-gray-900 border border-gray-300 rounded-md shadow-sm required:border-red-500 dark:bg-blue-gray-800 dark:text-gray-200 dark:text-gray-100 dark:border-gray-600 focus:border-none focus:ring-2 focus:ring-blue-500"
                >
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  </main>
</template>
