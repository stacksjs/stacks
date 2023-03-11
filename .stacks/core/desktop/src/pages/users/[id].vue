<script setup lang="ts">
import { useUserStore } from '~/stores/user'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const toast = useToast()

const baseUrl = import.meta.env.VITE_API_ROOT_BASE_URL
onMounted(async () => {
  await fetchUser()
})

async function fetchUser() {
  await userStore.fetchUser(route.params.id)
}

function loginAs() {
  window.open(`${baseUrl}/impersonate-as/${route.params.id}`)
}

async function syncUser() {
  toast.info({ text: 'Syncing User', duration: 3000 })

  try {
    await userStore.syncUser(route.params.id)

    toast.success({ text: 'Successfully synced user!' })
  }
  catch (err: any) {
    toast.success({ text: 'Failed to sync user!' })
  }
}

const fullName = computed(() => {
  return `${userStore.user.first_name} ${userStore.user.last_name}`
})
</script>

<template>
  <div>
    <div class="flex flex-col lg:pl-64">
      <main class="flex-1">
        <TopBar />

        <main
          class="min-h-screen py-4 py-10 lg:py-8 dark:bg-gray-800"
        >
          <!-- Page header -->
          <div class="px-4 sm:px-6 md:flex md:items-center md:justify-between md:space-x-5 lg:px-8">
            <div class="flex items-center space-x-5">
              <div>
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
              </div>
              <div class="flex-shrink-0">
                <div class="relative">
                  <img
                    class="w-16 h-16 rounded-full"
                    :src="userStore.user.agent_picture"
                    alt=""
                  >
                  <span
                    class="absolute inset-0 rounded-full shadow-inner"
                    aria-hidden="true"
                  />
                </div>
              </div>
              <div>
                <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {{ fullName }}
                </h1>
              </div>
            </div>
            <div class="flex flex-col-reverse mt-6 space-y-4 space-y-reverse justify-stretch sm:flex-row-reverse sm:justify-end sm:space-y-0 sm:space-x-3 sm:space-x-reverse md:mt-0 md:flex-row md:space-x-3">
              <button
                type="button"
                class="secondary-button"
                @click="syncUser()"
              >
                Sync User
              </button>
              <button
                type="button"
                class="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-teal-600 border border-transparent rounded-md shadow-sm hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-100"
                @click="loginAs()"
              >
                Login As
              </button>
            </div>
          </div>

          <div class="mt-8 sm:px-6">
            <div class="space-y-6 lg:col-span-2 lg:col-start-1">
              <!-- Description list -->
              <section
                v-if="userStore.user"
                aria-labelledby="applicant-information-title"
              >
                <div class="bg-white shadow sm:rounded-lg dark:bg-gray-700">
                  <div class="px-4 py-5 sm:px-6">
                    <h2
                      id="applicant-information-title"
                      class="text-lg font-medium leading-6 text-gray-900 dark:text-gray-100"
                    >
                      User Information
                    </h2>
                    <p class="max-w-2xl mt-1 text-sm text-gray-500 dark:text-gray-400">
                      Personal details and application.
                    </p>
                  </div>
                  <div class="px-4 py-5 border-t border-gray-200 sm:px-6">
                    <dl class="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-3">
                      <div class="sm:col-span-1">
                        <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">
                          NPN
                        </dt>
                        <dd class="mt-1 text-sm text-gray-900 dark:text-gray-100">
                          {{ userStore.user.npn }}
                        </dd>
                      </div>
                      <div class="sm:col-span-1">
                        <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">
                          Email address
                        </dt>
                        <dd class="mt-1 text-sm text-gray-900 dark:text-gray-100">
                          {{ userStore.user.email }}
                        </dd>
                      </div>
                      <div class="sm:col-span-1">
                        <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">
                          Phone
                        </dt>
                        <dd class="mt-1 text-sm text-gray-900 dark:text-gray-100">
                          {{ userStore.user.phone }}
                        </dd>
                      </div>
                      <div class="sm:col-span-1">
                        <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">
                          Address
                        </dt>
                        <dd class="mt-1 text-sm text-gray-900 dark:text-gray-100">
                          {{ userStore.user.address || 'N/A' }}
                        </dd>
                      </div>
                      <div class="sm:col-span-1">
                        <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">
                          City
                        </dt>
                        <dd class="mt-1 text-sm text-gray-900 dark:text-gray-100">
                          {{ userStore.user.city || 'N/A' }}
                        </dd>
                      </div>
                      <div class="sm:col-span-1">
                        <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">
                          State
                        </dt>
                        <dd class="mt-1 text-sm text-gray-900 dark:text-gray-100">
                          {{ userStore.user.state || 'N/A' }}
                        </dd>
                      </div>
                      <div class="sm:col-span-1">
                        <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">
                          Postal Code
                        </dt>
                        <dd class="mt-1 text-sm text-gray-900 dark:text-gray-100">
                          {{ userStore.user.postal_code || 'N/A' }}
                        </dd>
                      </div>
                      <div class="sm:col-span-1">
                        <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">
                          Country
                        </dt>
                        <dd class="mt-1 text-sm text-gray-900 dark:text-gray-100">
                          {{ userStore.user.country || 'N/A' }}
                        </dd>
                      </div>
                      <div class="sm:col-span-1">
                        <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">
                          Primary Language
                        </dt>
                        <dd class="mt-1 text-sm text-gray-900 dark:text-gray-100">
                          {{ userStore.user.language || 'N/A' }}
                        </dd>
                      </div>
                      <div class="sm:col-span-1">
                        <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">
                          Is RTS
                        </dt>
                        <dd class="mt-1 text-sm text-gray-900 dark:text-gray-100">
                          {{ userStore.user.is_rts ? 'Yes' : 'No' }}
                        </dd>
                      </div>
                      <div class="sm:col-span-1">
                        <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">
                          Is CareCompare
                        </dt>
                        <dd class="mt-1 text-sm text-gray-900 dark:text-gray-100">
                          {{ userStore.user.is_carecompare ? 'Yes' : 'No' }}
                        </dd>
                      </div>
                      <div class="sm:col-span-1">
                        <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">
                          Sunfire Access
                        </dt>
                        <dd class="mt-1 text-sm text-gray-900 dark:text-gray-100">
                          {{ userStore.user.sunfire_access ? 'Yes' : 'No' }}
                        </dd>
                      </div>
                      <div class="sm:col-span-1">
                        <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">
                          Website Access
                        </dt>
                        <dd class="mt-1 text-sm text-gray-900 dark:text-gray-100">
                          {{ userStore.user.website_access ? 'Yes' : 'No' }}
                        </dd>
                      </div>
                      <div class="sm:col-span-1">
                        <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">
                          Recruitment Status
                        </dt>
                        <dd class="mt-1 text-sm text-gray-900 dark:text-gray-100">
                          {{ userStore.user.recruitment_status || 'N/A' }}
                        </dd>
                      </div>
                      <div class="sm:col-span-1">
                        <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">
                          RTS Designation Status
                        </dt>
                        <dd class="mt-1 text-sm text-gray-900 dark:text-gray-100">
                          {{ userStore.user.rts_designation_status || 'N/A' }}
                        </dd>
                      </div>
                    </dl>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </main>
      </main>
    </div>
  </div>
</template>
