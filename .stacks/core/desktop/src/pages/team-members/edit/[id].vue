<script setup lang="ts">
import type { Ref } from 'vue'
import { useUserStore } from '~/stores/user'

const route = useRoute()
const router = useRouter()
const toast = useToast()
const userStore = useUserStore()
const errors = ref({} as any)

const memberData: Ref<any> = ref({
  name: '',
  title: '',
  sub_title: '',
  bio: '',
  linkedin: '',
  image: '',
  territories: '',
  is_national_sales_broker: false,
  is_regional_sales_broker: false,
  file: {} as File,
})

const urlPhoto = ref('')
const memberPhoto = ref(null as any)

onMounted(async () => {
  await fetchTeamMember()

  urlPhoto.value = memberData.value.image
})

async function fetchTeamMember() {
  await userStore.fetchTeamMember(route.params.id)

  memberData.value = userStore.teamMember

  if (userStore.teamMember.is_national_sales_broker)
    memberData.value.is_national_sales_broker = true

  if (userStore.teamMember.is_regional_sales_broker)
    memberData.value.is_regional_sales_broker = true
}

async function updateTeamMember() {
  const formData = new FormData()

  Object.keys(memberData.value).forEach((key) => {
    if (memberData.value[key])
      formData.append(key, memberData.value[key])

    return formData
  })

  try {
    errors.value = {}

    await userStore.updateTeamMember(route.params.id, formData)

    await toast.success({ text: 'Successfully updated team member!' })

    router.push({ name: 'team-members' })
  }
  catch (err: any) {
    errors.value = err.data.errors
  }
}

function cancel() {
  router.push({ name: 'team-members' })
}

function selectFile() {
  memberPhoto.value.click()
}

function selectPhoto(event: any) {
  const files: ReadonlyArray<File> = [...(memberPhoto.value.files ? memberPhoto.value.files : [])]

  memberData.value.file = files[0]

  urlPhoto.value = URL.createObjectURL(files[0])
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
                  Edit Member
                </h2>
              </div>
              <div class="px-4 py-6 pb-4 mt-4 bg-white rounded-lg sm:px-8 sm:py-10 dark:bg-gray-700">
                <div class="space-y-8 divide-y divide-gray-200">
                  <div class="grid grid-cols-1 gap-y-6 gap-x-4">
                    <div>
                      <label
                        for="name"
                        class="block text-sm font-medium text-gray-700 dark:text-gray-300"
                      >
                        Name
                      </label>
                      <div class="mt-1">
                        <input
                          id="name"
                          v-model="memberData.name"
                          type="text"
                          :required="hasError(errors, 'name')"
                          class="block w-full px-4 py-2 text-gray-900 border border-gray-300 rounded-md shadow-sm required:border-red-500 dark:bg-gray-700 dark:text-gray-200 dark:text-gray-100 focus:border-teal-500 dark:border-gray-600 focus:outline-none focus:ring-2"
                        >

                        <span
                          v-if="!isEmpty(errors)"
                          class="text-xs text-red-500"
                        >
                          {{ getError(errors, 'name') }}
                        </span>
                      </div>
                    </div>
                    <div>
                      <label
                        for="title"
                        class="block text-sm font-medium text-gray-700 dark:text-gray-300"
                      >
                        Title
                      </label>
                      <div class="mt-1">
                        <input
                          id="title"
                          v-model="memberData.title"
                          type="text"
                          :required="hasError(errors, 'title')"
                          class="block w-full px-4 py-2 text-gray-900 border border-gray-300 rounded-md shadow-sm required:border-red-500 dark:bg-gray-700 dark:text-gray-200 dark:text-gray-100 focus:border-teal-500 dark:border-gray-600 focus:outline-none focus:ring-2"
                        >

                        <span
                          v-if="!isEmpty(errors)"
                          class="text-xs text-red-500"
                        >
                          {{ getError(errors, 'title') }}
                        </span>
                      </div>
                    </div>
                    <div>
                      <label
                        for="sub-title"
                        class="block text-sm font-medium text-gray-700 dark:text-gray-300"
                      >
                        Sub Title
                      </label>
                      <div class="mt-1">
                        <input
                          id="sub-title"
                          type="text"
                          class="block w-full px-4 py-2 text-gray-900 border border-gray-300 rounded-md shadow-sm required:border-red-500 dark:bg-gray-700 dark:text-gray-200 dark:text-gray-100 focus:border-teal-500 dark:border-gray-600 focus:outline-none focus:ring-2"
                        >
                      </div>
                    </div>
                    <div>
                      <label
                        for="linkedin"
                        class="block text-sm font-medium text-gray-700 dark:text-gray-300"
                      >
                        LinkedIn
                      </label>
                      <div class="mt-1">
                        <input
                          id="linkedin"
                          v-model="memberData.linkedin"
                          type="text"
                          name="linkedin"
                          :required="hasError(errors, 'linkedin')"
                          class="block w-full px-4 py-2 text-gray-900 border border-gray-300 rounded-md shadow-sm required:border-red-500 dark:bg-gray-700 dark:text-gray-200 dark:text-gray-100 focus:border-teal-500 dark:border-gray-600 focus:outline-none focus:ring-2"
                        >

                        <span
                          v-if="!isEmpty(errors)"
                          class="text-xs text-red-500"
                        >
                          {{ getError(errors, 'linkedin') }}
                        </span>
                      </div>
                    </div>
                    <div>
                      <label
                        for="territory"
                        class="block text-sm font-medium text-gray-700 dark:text-gray-300"
                      >
                        Territories <span class="text-xs text-gray-400">(Separated by comma)</span>
                      </label>
                      <div class="mt-1">
                        <textarea
                          id="territory"
                          v-model="memberData.territories"
                          rows="2"
                          cols="50"
                          class="block w-full px-4 py-2 text-gray-900 border border-gray-300 rounded-md shadow-sm required:border-red-500 dark:bg-gray-700 dark:text-gray-200 dark:text-gray-100 focus:border-teal-500 dark:border-gray-600 focus:outline-none focus:ring-2"
                        />
                      </div>
                    </div>
                    <div>
                      <label
                        for="bio"
                        class="block text-sm font-medium text-gray-700 dark:text-gray-300"
                      >
                        Bio
                      </label>
                      <div class="mt-1">
                        <textarea
                          id="bio"
                          v-model="memberData.bio"
                          rows="8"
                          cols="50"
                          :required="hasError(errors, 'bio')"
                          class="block w-full px-4 py-2 text-gray-900 border border-gray-300 rounded-md shadow-sm required:border-red-500 dark:bg-gray-700 dark:text-gray-200 dark:text-gray-100 focus:border-teal-500 dark:border-gray-600 focus:outline-none focus:ring-2"
                        />

                        <span
                          v-if="!isEmpty(errors)"
                          class="text-xs text-red-500"
                        >
                          {{ getError(errors, 'bio') }}
                        </span>
                      </div>
                    </div>

                    <div>
                      <label
                        for="country"
                        class="block text-sm font-medium text-gray-700 dark:text-gray-300"
                      >
                        Avatar
                      </label>
                      <div class="flex flex-col items-center mt-4 space-y-2 md:space-y-0 md:flex-row">
                        <span class="w-16 h-16 overflow-hidden bg-gray-100 rounded-full">
                          <img
                            v-if="urlPhoto"
                            :src="urlPhoto"
                            alt=""
                            class="object-cover w-full h-full"
                          >
                          <svg
                            v-else
                            fill="currentColor"
                            viewBox="0 0 24 24"
                            class="w-full h-full text-gray-300"
                          >
                            <path d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z" />
                          </svg>
                        </span>
                        <button
                          type="button"
                          class="ml-2 secondary-button"
                          @click="selectFile()"
                        >
                          Select file
                        </button>

                        <input
                          ref="memberPhoto"
                          type="file"
                          class="hidden"
                          @change="selectPhoto($event)"
                        >
                      </div>
                    </div>
                    <div class="relative flex flex-col items-center space-y-4 md:flex-row md:space-y-0">
                      <div class="flex items-center flex-1">
                        <div class="flex items-center h-5">
                          <input
                            id="regional"
                            v-model="memberData.is_regional_sales_broker"
                            name="regional"
                            type="checkbox"
                            class="w-4 h-4 border-gray-300 rounded focus:ring-cyan-500 text-cyan-600"
                          >
                        </div>
                        <div class="ml-3 text-sm">
                          <label
                            for="regional"
                            class="font-medium text-gray-700 dark:text-gray-300"
                          >Regional Sales Broker</label>
                        </div>

                        <div class="flex items-center h-5 ml-4">
                          <input
                            id="national"
                            v-model="memberData.is_national_sales_broker"
                            name="national"
                            type="checkbox"
                            class="w-4 h-4 border-gray-300 rounded focus:ring-cyan-500 text-cyan-600"
                          >
                        </div>
                        <div class="ml-3 text-sm">
                          <label
                            for="national"
                            class="font-medium text-gray-700 dark:text-gray-300"
                          >National Sales Broker</label>
                        </div>
                      </div>

                      <div>
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
                          @click="updateTeamMember()"
                        />
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

<style scoped>
.block w-full px-4 py-2 text-gray-900 border border-gray-300 rounded-md shadow-sm required:border-red-500 dark:bg-gray-700 dark:text-gray-200 dark:text-gray-100 focus:border-teal-500 dark:border-gray-600 focus:outline-none focus:ring-2 {
  @apply block required:border-red-500 w-full px-4 py-2 text-gray-900 border border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:text-gray-200 dark:text-gray-100 focus:border-teal-500 dark:border-gray-600 focus:outline-none focus:ring-2
}
</style>
