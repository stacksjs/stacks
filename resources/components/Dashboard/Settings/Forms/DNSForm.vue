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
              Nameservers
            </h2>
            <p class="mt-1 text-sm leading-6 text-gray-600">
              Update your Name servers settings.
            </p>
          </div>

          <div class="md:col-span-2">
            <div class="grid grid-cols-1 gap-x-6 gap-y-8 sm:max-w-xl sm:grid-cols-6">
              <div class="sm:col-span-full">
                <label
                  for="nameservers"
                  class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-100"
                >Nameservers</label>
                <div class="mt-2">
                  <input
                    id="nameservers"
                    type="text"
                    name="nameservers"
                    class="block w-full px-4 py-2 text-gray-900 border border-gray-300 rounded-md shadow-sm required:border-red-500 dark:bg-blue-gray-800 dark:text-gray-200 dark:text-gray-100 dark:border-gray-600 focus:border-none focus:ring-2 focus:ring-blue-500"
                  >
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="grid max-w-7xl grid-cols-1 gap-x-8 gap-y-10 py-16">
          <div>
            <h2 class="text-base font-semibold leading-7 text-gray-900 dark:text-gray-100">
              A Records
            </h2>
            <p class="mt-1 text-sm leading-6 text-gray-600">
              Update your A Records.
            </p>
          </div>

          <div>
            <table class="min-w-full divide-y divide-gray-300">
              <thead>
                <tr>
                  <th scope="col" class="uppercase py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-0">
                    Name
                  </th>
                  <th scope="col" class="uppercase hidden px-3 py-3.5 text-left text-sm font-semibold text-gray-900 lg:table-cell">
                    Address
                  </th>
                  <th scope="col" class="uppercase px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                    ttl
                  </th>
                  <th scope="col" class="relative py-3.5 pl-3 pr-4 sm:pr-0">
                    <span class="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200 bg-white">
                <tr>
                  <td class="w-full max-w-0 py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:w-auto sm:max-w-none sm:pl-0">
                    localhost
                    <dl class="font-normal lg:hidden">
                      <dt class="sr-only">
                        Address
                      </dt>
                      <dd class="mt-1 truncate text-gray-700">
                        10.0.0.1
                      </dd>
                      <dt class="sr-only sm:hidden">
                        TTL
                      </dt>
                      <dd class="mt-1 truncate text-gray-500 sm:hidden">
                        300
                      </dd>
                    </dl>
                  </td>
                  <td class="hidden px-3 py-4 text-sm text-gray-500 lg:table-cell">
                    10.0.0.1
                  </td>
                  <td class="hidden px-3 py-4 text-sm text-gray-500 sm:table-cell">
                    300
                  </td>
                  <td class="py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-0 space-x-6">
                    <a href="#" class="font-semibold text-gray-400 hover:text-gray-600">Delete<span class="sr-only">, localhost</span></a>
                    <a href="#" class="font-semibold text-indigo-600 hover:text-indigo-900">Edit<span class="sr-only">, localhost</span></a>
                  </td>
                </tr>
                <tr>
                  <td class="w-full max-w-0 py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:w-auto sm:max-w-none sm:pl-0">
                    www
                    <dl class="font-normal lg:hidden">
                      <dt class="sr-only">
                        Address
                      </dt>
                      <dd class="mt-1 truncate text-gray-700">
                        @
                      </dd>
                      <dt class="sr-only sm:hidden">
                        TTL
                      </dt>
                      <dd class="mt-1 truncate text-gray-500 sm:hidden">
                        300
                      </dd>
                    </dl>
                  </td>
                  <td class="hidden px-3 py-4 text-sm text-gray-500 lg:table-cell">
                    @
                  </td>
                  <td class="hidden px-3 py-4 text-sm text-gray-500 sm:table-cell">
                    300
                  </td>
                  <td class="py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-0 space-x-6">
                    <a href="#" class="font-semibold text-gray-400 hover:text-gray-600">Delete<span class="sr-only">, www</span></a>
                    <a href="#" class="font-semibold text-indigo-600 hover:text-indigo-900">Edit<span class="sr-only">, www</span></a>
                  </td>
                </tr>
                <tr>
                  <td class="w-full max-w-0 py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:w-auto sm:max-w-none sm:pl-0">
                    <input
                      type="text"
                      name="name"
                      value=""
                      class="block w-full px-4 py-2 text-gray-900 border border-gray-300 rounded-md shadow-sm required:border-red-500 dark:bg-blue-gray-800 dark:text-gray-200 dark:text-gray-100 dark:border-gray-600 focus:border-none focus:ring-2 focus:ring-blue-500"
                    >
                  </td>
                  <td class="hidden px-3 py-4 text-sm text-gray-500 lg:table-cell">
                    <input
                      type="text"
                      name="name"
                      value=""
                      class="block w-full px-4 py-2 text-gray-900 border border-gray-300 rounded-md shadow-sm required:border-red-500 dark:bg-blue-gray-800 dark:text-gray-200 dark:text-gray-100 dark:border-gray-600 focus:border-none focus:ring-2 focus:ring-blue-500"
                    >
                  </td>
                  <td class="hidden px-3 py-4 text-sm text-gray-500 sm:table-cell">
                    <input
                      type="text"
                      name="name"
                      placeholder="auto"
                      value=""
                      class="block w-full px-4 py-2 text-gray-900 border border-gray-300 rounded-md shadow-sm required:border-red-500 dark:bg-blue-gray-800 dark:text-gray-200 dark:text-gray-100 dark:border-gray-600 focus:border-none focus:ring-2 focus:ring-blue-500"
                    >
                  </td>
                  <td class="py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-0 space-x-6">
                    <button href="#" class="font-semibold text-indigo-600 hover:text-indigo-900">
                      Add
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="grid max-w-7xl grid-cols-1 gap-x-8 gap-y-10 py-16">
          <div>
            <h2 class="text-base font-semibold leading-7 text-gray-900 dark:text-gray-100">
              AAAA Records
            </h2>
            <p class="mt-1 text-sm leading-6 text-gray-600">
              Update your AAAA Records.
            </p>
          </div>

          <div>
            <table class="min-w-full divide-y divide-gray-300">
              <thead>
                <tr>
                  <th scope="col" class="uppercase py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-0">
                    Name
                  </th>
                  <th scope="col" class="uppercase hidden px-3 py-3.5 text-left text-sm font-semibold text-gray-900 lg:table-cell">
                    Address
                  </th>
                  <th scope="col" class="uppercase px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                    ttl
                  </th>
                  <th scope="col" class="relative py-3.5 pl-3 pr-4 sm:pr-0">
                    <span class="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200 bg-white">
                <tr>
                  <td class="w-full max-w-0 py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:w-auto sm:max-w-none sm:pl-0">
                    <input
                      type="text"
                      name="name"
                      value=""
                      class="block w-full px-4 py-2 text-gray-900 border border-gray-300 rounded-md shadow-sm required:border-red-500 dark:bg-blue-gray-800 dark:text-gray-200 dark:text-gray-100 dark:border-gray-600 focus:border-none focus:ring-2 focus:ring-blue-500"
                    >
                  </td>
                  <td class="hidden px-3 py-4 text-sm text-gray-500 lg:table-cell">
                    <input
                      type="text"
                      name="name"
                      value=""
                      class="block w-full px-4 py-2 text-gray-900 border border-gray-300 rounded-md shadow-sm required:border-red-500 dark:bg-blue-gray-800 dark:text-gray-200 dark:text-gray-100 dark:border-gray-600 focus:border-none focus:ring-2 focus:ring-blue-500"
                    >
                  </td>
                  <td class="hidden px-3 py-4 text-sm text-gray-500 sm:table-cell">
                    <input
                      type="text"
                      name="name"
                      placeholder="auto"
                      value=""
                      class="block w-full px-4 py-2 text-gray-900 border border-gray-300 rounded-md shadow-sm required:border-red-500 dark:bg-blue-gray-800 dark:text-gray-200 dark:text-gray-100 dark:border-gray-600 focus:border-none focus:ring-2 focus:ring-blue-500"
                    >
                  </td>
                  <td class="py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-0 space-x-6">
                    <button href="#" class="font-semibold text-indigo-600 hover:text-indigo-900">
                      Add
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="grid max-w-7xl grid-cols-1 gap-x-8 gap-y-10 py-16">
          <div>
            <h2 class="text-base font-semibold leading-7 text-gray-900 dark:text-gray-100">
              CNAME Records
            </h2>
            <p class="mt-1 text-sm leading-6 text-gray-600">
              Update your CNAME Records.
            </p>
          </div>

          <div>
            <table class="min-w-full divide-y divide-gray-300">
              <thead>
                <tr>
                  <th scope="col" class="uppercase py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-0">
                    Name
                  </th>
                  <th scope="col" class="uppercase hidden px-3 py-3.5 text-left text-sm font-semibold text-gray-900 lg:table-cell">
                    Target
                  </th>
                  <th scope="col" class="uppercase px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                    ttl
                  </th>
                  <th scope="col" class="relative py-3.5 pl-3 pr-4 sm:pr-0">
                    <span class="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200 bg-white">
                <tr>
                  <td class="w-full max-w-0 py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:w-auto sm:max-w-none sm:pl-0">
                    <input
                      type="text"
                      name="name"
                      value=""
                      class="block w-full px-4 py-2 text-gray-900 border border-gray-300 rounded-md shadow-sm required:border-red-500 dark:bg-blue-gray-800 dark:text-gray-200 dark:text-gray-100 dark:border-gray-600 focus:border-none focus:ring-2 focus:ring-blue-500"
                    >
                  </td>
                  <td class="hidden px-3 py-4 text-sm text-gray-500 lg:table-cell">
                    <input
                      type="text"
                      name="name"
                      value=""
                      class="block w-full px-4 py-2 text-gray-900 border border-gray-300 rounded-md shadow-sm required:border-red-500 dark:bg-blue-gray-800 dark:text-gray-200 dark:text-gray-100 dark:border-gray-600 focus:border-none focus:ring-2 focus:ring-blue-500"
                    >
                  </td>
                  <td class="hidden px-3 py-4 text-sm text-gray-500 sm:table-cell">
                    <input
                      type="text"
                      name="name"
                      placeholder="auto"
                      value=""
                      class="block w-full px-4 py-2 text-gray-900 border border-gray-300 rounded-md shadow-sm required:border-red-500 dark:bg-blue-gray-800 dark:text-gray-200 dark:text-gray-100 dark:border-gray-600 focus:border-none focus:ring-2 focus:ring-blue-500"
                    >
                  </td>
                  <td class="py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-0 space-x-6">
                    <button href="#" class="font-semibold text-indigo-600 hover:text-indigo-900">
                      Add
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="grid max-w-7xl grid-cols-1 gap-x-8 gap-y-10 py-16">
          <div>
            <h2 class="text-base font-semibold leading-7 text-gray-900 dark:text-gray-100">
              MX Records
            </h2>
            <p class="mt-1 text-sm leading-6 text-gray-600">
              Update your MX Records.
            </p>
          </div>

          <div>
            <table class="min-w-full divide-y divide-gray-300">
              <thead>
                <tr>
                  <th scope="col" class="uppercase py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-0">
                    Name
                  </th>
                  <th scope="col" class="uppercase hidden px-3 py-3.5 text-left text-sm font-semibold text-gray-900 lg:table-cell">
                    Mail Server
                  </th>
                  <th scope="col" class="uppercase hidden px-3 py-3.5 text-left text-sm font-semibold text-gray-900 lg:table-cell">
                    ttl
                  </th>
                  <th scope="col" class="uppercase px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                    Priority
                  </th>
                  <th scope="col" class="relative py-3.5 pl-3 pr-4 sm:pr-0">
                    <span class="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200 bg-white">
                <tr>
                  <td class="w-full max-w-0 py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:w-auto sm:max-w-none sm:pl-0">
                    <input
                      type="text"
                      name="name"
                      value=""
                      class="block w-full px-4 py-2 text-gray-900 border border-gray-300 rounded-md shadow-sm required:border-red-500 dark:bg-blue-gray-800 dark:text-gray-200 dark:text-gray-100 dark:border-gray-600 focus:border-none focus:ring-2 focus:ring-blue-500"
                    >
                  </td>
                  <td class="hidden px-3 py-4 text-sm text-gray-500 lg:table-cell">
                    <input
                      type="text"
                      name="name"
                      value=""
                      class="block w-full px-4 py-2 text-gray-900 border border-gray-300 rounded-md shadow-sm required:border-red-500 dark:bg-blue-gray-800 dark:text-gray-200 dark:text-gray-100 dark:border-gray-600 focus:border-none focus:ring-2 focus:ring-blue-500"
                    >
                  </td>
                  <td class="hidden px-3 py-4 text-sm text-gray-500 sm:table-cell">
                    <input
                      type="text"
                      name="name"
                      placeholder="auto"
                      value=""
                      class="block w-full px-4 py-2 text-gray-900 border border-gray-300 rounded-md shadow-sm required:border-red-500 dark:bg-blue-gray-800 dark:text-gray-200 dark:text-gray-100 dark:border-gray-600 focus:border-none focus:ring-2 focus:ring-blue-500"
                    >
                  </td>
                  <td class="hidden px-3 py-4 text-sm text-gray-500 sm:table-cell">
                    <input
                      type="text"
                      name="name"
                      value=""
                      class="block w-full px-4 py-2 text-gray-900 border border-gray-300 rounded-md shadow-sm required:border-red-500 dark:bg-blue-gray-800 dark:text-gray-200 dark:text-gray-100 dark:border-gray-600 focus:border-none focus:ring-2 focus:ring-blue-500"
                    >
                  </td>
                  <td class="py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-0 space-x-6">
                    <button href="#" class="font-semibold text-indigo-600 hover:text-indigo-900">
                      Add
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="grid max-w-7xl grid-cols-1 gap-x-8 gap-y-10 py-16">
          <div>
            <h2 class="text-base font-semibold leading-7 text-gray-900 dark:text-gray-100">
              TXT Records
            </h2>
            <p class="mt-1 text-sm leading-6 text-gray-600">
              Update your TXT Records.
            </p>
          </div>

          <div>
            <table class="min-w-full divide-y divide-gray-300">
              <thead>
                <tr>
                  <th scope="col" class="uppercase py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-0">
                    Name
                  </th>
                  <th scope="col" class="uppercase hidden px-3 py-3.5 text-left text-sm font-semibold text-gray-900 lg:table-cell">
                    Content
                  </th>
                  <th scope="col" class="uppercase hidden px-3 py-3.5 text-left text-sm font-semibold text-gray-900 lg:table-cell">
                    ttl
                  </th>
                  <th scope="col" class="relative py-3.5 pl-3 pr-4 sm:pr-0">
                    <span class="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200 bg-white">
                <tr>
                  <td class="w-full max-w-0 py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:w-auto sm:max-w-none sm:pl-0">
                    <input
                      type="text"
                      name="name"
                      value=""
                      class="block w-full px-4 py-2 text-gray-900 border border-gray-300 rounded-md shadow-sm required:border-red-500 dark:bg-blue-gray-800 dark:text-gray-200 dark:text-gray-100 dark:border-gray-600 focus:border-none focus:ring-2 focus:ring-blue-500"
                    >
                  </td>
                  <td class="hidden px-3 py-4 text-sm text-gray-500 lg:table-cell">
                    <input
                      type="text"
                      name="name"
                      value=""
                      class="block w-full px-4 py-2 text-gray-900 border border-gray-300 rounded-md shadow-sm required:border-red-500 dark:bg-blue-gray-800 dark:text-gray-200 dark:text-gray-100 dark:border-gray-600 focus:border-none focus:ring-2 focus:ring-blue-500"
                    >
                  </td>
                  <td class="hidden px-3 py-4 text-sm text-gray-500 sm:table-cell">
                    <input
                      type="text"
                      name="name"
                      placeholder="auto"
                      value=""
                      class="block w-full px-4 py-2 text-gray-900 border border-gray-300 rounded-md shadow-sm required:border-red-500 dark:bg-blue-gray-800 dark:text-gray-200 dark:text-gray-100 dark:border-gray-600 focus:border-none focus:ring-2 focus:ring-blue-500"
                    >
                  </td>
                  <td class="py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-0 space-x-6">
                    <button href="#" class="font-semibold text-indigo-600 hover:text-indigo-900">
                      Add
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
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
