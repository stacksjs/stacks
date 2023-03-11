<script setup lang="ts">
import { useUserStore } from '~/stores/user'

const userStore = useUserStore()
const router = useRouter()
const route = useRoute()
const toast = useToast()
const errors = ref({} as any)

const userData = ref({
  first_name: '',
  last_name: '',
  email: '',
  npn: '',
  phone: '',
  state: '',
  salesforce_id: '',
})

onMounted(async () => {
  await fetchUser()
})

async function fetchUser() {
  await userStore.fetchUser(route.params.id)
  userData.value = userStore.user
}

function formatPhoneNumber(event: FocusEvent | any) {
  let phoneNumber = event.target.value

  phoneNumber = phoneNumber.replace(/[^\d]/g, '')
  if (phoneNumber.length === 10)
    userData.value.phone = `(${phoneNumber.substring(0, 3)}) ${phoneNumber.substring(3, 6)}-${phoneNumber.substring(6, 10)}`

  else if (phoneNumber.length === 11 && phoneNumber[0] === '1')
    userData.value.phone = `1 (${phoneNumber.substring(1, 4)}) ${phoneNumber.substring(4, 7)}-${phoneNumber.substring(7, 11)}`

  else
    userData.value.phone = phoneNumber
}

async function updateUser() {
  try {
    errors.value = {}

    await userStore.updateUser(route.params.id, userData.value)

    await toast.success({ text: 'Successfully updated user!' })

    router.push({ name: 'users' })
  }
  catch (err: any) {
    errors.value = err.data.errors
  }
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
                  Edit User
                </h2>
              </div>

              <div class="px-4 py-6 pb-4 mt-4 bg-white rounded-lg sm:px-8 sm:py-10 dark:bg-gray-700">
                <div class="space-y-8 divide-y divide-gray-200 dark:divide-gray-600">
                  <div class="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                    <div class="sm:col-span-3">
                      <label
                        for="first-name"
                        class="block text-sm font-medium text-gray-700 cursor-pointer dark:text-gray-300 dark:text-gray-200"
                      >
                        First name
                      </label>
                      <div class="mt-1">
                        <input
                          id="first-name"
                          v-model="userData.first_name"
                          type="text"
                          name="first-name"
                          :required="hasError(errors, 'first_name')"
                          class="block w-full px-4 py-2 text-gray-900 border border-gray-300 rounded-md shadow-sm required:border-red-500 dark:bg-gray-700 dark:text-gray-200 dark:text-gray-100 focus:border-teal-500 dark:border-gray-600 focus:outline-none focus:ring-2"
                        >

                        <span
                          v-if="!isEmpty(errors)"
                          class="text-xs text-red-500"
                        >
                          {{ getError(errors, 'first_name') }}
                        </span>
                      </div>
                    </div>
                    <div class="sm:col-span-3">
                      <label
                        for="last-name"
                        class="block text-sm font-medium text-gray-700 cursor-pointer dark:text-gray-300 dark:text-gray-200"
                      >
                        Last name
                      </label>
                      <div class="mt-1">
                        <input
                          id="last-name"
                          v-model="userData.last_name"
                          type="text"
                          name="last-name"
                          :required="hasError(errors, 'last_name')"
                          class="block w-full px-4 py-2 text-gray-900 border border-gray-300 rounded-md shadow-sm required:border-red-500 dark:bg-gray-700 dark:text-gray-200 dark:text-gray-100 focus:border-teal-500 dark:border-gray-600 focus:outline-none focus:ring-2"
                        >

                        <span
                          v-if="!isEmpty(errors)"
                          class="text-xs text-red-500"
                        >
                          {{ getError(errors, 'last_name') }}
                        </span>
                      </div>
                    </div>
                    <div class="sm:col-span-3">
                      <label
                        for="phone-number"
                        class="block text-sm font-medium text-gray-700 cursor-pointer dark:text-gray-300 dark:text-gray-200"
                      >
                        Phone Number
                      </label>
                      <div class="mt-1">
                        <input
                          id="phone-number"
                          v-model="userData.phone"
                          type="text"
                          name="phone-number"
                          :required="hasError(errors, 'phone')"
                          class="block w-full px-4 py-2 text-gray-900 border border-gray-300 rounded-md shadow-sm required:border-red-500 dark:bg-gray-700 dark:text-gray-200 dark:text-gray-100 focus:border-teal-500 dark:border-gray-600 focus:outline-none focus:ring-2"
                          @focusout="formatPhoneNumber($event)"
                        >

                        <span
                          v-if="!isEmpty(errors)"
                          class="text-xs text-red-500"
                        >
                          {{ getError(errors, 'phone') }}
                        </span>
                      </div>
                    </div>
                    <div class="sm:col-span-3">
                      <label
                        for="npn-number"
                        class="block text-sm font-medium text-gray-700 cursor-pointer dark:text-gray-300 dark:text-gray-200"
                      >
                        NPN Number
                      </label>
                      <div class="mt-1">
                        <input
                          id="npn-number"
                          v-model="userData.npn"
                          type="text"
                          name="npn-number"
                          :required="hasError(errors, 'npn')"
                          class="block w-full px-4 py-2 text-gray-900 border border-gray-300 rounded-md shadow-sm required:border-red-500 dark:bg-gray-700 dark:text-gray-200 dark:text-gray-100 focus:border-teal-500 dark:border-gray-600 focus:outline-none focus:ring-2"
                        >

                        <span
                          v-if="!isEmpty(errors)"
                          class="text-xs text-red-500"
                        >
                          {{ getError(errors, 'npn') }}
                        </span>
                      </div>
                    </div>
                    <div class="sm:col-span-3">
                      <label
                        for="email"
                        class="block text-sm font-medium text-gray-700 cursor-pointer dark:text-gray-300 dark:text-gray-200"
                      >
                        Email address
                      </label>
                      <div class="mt-1">
                        <input
                          id="email"
                          v-model="userData.email"
                          name="email"
                          type="email"
                          autocomplete="email"
                          :required="hasError(errors, 'email')"
                          class="block w-full px-4 py-2 text-gray-900 border border-gray-300 rounded-md shadow-sm required:border-red-500 dark:bg-gray-700 dark:text-gray-200 dark:text-gray-100 focus:border-teal-500 dark:border-gray-600 focus:outline-none focus:ring-2"
                        >

                        <span
                          v-if="!isEmpty(errors)"
                          class="text-xs text-red-500"
                        >
                          {{ getError(errors, 'email') }}
                        </span>
                      </div>
                    </div>
                    <div class="sm:col-span-3">
                      <label
                        for="state"
                        class="block text-sm font-medium text-gray-700 cursor-pointer dark:text-gray-300 dark:text-gray-200"
                      >
                        State
                      </label>
                      <div class="mt-1">
                        <select
                          id="state"
                          v-model="userData.state"
                          name="state"
                          class="block w-full px-4 py-2 text-gray-900 border border-gray-300 rounded-md shadow-sm required:border-red-500 dark:bg-gray-700 dark:text-gray-200 dark:text-gray-100 focus:border-teal-500 dark:border-gray-600 focus:outline-none focus:ring-2"
                        >
                          <option
                            v-for="(state, index) in states"
                            :key="index"
                            :value="state.abbreviation"
                          >
                            {{ state.name }}
                          </option>
                        </select>
                      </div>
                    </div>
                    <div class="sm:col-span-3">
                      <label
                        for="salesforce"
                        class="block text-sm font-medium text-gray-700 cursor-pointer dark:text-gray-300 dark:text-gray-200"
                      >
                        Salesforce Id
                      </label>
                      <div class="mt-1">
                        <input
                          id="salesforce"
                          v-model="userData.salesforce_id"
                          type="text"
                          name="salesforce"
                          class="block w-full px-4 py-2 text-gray-900 border border-gray-300 rounded-md shadow-sm required:border-red-500 dark:bg-gray-700 dark:text-gray-200 dark:text-gray-100 focus:border-teal-500 dark:border-gray-600 focus:outline-none focus:ring-2"
                        >
                      </div>
                    </div>
                  </div>
                  <div class="pt-8 ">
                    <div class="hidden">
                      <h3 class="text-lg font-medium leading-6 text-gray-900 dark:text-gray-100">
                        Carriers
                      </h3>
                      <p class="mt-1 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-300">
                        Please choose up to 2 Preferred Carriers
                      </p>
                    </div>
                    <div class="grid hidden grid-cols-1 mt-6 gap-y-6 gap-x-4 sm:grid-cols-2">
                      <div class="relative flex items-start">
                        <div class="flex items-center h-5">
                          <input
                            id="aetna"
                            name="aetna"
                            type="checkbox"
                            class="w-4 h-4 text-teal-600 border-gray-300 rounded"
                          >
                        </div>
                        <div class="ml-3 text-sm">
                          <label
                            for="aetna"
                            class="font-medium text-gray-700 cursor-pointer dark:text-gray-200"
                          >Aetna</label>
                        </div>
                      </div>
                      <div class="relative flex items-start">
                        <div class="flex items-center h-5">
                          <input
                            id="blue-medicare-advantage"
                            name="blue-medicare-advantage"
                            type="checkbox"
                            class="w-4 h-4 text-teal-600 border-gray-300 rounded"
                          >
                        </div> <div class="ml-3 text-sm">
                          <label
                            for="blue-medicare-advantage"
                            class="font-medium text-gray-700 cursor-pointer dark:text-gray-200"
                          >Blue Medicare Advantage</label>
                        </div>
                      </div>
                      <div class="relative flex items-start">
                        <div class="flex items-center h-5">
                          <input
                            id="united-health-care"
                            name="united-health-care"
                            type="checkbox"
                            class="w-4 h-4 text-teal-600 border-gray-300 rounded"
                          >
                        </div>
                        <div class="ml-3 text-sm">
                          <label
                            for="united-health-care"
                            class="font-medium text-gray-700 cursor-pointer dark:text-gray-200"
                          >United Health Care</label>
                        </div>
                      </div> <div class="relative flex items-start">
                        <div class="flex items-center h-5">
                          <input
                            id="molina-healthcare"
                            name="molina-healthcare"
                            type="checkbox"
                            class="w-4 h-4 text-teal-600 border-gray-300 rounded"
                          >
                        </div>
                        <div class="ml-3 text-sm">
                          <label
                            for="molina-healthcare"
                            class="font-medium text-gray-700 cursor-pointer dark:text-gray-200"
                          >Molina Healthcare</label>
                        </div>
                      </div>
                      <div class="relative flex items-start">
                        <div class="flex items-center h-5">
                          <input
                            id="Humana"
                            name="Humana"
                            type="checkbox"
                            class="w-4 h-4 text-teal-600 border-gray-300 rounded"
                          >
                        </div>
                        <div class="ml-3 text-sm">
                          <label
                            for="Humana"
                            class="font-medium text-gray-700 cursor-pointer dark:text-gray-200"
                          >Humana</label>
                        </div>
                      </div>
                      <div class="relative flex items-start">
                        <div class="flex items-center h-5">
                          <input
                            id="careplus"
                            name="careplus"
                            type="checkbox"
                            class="w-4 h-4 text-teal-600 border-gray-300 rounded"
                          >
                        </div>
                        <div class="ml-3 text-sm">
                          <label
                            for="careplus"
                            class="font-medium text-gray-700 cursor-pointer dark:text-gray-200"
                          >CarePlus</label>
                        </div>
                      </div>
                      <div class="relative flex items-start">
                        <div class="flex items-center h-5">
                          <input
                            id="anthem"
                            name="anthem"
                            type="checkbox"
                            class="w-4 h-4 text-teal-600 border-gray-300 rounded"
                          >
                        </div>
                        <div class="ml-3 text-sm">
                          <label
                            for="anthem"
                            class="font-medium text-gray-700 cursor-pointer dark:text-gray-200"
                          >Anthem</label>
                        </div>
                      </div>
                      <div class="relative flex items-start">
                        <div class="flex items-center h-5">
                          <input
                            id="wellcare"
                            name="wellcare"
                            type="checkbox"
                            class="w-4 h-4 text-teal-600 border-gray-300 rounded"
                          >
                        </div>
                        <div class="ml-3 text-sm">
                          <label
                            for="wellcare"
                            class="font-medium text-gray-700 cursor-pointer dark:text-gray-200"
                          >WellCare</label>
                        </div>
                      </div>
                      <div class="relative flex items-start">
                        <div class="flex items-center h-5">
                          <input
                            id="freedom-health"
                            name="freedom-health"
                            type="checkbox"
                            class="w-4 h-4 text-teal-600 border-gray-300 rounded"
                          >
                        </div> <div class="ml-3 text-sm">
                          <label
                            for="freedom-health"
                            class="font-medium text-gray-700 cursor-pointer dark:text-gray-200"
                          >Freedom Health</label>
                        </div>
                      </div>
                    </div>

                    <div class="mt-8">
                      <div class="flex flex-col items-center justify-between space-y-4 sm:space-y-0 sm:flex-row">
                        <div class="relative flex items-start">
                          <div class="flex items-center h-5">
                            <input
                              id="send-welcome-email"
                              name="send-welcome-email"
                              type="checkbox"
                              class="w-4 h-4 text-teal-600 border-gray-300 rounded"
                            >
                          </div>
                          <div class="ml-3 text-sm">
                            <label
                              for="send-welcome-email"
                              class="font-medium text-gray-700 cursor-pointer dark:text-gray-200"
                            >
                              Send Welcome Email
                            </label>
                          </div>
                        </div>
                        <div>
                          <button
                            type="button"
                            class="mr-4 secondary-button"
                            @click="router.go(-1)"
                          >
                            Cancel
                          </button>

                          <AppButton
                            button-text="Update"
                            loading-text="Updating..."
                            passed-class="primary-button"
                            @click="updateUser"
                          />
                        </div>
                      </div>
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
