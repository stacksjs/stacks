<script setup lang="ts">
const showModal = ref(false)
</script>

<template>
  <div class="min-h-screen py-4 lg:py-8 dark:bg-blue-gray-800">
    <div class="px-4 mb-8 sm:px-6 lg:px-8">
      <div>
        <h3 class="text-base font-semibold leading-6 text-gray-900">
          Last 30 days
        </h3>

        <dl class="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <div class="relative overflow-hidden rounded-lg bg-white px-4 pt-5 shadow sm:px-6 sm:pt-6">
            <dt>
              <div class="absolute rounded-md bg-blue-500 p-3">
                <div class="i-heroicons-rocket-launch h-6 w-6 text-white" />
              </div>

              <p class="ml-16 truncate text-sm font-medium text-gray-500">
                Total Deployments
              </p>
            </dt>

            <dd class="ml-16 flex items-baseline pb-6 sm:pb-7">
              <p class="text-2xl font-semibold text-gray-900">
                71,897
              </p>

              <p class="ml-2 flex items-baseline text-sm font-semibold text-green-600">
                <svg class="h-5 w-5 flex-shrink-0 self-center text-green-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fill-rule="evenodd" d="M10 17a.75.75 0 01-.75-.75V5.612L5.29 9.77a.75.75 0 01-1.08-1.04l5.25-5.5a.75.75 0 011.08 0l5.25 5.5a.75.75 0 11-1.08 1.04l-3.96-4.158V16.25A.75.75 0 0110 17z" clip-rule="evenodd" />
                </svg>
                <span class="sr-only"> Increased by </span>
                122
              </p>
            </dd>
          </div>

          <div class="relative overflow-hidden rounded-lg bg-white px-4 pt-5 shadow sm:px-6 sm:pt-6">
            <dt>
              <div class="absolute rounded-md bg-blue-500 p-3">
                <div class="i-heroicons-clock h-6 w-6 text-white" />
              </div>

              <p class="ml-16 truncate text-sm font-medium text-gray-500">
                Avg. Deploy Time
              </p>
            </dt>

            <dd class="ml-16 flex items-baseline pb-6 sm:pb-7">
              <p class="text-2xl font-semibold text-gray-900">
                3.65 mins
              </p>

              <p class="ml-2 flex items-baseline text-sm font-semibold text-green-600">
                <svg class="h-5 w-5 flex-shrink-0 self-center text-green-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fill-rule="evenodd" d="M10 17a.75.75 0 01-.75-.75V5.612L5.29 9.77a.75.75 0 01-1.08-1.04l5.25-5.5a.75.75 0 011.08 0l5.25 5.5a.75.75 0 11-1.08 1.04l-3.96-4.158V16.25A.75.75 0 0110 17z" clip-rule="evenodd" />
                </svg>
                <span class="sr-only"> Increased by </span>
                12 s
              </p>
            </dd>
          </div>

          <div class="relative overflow-hidden rounded-lg bg-white px-4 pt-5 shadow sm:px-6 sm:pt-6">
            <dt>
              <div class="absolute rounded-md bg-blue-500 p-3">
                <div class="i-heroicons-check-circle h-6 w-6 text-white" />
              </div>

              <p class="ml-16 truncate text-sm font-medium text-gray-500">
                Success Rate
              </p>
            </dt>

            <dd class="ml-16 flex items-baseline pb-6 sm:pb-7">
              <p class="text-2xl font-semibold text-gray-900">
                94.57%
              </p>

              <p class="ml-2 flex items-baseline text-sm font-semibold text-red-600">
                <svg class="h-5 w-5 flex-shrink-0 self-center text-red-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
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

    <LiveTerminalOutput />

    <DeploymentHistory />
  </div>

  <BaseModal v-if="showModal">
    <template #modal-body>
      <div class="absolute top-0 right-0 hidden pt-4 pr-4 sm:block">
        <button
          type="button"
          class="text-gray-400 rounded-md dark:text-gray-200 dark-hover:text-gray-100 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2"
          @click="showModal = false"
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
            Deployment Information
          </h3>

          <div class="mt-2">
            <div>
              <div class="px-4 sm:px-0">
                <p class="mt-1 max-w-2xl text-sm leading-6 text-gray-500">
                  In 123 seconds at 12:00 PM on 10/10/2023.
                </p>
              </div>
              <div class="mt-6">
                <dl class="grid grid-cols-1 sm:grid-cols-2">
                  <div class="border-t border-gray-100 px-4 py-6 sm:col-span-1 sm:px-0">
                    <dt class="text-sm font-medium leading-6 text-gray-900">
                      Deployment URL
                    </dt>
                    <dd class="mt-1 text-sm leading-6 text-gray-700 sm:mt-2">
                      https://my-app.org
                    </dd>
                  </div>
                  <div class="border-t border-gray-100 px-4 py-6 sm:col-span-1 sm:px-0">
                    <dt class="text-sm font-medium leading-6 text-gray-900">
                      Branch
                    </dt>
                    <dd class="mt-1 text-sm leading-6 text-gray-700 sm:mt-2 font-mono">
                      main
                    </dd>
                  </div>
                  <div class="border-t border-gray-100 py-6 sm:col-span-1">
                    <dt class="text-sm font-medium leading-6 text-gray-900">
                      Commit
                    </dt>
                    <dd class="mt-1 text-sm leading-6 text-gray-700 sm:mt-2">
                      fix: auth issues for third-party integration
                    </dd>
                  </div>
                  <div class="border-t border-gray-100 px-4 py-6 sm:col-span-1 sm:px-0">
                    <dt class="text-sm font-medium leading-6 text-gray-900">
                      Deployed By
                    </dt>
                    <dd class="mt-1 text-sm leading-6 text-gray-700 sm:mt-2">
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
