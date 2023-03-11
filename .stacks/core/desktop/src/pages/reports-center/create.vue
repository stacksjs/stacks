<script setup lang="ts">
import { useAgencyStore } from '~/stores/agency'

const agencyStore = useAgencyStore()
const router = useRouter()
const toast = useToast()
const errors = ref({} as any)

const agency = ref({
  name: '',
  email: '',
  street_address: '',
  salesforce_id: '',
  city: '',
  suite: '',
  state: '',
  zip_code: '',
  password: '',
})
async function createAgency() {
  try {
    errors.value = {}

    await agencyStore.createAgency(agency.value)

    await toast.success({ text: 'Successfully created agency!' })

    router.push({ name: 'reports-center' })
  }
  catch (err: any) {
    errors.value = err.data.errors
    toast.error({ text: 'Something went wrong!' })
  }
}
async function cancel() {
  router.push({ name: 'reports-center' })
}
</script>

<template>
  <div>
    <div class="flex flex-col lg:pl-64">
      <main class="flex-1">
        <TopBar />

        <div class="bg-gray-100 dark:bg-gray-800">
          <div class="px-4 py-12 mx-auto max-w-7xl sm:px-6 lg:px-8">
            <div class="relative">
              <div class="flex">
                <button
                  class="text-gray-400 hover:text-gray-600"
                  @click="router.go(-1)"
                >
                  <svg
                    fill="none"
                    stroke="currentColor"
                    class="w-6 h-6"
                    stroke-width="2"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
                    />
                  </svg>
                </button>

                <h2 class="pl-4 text-xl font-semibold text-gray-700 dark:text-gray-200">
                  Create Agency
                </h2>
              </div>

              <div class="px-4 py-4 pb-4 mt-4 bg-white rounded-lg sm:px-8 sm:py-8 dark:bg-gray-700">
                <div class="space-y-8">
                  <div class="items-start space-x-4 sm:flex">
                    <h3 class="w-1/4 mb-5 text-lg font-medium leading-6 text-gray-900 dark:text-gray-100">
                      Agency Information
                    </h3>
                    <div class="grid w-3/4 grid-cols-1 pl-8 gap-y-6 gap-x-4 sm:grid-cols-6">
                      <div class="sm:col-span-6">
                        <label
                          for="agency-name"
                          class="block text-sm font-medium text-gray-700 dark:text-gray-300"
                        >
                          Agency name
                        </label>
                        <div class="mt-1">
                          <input
                            id="agency-name"
                            v-model="agency.name"
                            type="text"
                            :required="hasError(errors, 'name')"
                            name="agency required:border-red-500-name"
                            class="agency-input"
                          >

                          <span
                            v-if="!isEmpty(errors)"
                            class="text-xs text-red-500"
                          >
                            {{ getError(errors, 'name') }}
                          </span>
                        </div>
                      </div>

                      <div class="sm:col-span-6">
                        <label
                          for="primary-email"
                          class="block text-sm font-medium text-gray-700 dark:text-gray-300"
                        >
                          Primary Email
                        </label>
                        <div class="mt-1">
                          <input
                            id="primary-email"
                            v-model="agency.email"
                            type="email"
                            :required="hasError(errors, 'email')"
                            class="agency-input"
                          >

                          <span
                            v-if="!isEmpty(errors)"
                            class="text-xs text-red-500"
                          >
                            {{ getError(errors, 'email') }}
                          </span>
                        </div>
                      </div>

                      <div class="sm:col-span-6">
                        <label
                          for="primary-email"
                          class="block text-sm font-medium text-gray-700 dark:text-gray-300"
                        >
                          Salesforce ID
                        </label>
                        <div class="mt-1">
                          <input
                            id="salesforce-id"
                            v-model="agency.salesforce_id"
                            type="text"
                            name="salesforce_id"
                            :required="hasError(errors, 'salesforce_id')"
                            class="agency-input"
                          >

                          <span
                            v-if="!isEmpty(errors)"
                            class="text-xs text-red-500"
                          >
                            {{ getError(errors, 'salesforce_id') }}
                          </span>
                        </div>
                      </div>

                      <div class="sm:col-span-6">
                        <label
                          for="password"
                          class="block text-sm font-medium text-gray-700 dark:text-gray-300"
                        >
                          Password
                        </label>
                        <div class="mt-1">
                          <input
                            id="password"
                            v-model="agency.password"
                            type="password"
                            name="password"
                            :required="hasError(errors, 'password')"
                            class="agency-input"
                          >

                          <span
                            v-if="!isEmpty(errors)"
                            class="text-xs text-red-500"
                          >
                            {{ getError(errors, 'password') }}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div class="pt-8 ">
                    <div class="items-start space-x-4 sm:flex">
                      <h3 class="w-1/4 mb-5 text-lg font-medium leading-6 text-gray-900 dark:text-gray-100">
                        Agency Location
                      </h3>

                      <div class="grid w-3/4 grid-cols-1 pl-8 gap-y-6 gap-x-4 sm:grid-cols-6">
                        <div class="sm:col-span-4">
                          <label
                            for="street-address"
                            class="block text-sm font-medium text-gray-700 dark:text-gray-300"
                          >
                            Street Address
                          </label>
                          <div class="mt-1">
                            <input
                              id="street-address"
                              v-model="agency.street_address"
                              type="text"
                              name="street-address"
                              :required="hasError(errors, 'street_address')"
                              class="agency-input"
                            >

                            <span
                              v-if="!isEmpty(errors)"
                              class="text-xs text-red-500"
                            >
                              {{ getError(errors, 'street_address') }}
                            </span>
                          </div>
                        </div>

                        <div class="sm:col-span-2">
                          <label
                            for="suite"
                            class="block text-sm font-medium text-gray-700 dark:text-gray-300"
                          >
                            Suite
                          </label>
                          <div class="mt-1">
                            <input
                              id="suite"
                              v-model="agency.suite"
                              type="text"
                              name="suite"
                              class="block w-full px-4 py-2 text-gray-900 border border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:text-gray-200 dark:text-gray-100 focus:border-teal-500 dark:border-gray-600 focus:outline-none focus:ring-2"
                            >
                          </div>
                        </div>

                        <div class="sm:col-span-2">
                          <label
                            for="city"
                            class="block text-sm font-medium text-gray-700 dark:text-gray-300"
                          >
                            City
                          </label>
                          <div class="mt-1">
                            <input
                              id="city"
                              v-model="agency.city"
                              type="text"
                              name="city"
                              :required="hasError(errors, 'city')"
                              class="agency-input"
                            >

                            <span
                              v-if="!isEmpty(errors)"
                              class="text-xs text-red-500"
                            >
                              {{ getError(errors, 'city') }}
                            </span>
                          </div>
                        </div>

                        <div class="sm:col-span-2">
                          <label
                            for="state"
                            class="block text-sm font-medium text-gray-700 dark:text-gray-300"
                          >
                            State
                          </label>
                          <div class="mt-1">
                            <select
                              id="state"
                              v-model="agency.state"
                              name="state"
                              :required="hasError(errors, 'state')"

                              required:border-red-500
                              class="block w-full px-4 py-2 text-gray-900 border border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:text-gray-200 dark:text-gray-100 focus:border-teal-500 dark:border-gray-600 focus:outline-none focus:ring-2"
                            >
                              <option
                                v-for="(state, index) in states"
                                :key="index"
                                :value="state.name"
                              >
                                {{ state.name }}
                              </option>
                            </select>

                            <span
                              v-if="!isEmpty(errors)"
                              class="text-xs text-red-500"
                            >
                              {{ getError(errors, 'state') }}
                            </span>
                          </div>
                        </div>
                        <div class="sm:col-span-2">
                          <label
                            for="zip-code"
                            class="block text-sm font-medium text-gray-700 dark:text-gray-300"
                          >
                            Zip Code
                          </label>
                          <div class="mt-1">
                            <input
                              id="zip-code"
                              v-model="agency.zip_code"
                              type="text"
                              name="zip-code"
                              :required="hasError(errors, 'zip_code')"
                              class="agency-input"
                            >

                            <span
                              v-if="!isEmpty(errors)"
                              class="text-xs text-red-500"
                            >
                              {{ getError(errors, 'zip_code') }}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div class="flex items-center justify-end">
                    <button
                      type="button"
                      class="mr-4 secondary-button"
                      @click="cancel()"
                    >
                      Cancel
                    </button>

                    <AppButton
                      button-text="Create"
                      loading-text="Creating..."
                      passed-class="primary-button"
                      @click="createAgency()"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  </div>
</template>

<style scoped>
.agency-input {
  @apply block w-full px-4 py-2 text-gray-900 border border-gray-300 rounded-md shadow-sm required:border-red-500 dark:bg-gray-700 dark:text-gray-200 dark:text-gray-100 focus:border-teal-500 dark:border-gray-600 focus:outline-none focus:ring-2
}
</style>
