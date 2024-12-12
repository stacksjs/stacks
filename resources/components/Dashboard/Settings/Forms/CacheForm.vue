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
              DynamoDB
            </h2>
            <p class="mt-1 text-sm text-gray-600 leading-6">
              Update your dynamoDB settings.
            </p>
          </div>

          <div class="md:col-span-2">
            <div class="grid grid-cols-1 w-full gap-x-6 gap-y-8 sm:grid-cols-6">
              <div class="sm:col-span-3">
                <label
                  for="dynamo-host"
                  class="block cursor-pointer text-sm text-gray-900 font-medium leading-6 dark:text-gray-100"
                >Host</label>
                <div class="mt-2">
                  <input
                    id="dynamo-host"
                    type="text"
                    name="name"
                    value="stacks.s3.amazonaws.com"
                    class="block w-full border border-gray-300 rounded-md px-4 py-2 text-gray-900 shadow-sm dark:border-gray-600 required:border-red-500 focus:border-none dark:bg-blue-gray-800 dark:text-gray-100 dark:text-gray-200 focus:ring-2 focus:ring-blue-500"
                  >
                </div>
              </div>

              <div class="sm:col-span-3">
                <label
                  for="dynamo-key"
                  class="block cursor-pointer text-sm text-gray-900 font-medium leading-6 dark:text-gray-100"
                >Key</label>
                <div class="mt-2">
                  <input
                    id="dynamo-key"
                    type="text"
                    name="name"
                    value="kldsanko3njksdasjfasdn2m"
                    class="block w-full border border-gray-300 rounded-md px-4 py-2 text-gray-900 shadow-sm dark:border-gray-600 required:border-red-500 focus:border-none dark:bg-blue-gray-800 dark:text-gray-100 dark:text-gray-200 focus:ring-2 focus:ring-blue-500"
                  >
                </div>
              </div>

              <div class="sm:col-span-3">
                <label
                  for="dynamo-secret"
                  class="block cursor-pointer text-sm text-gray-900 font-medium leading-6 dark:text-gray-100"
                >Secret</label>
                <div class="mt-2">
                  <input
                    id="dynamo-secret"
                    type="text"
                    name="last-name"
                    autocomplete="family-name"
                    value="kldsanko3njksdasjfasdn2m"
                    class="block w-full border border-gray-300 rounded-md px-4 py-2 text-gray-900 shadow-sm dark:border-gray-600 required:border-red-500 focus:border-none dark:bg-blue-gray-800 dark:text-gray-100 dark:text-gray-200 focus:ring-2 focus:ring-blue-500"
                  >
                </div>
              </div>

              <div class="sm:col-span-3">
                <label
                  for="dynamo-region"
                  class="block cursor-pointer text-sm text-gray-900 font-medium leading-6 dark:text-gray-100"
                >Region</label>
                <div class="mt-2">
                  <input
                    id="dynamo-region"
                    type="text"
                    name="last-name"
                    value="us-east-1"
                    autocomplete="family-name"
                    class="block w-full border border-gray-300 rounded-md px-4 py-2 text-gray-900 shadow-sm dark:border-gray-600 required:border-red-500 focus:border-none dark:bg-blue-gray-800 dark:text-gray-100 dark:text-gray-200 focus:ring-2 focus:ring-blue-500"
                  >
                </div>
              </div>
              <div class="sm:col-span-3">
                <label
                  for="dynamo-table"
                  class="block cursor-pointer text-sm text-gray-900 font-medium leading-6 dark:text-gray-100"
                >Table</label>
                <div class="mt-2">
                  <input
                    id="dynamo-table"
                    type="text"
                    name="last-name"
                    autocomplete="family-name"
                    value="cache"
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
              Memcached
            </h2>
            <p class="mt-1 text-sm text-gray-600 leading-6">
              Update your memcached settings.
            </p>
          </div>

          <div class="md:col-span-2">
            <div class="grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6">
              <div class="col-span-full">
                <label
                  for="memcached-persistent-id"
                  class="block cursor-pointer text-sm text-gray-900 font-medium leading-6 dark:text-gray-100"
                >Persistent ID</label>
                <div class="mt-2">
                  <input
                    id="memcached-persistent-id"
                    type="text"
                    value="hj3jknkjh1kjh5"
                    class="block w-full border border-gray-300 rounded-md px-4 py-2 text-gray-900 shadow-sm dark:border-gray-600 required:border-red-500 focus:border-none dark:bg-blue-gray-800 dark:text-gray-100 dark:text-gray-200 focus:ring-2 focus:ring-blue-500"
                  >
                </div>
              </div>

              <div class="col-span-3">
                <label
                  for="memcached-username"
                  class="block cursor-pointer text-sm text-gray-900 font-medium leading-6 dark:text-gray-100"
                >Username</label>
                <div class="mt-2">
                  <input
                    id="memcached-username"
                    name="new_password"
                    type="text"
                    value="username"
                    class="block w-full border border-gray-300 rounded-md px-4 py-2 text-gray-900 shadow-sm dark:border-gray-600 required:border-red-500 focus:border-none dark:bg-blue-gray-800 dark:text-gray-100 dark:text-gray-200 focus:ring-2 focus:ring-blue-500"
                  >
                </div>
              </div>

              <div class="col-span-3">
                <label
                  for="memcached-password"
                  class="block cursor-pointer text-sm text-gray-900 font-medium leading-6 dark:text-gray-100"
                >Password</label>
                <div class="mt-2">
                  <input
                    id="memcached-password"
                    type="password"
                    value="test@123"
                    class="block w-full border border-gray-300 rounded-md px-4 py-2 text-gray-900 shadow-sm dark:border-gray-600 required:border-red-500 focus:border-none dark:bg-blue-gray-800 dark:text-gray-100 dark:text-gray-200 focus:ring-2 focus:ring-blue-500"
                  >
                </div>
              </div>

              <div class="col-span-3">
                <label
                  for="memcached-host"
                  class="block cursor-pointer text-sm text-gray-900 font-medium leading-6 dark:text-gray-100"
                >Host</label>
                <div class="mt-2">
                  <input
                    id="memcached-host"
                    type="text"
                    value="stacks.s3.amazonaws.com"
                    class="block w-full border border-gray-300 rounded-md px-4 py-2 text-gray-900 shadow-sm dark:border-gray-600 required:border-red-500 focus:border-none dark:bg-blue-gray-800 dark:text-gray-100 dark:text-gray-200 focus:ring-2 focus:ring-blue-500"
                  >
                </div>
              </div>

              <div class="col-span-3">
                <label
                  for="memcached-port"
                  class="block cursor-pointer text-sm text-gray-900 font-medium leading-6 dark:text-gray-100"
                >Port</label>
                <div class="mt-2">
                  <input
                    id="memcached-port"
                    type="text"
                    value="11211"
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
              Redis
            </h2>
            <p class="mt-1 text-sm text-gray-600 leading-6">
              Update your redis settings.
            </p>
          </div>

          <div class="md:col-span-2">
            <div class="grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6">
              <div class="col-span-3">
                <label
                  for="redis-host"
                  class="block cursor-pointer text-sm text-gray-900 font-medium leading-6 dark:text-gray-100"
                >Host</label>
                <div class="mt-2">
                  <input
                    id="redis-host"
                    name="new_password"
                    type="text"
                    value="127.0.0.1"
                    class="block w-full border border-gray-300 rounded-md px-4 py-2 text-gray-900 shadow-sm dark:border-gray-600 required:border-red-500 focus:border-none dark:bg-blue-gray-800 dark:text-gray-100 dark:text-gray-200 focus:ring-2 focus:ring-blue-500"
                  >
                </div>
              </div>

              <div class="col-span-3">
                <label
                  for="redis-port"
                  class="block cursor-pointer text-sm text-gray-900 font-medium leading-6 dark:text-gray-100"
                >Port</label>
                <div class="mt-2">
                  <input
                    id="redis-port"
                    type="text"
                    value="6379"
                    class="block w-full border border-gray-300 rounded-md px-4 py-2 text-gray-900 shadow-sm dark:border-gray-600 required:border-red-500 focus:border-none dark:bg-blue-gray-800 dark:text-gray-100 dark:text-gray-200 focus:ring-2 focus:ring-blue-500"
                  >
                </div>
              </div>

              <div class="col-span-full">
                <label
                  for="redis-password"
                  class="block cursor-pointer text-sm text-gray-900 font-medium leading-6 dark:text-gray-100"
                >Password</label>
                <div class="mt-2">
                  <input
                    id="redis-password"
                    type="password"
                    value=""
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
