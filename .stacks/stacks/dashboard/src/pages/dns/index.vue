<script setup lang="ts">
import { ref } from 'vue'
import ModalWrapper from '../../components/Modals/ModalWrapper.vue'

const addDnsModal = ref(false)

function closeAddDnsModal() {
  addDnsModal.value = false
}

function openAddDnsModal() {
  addDnsModal.value = true
}
</script>

<template>
  <div class="px-4 sm:px-6 lg:px-8 py-8">
    <div class="rounded-lg bg-white px-6 py-4 text-sm dark:bg-gray-800">
      <div class="flex sm:items-center">
        <div class="sm:flex-auto">
          <h1 class="text-base font-semibold leading-6 text-gray-900">
            DNS Records
          </h1>
        </div>

        <button
          type="button"
          class="inline-flex items-center gap-x-1.5 rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          @click="openAddDnsModal"
        >
          <svg
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
            class="w-5 h-5 text-white"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M12 4.5v15m7.5-7.5h-15"
            />
          </svg>

          DNS
        </button>
      </div>
      <div class="mt-8 flow-root">
        <div class="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div class="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
            <table class="min-w-full divide-y divide-gray-300">
              <thead>
                <tr>
                  <th
                    scope="col"
                    class="py-3 pl-4 pr-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500 sm:pl-0"
                  >
                    Type
                  </th>
                  <th
                    scope="col"
                    class="px-3 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500"
                  >
                    Name
                  </th>
                  <th
                    scope="col"
                    class="px-3 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500"
                  >
                    Content
                  </th>
                  <th
                    scope="col"
                    class="px-3 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500"
                  >
                    Proxy status
                  </th>
                  <th
                    scope="col"
                    class="px-3 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500"
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
              <tbody class="divide-y divide-gray-200 bg-white">
                <tr>
                  <td class="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-0">
                    A
                  </td>
                  <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                    admin-api
                  </td>
                  <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                    666.666.666
                  </td>
                  <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                    Proxied
                  </td>
                  <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                    Auto
                  </td>
                  <td class="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-0">
                    <a
                      href="#"
                      class="text-gray-400 text-left hover:text-gray-500 duration-150 ease-in-out transition"
                    >
                      <svg
                        fill="currentColor"
                        viewBox="0 0 20 20"
                        xmlns="http://www.w3.org/2000/svg"
                        aria-hidden="true"
                        class="w-5 h-5"
                      >
                        <path d="M10 3a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM10 8.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM11.5 15.5a1.5 1.5 0 10-3 0 1.5 1.5 0 003 0z" />
                      </svg>
                    </a>
                  </td>
                </tr>
                <tr>
                  <td class="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-0">
                    A
                  </td>
                  <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                    stacks-api
                  </td>
                  <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                    666.666.666
                  </td>
                  <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                    Proxied
                  </td>
                  <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                    Auto
                  </td>
                  <td class="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-0">
                    <a
                      href="#"
                      class="text-gray-400 text-left hover:text-gray-500 duration-150 ease-in-out transition"
                    >
                      <svg
                        fill="currentColor"
                        viewBox="0 0 20 20"
                        xmlns="http://www.w3.org/2000/svg"
                        aria-hidden="true"
                        class="w-5 h-5"
                      >
                        <path d="M10 3a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM10 8.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM11.5 15.5a1.5 1.5 0 10-3 0 1.5 1.5 0 003 0z" />
                      </svg>

                    </a>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>

  <ModalWrapper
    v-if="addDnsModal"
    @close-modal="closeAddDnsModal()"
  >
    <template #modal-body>
      <div class="absolute top-0 right-0 hidden pt-4 pr-4 sm:block">
        <button
          type="button"
          class="text-gray-400 rounded-md dark:text-gray-200 dark-hover:text-gray-100 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2"
          @click="closeAddDnsModal()"
        >
          <span class="sr-only">Close</span>
          <!-- Heroicon name: outline/x-mark -->
          <svg
            class="w-6 h-6"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="1.5"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      <div class="sm:flex sm:items-start">
        <div class="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
          <h3
            id="modal-title"
            class="text-lg font-medium leading-6 text-gray-900 dark:text-gray-100"
          >
            Search Engine Instance
          </h3>
          <div class="mt-2">
            <p
              id="subtitle"
              class="mb-2 text-xs text-green-800 dark:text-green-600"
            >
              test
            </p>

            test

            <p
              id="title"
              class="mt-2 text-sm text-gray-800 dark:text-gray-200"
            >
              test
            </p>
          </div>
        </div>
      </div>
    </template>

    <template #modal-actions>
      <button
        type="button"
        class="secondary-button"
        @click="closeAddDnsModal()"
      >
        Close
      </button>
    </template>
  </ModalWrapper>
</template>
