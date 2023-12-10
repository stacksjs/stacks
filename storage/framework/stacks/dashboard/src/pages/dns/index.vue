<script setup lang="ts">
import { ref } from 'vue'
import AppButton from '../../components/Buttons/AppButton.vue'

useHead({
  title: 'Dashboard - DNS',
})

const addDnsSection = ref(false)

function closeAddDnsSection() {
  addDnsSection.value = false
}

function openAddDnsSection() {
  addDnsSection.value = true
}
</script>

<template>
  <div class="px-4 sm:px-6 lg:px-8 py-8">
    <div class="rounded-lg bg-white px-6 py-4 text-sm dark:bg-blue-gray-800">
      <div class="flex sm:items-center">
        <div class="sm:flex-auto">
          <h1 class="text-base font-semibold leading-6 text-gray-900 dark:text-gray-100">
            DNS Records
          </h1>
        </div>

        <AppButton passed-class="primary-button" loading-text="DNS" button-text="DNS" @click="openAddDnsSection">
          <template #icon>
            <div class="i-heroicons-plus w-5 h-5" />
          </template>
        </AppButton>
      </div>
      <div class="mt-8 flow-root">
        <div class="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div class="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
            <table class="min-w-full divide-y divide-gray-300 dark:divide-gray-600">
              <thead>
                <tr>
                  <th
                    scope="col"
                    class="py-3 pl-4 pr-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500 sm:pl-0 dark:text-gray-400"
                  >
                    Type
                  </th>
                  <th
                    scope="col"
                    class="px-3 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400"
                  >
                    Name
                  </th>
                  <th
                    scope="col"
                    class="px-3 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400"
                  >
                    Content
                  </th>
                  <th
                    scope="col"
                    class="px-3 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400"
                  >
                    Proxy status
                  </th>
                  <th
                    scope="col"
                    class="px-3 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400"
                  >
                    TTL
                  </th>
                  <th
                    scope="col"
                    class="relative py-3 pl-3 pr-4 sm:pr-0"
                  >
                    <span class="sr-only">Edit</span>
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200 dark:divide-gray-600 bg-white dark:bg-blue-gray-800">
                <tr>
                  <td class="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-0 dark:text-gray-100">
                    A
                  </td>
                  <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                    admin-api
                  </td>
                  <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                    666.666.666
                  </td>
                  <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                    Proxied
                  </td>
                  <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                    Auto
                  </td>
                  <td class="whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-0">
                    <a
                      href="#"
                      class="text-gray-400 text-left hover:text-blue-gray-500 duration-150 ease-in-out transition"
                    >
                      <div class="i-heroicons-ellipsis-vertical w-6 h-6" />

                      <div
                        v-if="false"
                        class="absolute dropdown-menu right-16 z-10 mt-2 w-48 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none"
                        role="menu"
                        aria-orientation="vertical"
                        aria-labelledby="menu-button"
                        tabindex="-1"
                      >
                        <div
                          class="py-1"
                          role="none"
                        >
                          <!-- Active: "bg-gray-100 text-gray-900", Not Active: "text-gray-700" -->
                          <a
                            id="menu-item-0"
                            href="#"
                            class="text-gray-700 block px-4 py-1.5 text-sm hover:bg-blue-gray-50 text-xs"
                            role="menuitem"
                            tabindex="-1"
                          >Edit</a>
                          <a
                            id="menu-item-1"
                            href="#"
                            class="text-gray-700 block px-4 py-1.5 text-sm hover:bg-blue-gray-50 text-xs"
                            role="menuitem"
                            tabindex="-1"
                          >Delete</a>

                        </div>
                      </div>
                    </a>
                  </td>
                </tr>
                <tr>
                  <td class="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-0 dark:text-gray-100">
                    A
                  </td>
                  <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                    stacks-api
                  </td>
                  <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                    666.666.666
                  </td>
                  <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                    Proxied
                  </td>
                  <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                    Auto
                  </td>
                  <td class="whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-0">
                    <a
                      href="#"
                      class="text-gray-400 text-left hover:text-blue-gray-500 duration-150 ease-in-out transition"
                    >
                      <div class="i-heroicons-ellipsis-vertical w-6 h-6" />

                      <div
                        v-if="false"
                        class="absolute dropdown-menu right-16 z-10 mt-2 w-48 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none"
                        role="menu"
                        aria-orientation="vertical"
                        aria-labelledby="menu-button"
                        tabindex="-1"
                      >
                        <div
                          class="py-1"
                          role="none"
                        >
                          <!-- Active: "bg-gray-100 text-gray-900", Not Active: "text-gray-700" -->
                          <a
                            id="menu-item-0"
                            href="#"
                            class="text-gray-700 block px-4 py-1.5 text-sm hover:bg-blue-gray-50 text-xs"
                            role="menuitem"
                            tabindex="-1"
                          >Edit</a>
                          <a
                            id="menu-item-1"
                            href="#"
                            class="text-gray-700 block px-4 py-1.5 text-sm hover:bg-blue-gray-50 text-xs"
                            role="menuitem"
                            tabindex="-1"
                          >Delete</a>

                        </div>
                      </div>

                    </a>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="addDnsSection"
      class="bg-white rounded-bl-md rounded-br-md px-6 py-4 dark:bg-blue-gray-800"
    >
      <div class="flex justify-between">
        <h1 class="text-base font-semibold leading-6 text-gray-900 dark:text-gray-100">
          Add DNS
        </h1>

        <button
          class="i-heroicons-x-mark-solid w-5 h-5 text-gray-500 hover:text-blue-gray-700 dark:text-gray-400"
          @click="closeAddDnsSection"
        />
      </div>

      <div class="grid gap-6 grid-cols-3 mt-8">
        <div class="sm:col-span-1">
          <label
            for="city"
            class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-100"
          >Type</label>
          <div class="mt-2">
            <select class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-800 dark:text-gray-100">
              <option value="A">
                A
              </option>
              <option value="AA">
                AA
              </option>
              <option value="AAA">
                AAA
              </option>
            </select>
          </div>
        </div>

        <div class="sm:col-span-1">
          <label
            for="region"
            class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-100"
          >Name</label>
          <div class="mt-2">
            <input
              id="name"
              type="text"
              name="name"
              class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-800 dark:text-gray-100"
            >
          </div>
        </div>

        <div class="sm:col-span-1">
          <label
            for="region"
            class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-100"
          >Address</label>
          <div class="mt-2">
            <input
              id="name"
              type="text"
              name="name"
              class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-800 dark:text-gray-100"
            >
          </div>
        </div>
      </div>

      <div class="justify-end flex mt-4">
        <button
          type="button"
          class="primary-button"
          @click="openAddDnsSection"
        >
          Save
        </button>
      </div>
    </div>
  </div>
</template>
