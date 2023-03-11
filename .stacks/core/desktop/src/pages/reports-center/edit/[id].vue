<script setup lang="ts">
import { useAgencyStore } from '~/stores/agency'

const agencyStore = useAgencyStore()
const router = useRouter()
const toast = useToast()
const route = useRoute()
const errors = ref({} as any)
onMounted(async () => {
  await fetchAgency()
})

const agencyData = ref({
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

async function fetchAgency() {
  await agencyStore.fetchAgency(route.params.id)

  agencyData.value = agencyStore.agency
}

async function updateAgency() {
  try {
    errors.value = {}

    await agencyStore.updateAgency(route.params.id, agencyData.value)
    await toast.success({ text: 'Successfully updated agency!' })
    router.push({ name: 'reports-center' })
  }
  catch (err: any) {
    toast.error({ text: 'Something went wrong!' })

    errors.value = err.data.errors
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
              <div>
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
                    Update Agency
                  </h2>
                </div>

                <div class="px-4 py-4 pb-4 mt-4 bg-white rounded-lg sm:px-8 sm:py-8 dark:bg-gray-700">
                  <div class="space-y-8">
                    <div class="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
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
                            v-model="agencyData.name"
                            type="text"
                            name="agency-name"
                            :required="hasError(errors, 'name')"
                            class="agency-input"
                          >
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
                            v-model="agencyData.email"
                            type="email"
                            name="primary-email"
                            :required="hasError(errors, 'email')"
                            class="agency-input"
                          >
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
                            v-model="agencyData.salesforce_id"
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
                            v-model="agencyData.password"
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
                    <div class="pt-8">
                      <div>
                        <h3 class="mb-5 text-lg font-medium leading-6 text-gray-900 dark:text-gray-100">
                          Agency Location
                        </h3>
                      </div>
                      <div class="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
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
                              v-model="agencyData.street_address"
                              type="text"
                              name="street-address"
                              :required="hasError(errors, 'street_address')"
                              class="agency-input"
                            >
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
                              v-model="agencyData.suite"
                              type="text"
                              name="suite"
                              class="agency-input"
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
                              v-model="agencyData.city"
                              type="text"
                              name="city"
                              class="agency-input"
                            >
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
                              v-model="agencyData.state"
                              name="state"
                              class="agency-input"
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
                              v-model="agencyData.zip_code"
                              type="text"
                              name="zip-code"
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
                    <div class="flex items-center justify-end">
                      <button
                        type="button"
                        class="mr-4 secondary-button"
                        @click="cancel()"
                      >
                        Cancel
                      </button>

                      <AppButton
                        button-text="Update"
                        loading-text="Updating..."
                        passed-class="primary-button"
                        @click="updateAgency()"
                      />
                    </div>
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
