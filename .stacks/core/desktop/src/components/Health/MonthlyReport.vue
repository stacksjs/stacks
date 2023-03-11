<script lang="ts" setup>
const tab = ref('')

function switchTabs(tabs: string) {
  tab.value = tabs
}
</script>

<template>
  <div class="bg-white dark:bg-gray-700">
    <div class="px-4 pt-4 border-b">
      <h3 class="font-semibold">
        Monthly reports for carefreeagency.com
      </h3>

      <div class="mt-2">
        <div class="sm:hidden">
          <label
            for="tabs"
            class="sr-only"
          >Select a tab</label>
          <!-- Use an "onChange" listener to redirect the user to the selected tab URL. -->
          <select
            id="tabs"
            name="tabs"
            class="block w-full py-2 pl-3 pr-10 text-base border-gray-300 rounded-md focus:border-custom-blue focus:outline-none focus:ring-custom-blue sm:text-sm"
          >
            <option>Settings</option>

            <option>Reports</option>
          </select>
        </div>
        <div class="hidden sm:block">
          <div>
            <nav
              class="flex -mb-px space-x-8"
              aria-label="Tabs"
            >
              <!-- Current: "border-custom-blue text-custom-blue", Default: "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300" -->
              <button
                class="px-1 py-4 text-sm font-medium border-b-2 hover:text-gray-700 hover:border-gray-300 dark-hover:text-gray-100 whitespace-nowrap"
                :class="{ 'border-custom-blue text-custom-blue': tab === 'settings', 'text-gray-500 dark:text-gray-400 border-transparent': tab !== 'settings' }"
                @click="switchTabs('settings')"
              >
                Settings
              </button>

              <button
                class="px-1 py-4 text-sm font-medium border-b-2 hover:text-gray-700 hover:border-gray-300 dark-hover:text-gray-100 whitespace-nowrap"
                :class="{ 'border-custom-blue text-custom-blue': tab === 'reports', 'text-gray-500 dark:text-gray-400 border-transparent': tab !== 'reports' }"
                @click="switchTabs('reports')"
              >
                Reports
              </button>
            </nav>
          </div>
        </div>
      </div>
    </div>
    <div v-if="tab === 'settings'">
      <div class="p-4">
        <div class="mt-8">
          <h3 class="text-lg font-semibold text-gray-700 dark:text-gray-200">
            Include checks
          </h3>
        </div>
      </div>
      <div class="p-4">
        <div class="flex flex-col">
          <div class="overflow-x-auto">
            <div class="inline-block min-w-full py-2 align-middle">
              <table class="min-w-full divide-y divide-gray-300">
                <tbody class="divide-y divide-gray-200">
                  <tr>
                    <td class="px-3 py-4 text-sm text-gray-500 whitespace-nowrap dark:text-gray-300">
                      Uptime
                    </td>
                    <td class="px-3 py-4 text-sm text-gray-500 whitespace-nowrap dark:text-gray-300">
                      <!-- Enabled: "bg-custom-blue", Not Enabled: "bg-gray-200" -->
                      <button
                        type="button"
                        class="relative bg-gray-100 dark:bg-gray-600 inline-flex flex-shrink-0 h-6 transition-colors duration-200 ease-in-out border-2 border-transparent rounded-full cursor-pointer bg-custom-blue w-11 focus:outline-none focus:ring-2 focus:ring-custom-blue focus:ring-offset-2"
                        role="switch"
                        aria-checked="false"
                        @click="toggleButton"
                      >
                        <span class="sr-only">Use setting</span>
                        <!-- Enabled: "translate-x-5", Not Enabled: "translate-x-0" -->
                        <span
                          aria-hidden="true"
                          class="toggle-button inline-block w-5 h-5 transition duration-200 ease-in-out transform translate-x-5 bg-white rounded-full shadow pointer-events-none ring-0"
                        />
                      </button>
                    </td>
                  </tr>
                  <tr>
                    <td class="px-3 py-4 text-sm text-gray-500 whitespace-nowrap dark:text-gray-300">
                      Performance
                    </td>
                    <td class="px-3 py-4 text-sm text-gray-500 whitespace-nowrap dark:text-gray-300">
                      <!-- Enabled: "bg-custom-blue", Not Enabled: "bg-gray-200" -->
                      <button
                        type="button"
                        class="relative bg-gray-100 dark:bg-gray-600 inline-flex flex-shrink-0 h-6 transition-colors duration-200 ease-in-out border-2 border-transparent rounded-full cursor-pointer bg-custom-blue w-11 focus:outline-none focus:ring-2 focus:ring-custom-blue focus:ring-offset-2"
                        role="switch"
                        aria-checked="false"
                        @click="toggleButton"
                      >
                        <span class="sr-only">Use setting</span>
                        <!-- Enabled: "translate-x-5", Not Enabled: "translate-x-0" -->
                        <span
                          aria-hidden="true"
                          class="toggle-button inline-block w-5 h-5 transition duration-200 ease-in-out transform translate-x-5 bg-white rounded-full shadow pointer-events-none ring-0"
                        />
                      </button>
                    </td>
                  </tr>
                  <tr>
                    <td class="px-3 py-4 text-sm text-gray-500 whitespace-nowrap dark:text-gray-300">
                      Broken Links
                    </td>
                    <td class="px-3 py-4 text-sm text-gray-500 whitespace-nowrap dark:text-gray-300">
                      <!-- Enabled: "bg-custom-blue", Not Enabled: "bg-gray-200" -->
                      <button
                        type="button"
                        class="relative bg-gray-100 dark:bg-gray-600 inline-flex flex-shrink-0 h-6 transition-colors duration-200 ease-in-out border-2 border-transparent rounded-full cursor-pointer bg-custom-blue w-11 focus:outline-none focus:ring-2 focus:ring-custom-blue focus:ring-offset-2"
                        role="switch"
                        aria-checked="false"
                        @click="toggleButton"
                      >
                        <span class="sr-only">Use setting</span>
                        <!-- Enabled: "translate-x-5", Not Enabled: "translate-x-0" -->
                        <span
                          aria-hidden="true"
                          class="toggle-button inline-block w-5 h-5 transition duration-200 ease-in-out transform translate-x-5 bg-white rounded-full shadow pointer-events-none ring-0"
                        />
                      </button>
                    </td>
                  </tr>
                  <tr>
                    <td class="px-3 py-4 text-sm text-gray-500 whitespace-nowrap dark:text-gray-300">
                      Application Health
                    </td>
                    <td class="px-3 py-4 text-sm text-gray-500 whitespace-nowrap dark:text-gray-300">
                      <!-- Enabled: "bg-custom-blue", Not Enabled: "bg-gray-200" -->
                      <button
                        type="button"
                        class="relative bg-gray-100 dark:bg-gray-600 inline-flex flex-shrink-0 h-6 transition-colors duration-200 ease-in-out border-2 border-transparent rounded-full cursor-pointer bg-custom-blue w-11 focus:outline-none focus:ring-2 focus:ring-custom-blue focus:ring-offset-2"
                        role="switch"
                        aria-checked="false"
                        @click="toggleButton"
                      >
                        <span class="sr-only">Use setting</span>
                        <!-- Enabled: "translate-x-5", Not Enabled: "translate-x-0" -->
                        <span
                          aria-hidden="true"
                          class="toggle-button inline-block w-5 h-5 transition duration-200 ease-in-out transform translate-x-5 bg-white rounded-full shadow pointer-events-none ring-0"
                        />
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="tab === 'reports'">
      <!-- <div class="px-8 pt-6">
        <SectionLoader
          v-if="loading"
          :height="24"
        />
      </div> -->
      <div
        class="p-4"
      >
        <h3 class="pt-2 font-semibold text-gray-700">
          Reports for December 2022
        </h3>

        <div class="flex">
          <div class="pt-8 mr-10">
            <h3 class="text-lg font-semibold text-custom-green">
              Uptime
            </h3>

            <p class="pt-2 text-sm text-gray-600 dark:text-gray-400">
              You had 100% uptime this month.
            </p>
          </div>

          <div class="pt-8 mr-10">
            <h3 class="text-lg font-semibold text-custom-green">
              Broken Links
            </h3>

            <p class="pt-2 text-sm text-gray-600 dark:text-gray-400">
              We found no broken links.
            </p>
          </div>

          <div class="pt-8 mr-10">
            <h3 class="text-lg font-semibold text-custom-green">
              Mixed Contents
            </h3>

            <p class="pt-2 text-sm text-gray-600 dark:text-gray-400">
              We found no mixed content links.
            </p>
          </div>

          <div class="pt-8 mr-10">
            <h3 class="text-lg font-semibold text-custom-green">
              Certificate Healths
            </h3>

            <p class="pt-2 text-sm text-gray-600 dark:text-gray-400">
              No problems detected.
            </p>
          </div>
        </div>

        <div class="pt-8">
          <div
            class="pt-4"
          >
            <table class="min-w-full divide-y divide-gray-300">
              <thead>
                <tr>
                  <th
                    scope="col"
                    class="py-3.5 px-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100"
                  >
                    Check
                  </th>
                  <th
                    scope="col"
                    class="py-3.5 px-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100"
                  >
                    Status
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200">
                <tr>
                  <td class="px-3 py-4 text-sm text-gray-500 whitespace-nowrap dark:text-gray-200">
                    Certificate is present
                  </td>
                  <td class="px-3 py-4 text-sm text-gray-500 whitespace-nowrap dark:text-gray-200">
                    <span class="flex items-center text-sm">
                      <svg
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg"
                        class="w-5 h-5 mr-2 text-custom-green-darker"
                      ><path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
                      /></svg>

                      Passed
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div
            class="pt-4"
          >
            <table class="min-w-full divide-y divide-gray-300">
              <tbody class="divide-y divide-gray-200">
                <tr>
                  <td class="px-3 py-4 text-sm text-gray-500 whitespace-nowrap dark:text-gray-300">
                    Issuer
                  </td>
                  <td class="px-3 py-4 text-sm text-gray-500 whitespace-nowrap dark:text-gray-300">
                    <!-- certificateDetails.issuer -->

                    E1
                  </td>
                </tr>
                <tr>
                  <td class="px-3 py-4 text-sm text-gray-500 whitespace-nowrap dark:text-gray-200">
                    Valid From
                  </td>
                  <td class="px-3 py-4 text-sm text-gray-500 whitespace-nowrap dark:text-gray-200">
                    2022-11-18 09:00:51
                  </td>
                </tr>
                <!-- <tr>
                  <td class="px-3 py-4 text-sm text-gray-500 whitespace-nowrap dark:text-gray-300">
                    Valid Until
                  </td>
                  <td class="px-3 py-4 text-sm text-gray-500 whitespace-nowrap dark:text-gray-300">
                    certificateDetails.valid_until
                  </td>
                </tr> -->
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
