<script setup lang="ts">
const showModal = ref(false)
</script>

<template>
  <div class="min-h-screen py-4 dark:bg-blue-gray-800 lg:py-8">
    <div class="mb-8 px-4 lg:px-8 sm:px-6">
      <div>
        <h3 class="text-base text-gray-900 font-semibold leading-6 dark:text-gray-100">
          Last 30 days
        </h3>

        <dl class="grid grid-cols-1 mt-5 gap-5 lg:grid-cols-3 sm:grid-cols-2">
          <div class="relative overflow-hidden rounded-lg bg-white px-4 pt-5 shadow sm:px-6 sm:pt-6 dark:bg-blue-gray-700">
            <dt>
              <div class="absolute rounded-md bg-blue-500 p-3">
                <div class="i-hugeicons-rocket-01 h-6 w-6 text-white" />
              </div>

              <p class="ml-16 truncate text-sm text-gray-500 dark:text-gray-400 font-medium">
                Total Deployments
              </p>
            </dt>

            <dd class="ml-16 flex items-baseline pb-6 sm:pb-7">
              <p class="text-2xl text-gray-900 font-semibold dark:text-gray-100">
                71,897
              </p>

              <p class="ml-2 flex items-baseline text-sm text-green-600 dark:text-green-400 font-semibold">
                <svg class="h-5 w-5 flex-shrink-0 self-center text-green-500 dark:text-green-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fill-rule="evenodd" d="M10 17a.75.75 0 01-.75-.75V5.612L5.29 9.77a.75.75 0 01-1.08-1.04l5.25-5.5a.75.75 0 011.08 0l5.25 5.5a.75.75 0 11-1.08 1.04l-3.96-4.158V16.25A.75.75 0 0110 17z" clip-rule="evenodd" />
                </svg>
                <span class="sr-only"> Increased by </span>
                122
              </p>
            </dd>
          </div>

          <div class="relative overflow-hidden rounded-lg bg-white px-4 pt-5 shadow sm:px-6 sm:pt-6 dark:bg-blue-gray-700">
            <dt>
              <div class="absolute rounded-md bg-blue-500 p-3">
                <div class="i-hugeicons-clock-01 h-6 w-6 text-white" />
              </div>

              <p class="ml-16 truncate text-sm text-gray-500 dark:text-gray-400 font-medium">
                Avg. Deploy Time
              </p>
            </dt>

            <dd class="ml-16 flex items-baseline pb-6 sm:pb-7">
              <p class="text-2xl text-gray-900 font-semibold dark:text-gray-100">
                3.65 mins
              </p>

              <p class="ml-2 flex items-baseline text-sm text-green-600 dark:text-green-400 font-semibold">
                <svg class="h-5 w-5 flex-shrink-0 self-center text-green-500 dark:text-green-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fill-rule="evenodd" d="M10 17a.75.75 0 01-.75-.75V5.612L5.29 9.77a.75.75 0 01-1.08-1.04l5.25-5.5a.75.75 0 011.08 0l5.25 5.5a.75.75 0 11-1.08 1.04l-3.96-4.158V16.25A.75.75 0 0110 17z" clip-rule="evenodd" />
                </svg>
                <span class="sr-only"> Increased by </span>
                12 s
              </p>
            </dd>
          </div>

          <div class="relative overflow-hidden rounded-lg bg-white px-4 pt-5 shadow sm:px-6 sm:pt-6 dark:bg-blue-gray-700">
            <dt>
              <div class="absolute rounded-md bg-blue-500 p-3">
                <div class="i-hugeicons-checkmark-circle-02 h-6 w-6 text-white" />
              </div>

              <p class="ml-16 truncate text-sm text-gray-500 dark:text-gray-400 font-medium">
                Success Rate
              </p>
            </dt>

            <dd class="ml-16 flex items-baseline pb-6 sm:pb-7">
              <p class="text-2xl text-gray-900 font-semibold dark:text-gray-100">
                94.57%
              </p>

              <p class="ml-2 flex items-baseline text-sm text-red-600 dark:text-red-400 font-semibold">
                <svg class="h-5 w-5 flex-shrink-0 self-center text-red-500 dark:text-red-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fill-rule="evenodd" d="M10 3a.75.75 0 01.75.75v10.638l3.96-4.158a.75.75 0 111.08 1.04l-5.25 5.5a.75.75 0 01-1.08 0l-5.25-5.5a.75.75 0 111.08-1.04l3.96 4.158V3.75A.75.75 0 0110 3z" clip-rule="evenodd" />
                </svg>
                <span class="sr-only"> Decreased by </span>
                3.2%
              </p>
            </dd>
          </div>
        </dl>
      </div>
    </div>

    <DeployScript />
    <DeploymentHistory />
    <!-- <LiveTerminalOutput /> -->
  </div>

  <BaseModal v-if="showModal">
    <template #modal-body>
      <div class="absolute right-0 top-0 hidden pr-4 pt-4 sm:block">
        <button
          type="button"
          class="rounded-md text-gray-400 dark:text-gray-200 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 dark-hover:text-gray-100"
          @click="showModal = false"
        >
          <span class="sr-only">Close</span>
          <!-- Heroicon name: outline/x-mark -->
          <svg
            class="h-6 w-6"
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
        <div class="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left">
          <h3
            id="modal-title"
            class="text-lg text-gray-900 font-medium leading-6 dark:text-gray-100"
          >
            Deployment Information
          </h3>

          <div class="mt-2">
            <div>
              <div class="px-4 sm:px-0">
                <p class="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400 leading-6">
                  In 123 seconds at 12:00 PM on 10/10/2023.
                </p>
              </div>
              <div class="mt-6">
                <dl class="grid grid-cols-1 sm:grid-cols-2">
                  <div class="border-t border-gray-100 dark:border-gray-700 px-4 py-6 sm:col-span-1 sm:px-0">
                    <dt class="text-sm text-gray-900 dark:text-gray-100 font-medium leading-6">
                      Deployment URL
                    </dt>
                    <dd class="mt-1 text-sm text-gray-700 dark:text-gray-300 leading-6 sm:mt-2">
                      https://my-app.org
                    </dd>
                  </div>
                  <div class="border-t border-gray-100 dark:border-gray-700 px-4 py-6 sm:col-span-1 sm:px-0">
                    <dt class="text-sm text-gray-900 dark:text-gray-100 font-medium leading-6">
                      Branch
                    </dt>
                    <dd class="mt-1 text-sm text-gray-700 dark:text-gray-300 leading-6 font-mono sm:mt-2">
                      main
                    </dd>
                  </div>
                  <div class="border-t border-gray-100 dark:border-gray-700 py-6 sm:col-span-1">
                    <dt class="text-sm text-gray-900 dark:text-gray-100 font-medium leading-6">
                      Commit
                    </dt>
                    <dd class="mt-1 text-sm text-gray-700 dark:text-gray-300 leading-6 sm:mt-2">
                      fix: auth issues for third-party integration
                    </dd>
                  </div>
                  <div class="border-t border-gray-100 dark:border-gray-700 px-4 py-6 sm:col-span-1 sm:px-0">
                    <dt class="text-sm text-gray-900 dark:text-gray-100 font-medium leading-6">
                      Deployed By
                    </dt>
                    <dd class="mt-1 text-sm text-gray-700 dark:text-gray-300 leading-6 sm:mt-2">
                      Chris
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <template #modal-actions>
      <button
        type="button"
        class="secondary-button"
        @click="showModal = false"
      >
        Close
      </button>

      <button
        type="button"
        class="secondary-button mr-4"
        @click="showModal = false"
      >
        View Logs
      </button>
    </template>
  </BaseModal>
</template>
