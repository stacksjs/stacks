<script setup lang="ts">
import { useAgencyStore } from '~/stores/agency'

const route = useRoute()
const agencyStore = useAgencyStore()

onMounted(async () => {
  await fetchAgency()
})

async function fetchAgency() {
  await agencyStore.fetchAgency(route.params.id)
}
</script>

<template>
  <div>
    <div class="flex flex-col lg:pl-64">
      <main class="flex-1">
        <TopBar />
        <main
          v-if="agencyStore.agency"
          class="min-h-screen py-4 py-10 lg:py-8 dark:bg-gray-800"
        >
          <!-- Page header -->
          <div class="px-4 sm:px-6 md:flex md:items-center md:justify-between md:space-x-5 lg:px-8">
            <div class="flex items-center space-x-5">
              <div>
                <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {{ agencyStore.agency.name }}
                </h1>
              </div>
            </div>
            <div class="flex flex-col-reverse mt-6 space-y-4 space-y-reverse justify-stretch sm:flex-row-reverse sm:justify-end sm:space-y-0 sm:space-x-3 sm:space-x-reverse md:mt-0 md:flex-row md:space-x-3">
              <router-link
                to="/reports-center"
                class="secondary-button"
              >
                Back
              </router-link>
            </div>
          </div>

          <div class="mt-8 sm:px-6">
            <div class="space-y-6 lg:col-span-2 lg:col-start-1">
              <!-- Description list -->
              <section
                aria-labelledby="applicant-information-title"
              >
                <div class="bg-white shadow sm:rounded-lg dark:bg-gray-700">
                  <div class="px-4 py-5 sm:px-6">
                    <h2
                      id="applicant-information-title"
                      class="text-lg font-medium leading-6 text-gray-900 dark:text-gray-100"
                    >
                      Agency Information
                    </h2>
                  </div>
                  <div class="px-4 py-5 border-t border-gray-200 sm:px-6">
                    <dl class="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-3">
                      <div class="sm:col-span-1">
                        <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">
                          Email
                        </dt>
                        <dd class="mt-1 text-sm text-gray-900 dark:text-gray-100">
                          {{ agencyStore.agency.email }}
                        </dd>
                      </div>
                      <div class="sm:col-span-1">
                        <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">
                          State
                        </dt>
                        <dd class="mt-1 text-sm text-gray-900 dark:text-gray-100">
                          {{ agencyStore.agency.state }}
                        </dd>
                      </div>
                      <div class="sm:col-span-1">
                        <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">
                          Address
                        </dt>
                        <dd class="mt-1 text-sm text-gray-900 dark:text-gray-100">
                          {{ agencyStore.agency.street_address }}
                        </dd>
                      </div>
                      <div class="sm:col-span-1">
                        <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">
                          City
                        </dt>
                        <dd class="mt-1 text-sm text-gray-900 dark:text-gray-100">
                          {{ agencyStore.agency.city || 'N/A' }}
                        </dd>
                      </div>

                      <div class="sm:col-span-1">
                        <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">
                          Zip Code
                        </dt>
                        <dd class="mt-1 text-sm text-gray-900 dark:text-gray-100">
                          {{ agencyStore.agency.zip_code || 'N/A' }}
                        </dd>
                      </div>

                      <div class="sm:col-span-1">
                        <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">
                          Suite
                        </dt>
                        <dd class="mt-1 text-sm text-gray-900 dark:text-gray-100">
                          {{ agencyStore.agency.suite || 'N/A' }}
                        </dd>
                      </div>
                      <div class="sm:col-span-1">
                        <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">
                          Total Files
                        </dt>
                        <dd class="mt-1 text-sm text-gray-900 dark:text-gray-100">
                          {{ agencyStore.agency.total_files }}
                        </dd>
                      </div>
                      <div class="sm:col-span-1">
                        <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">
                          Total Users
                        </dt>
                        <dd class="mt-1 text-sm text-gray-900 dark:text-gray-100">
                          {{ agencyStore.agency.total_users }}
                        </dd>
                      </div>
                    </dl>
                  </div>
                </div>
              </section>

              <section>
                <h2
                  class="py-4 text-xl font-medium leading-6 text-gray-900 dark:text-gray-100"
                >
                  Folders
                </h2>

                <table>
                  <thead class="dark:bg-gray-800">
                    <tr>
                      <th
                        scope="col"
                        class="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase dark:text-gray-400 dark:text-gray-300 "
                      >
                        Name
                      </th>

                      <th
                        scope="col"
                        class="relative px-6 py-3"
                      >
                        <span class="sr-only">Action</span>
                      </th>
                    </tr>
                  </thead>

                  <tbody class="bg-white divide-y divide-gray-200 dark:divide-gray-600">
                    <tr
                      v-for="(folder, index) in agencyStore.agency.folders"
                      :key="index"
                      class="bg-white dark:bg-gray-800"
                    >
                      <td class="px-6 py-4 text-sm font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap">
                        <a
                          href="https://carefree.eliinova.com/v2/admin/broker/18/dashboard"
                          class="transition duration-150 ease-in-out hover:text-teal-500 dark-hover:text-teal-300"
                        >
                          {{ folder.name }}
                        </a>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </section>
            </div>
          </div>
        </main>
      </main>
    </div>
  </div>
</template>
