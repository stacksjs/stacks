<script setup lang="ts">
import { useWebpageStore } from '~/stores/webpage'

const {
  webpage,
} = defineProps<Props>()
const route = useRoute()
const webpageStore = useWebpageStore()

interface Props {
  webpage: object | any
}

const webpagePhoto = ref(null as any)
const webpagePhotoSecondary = ref(null as any)

const urlPhoto = ref('')
const urlPhotoSecondary = ref('')

function selectPhoto(event: any) {
  const files: ReadonlyArray<File> = [...(webpagePhoto.value.files ? webpagePhoto.value.files : [])]

  webpageStore.webpageForm.profile_picture = files[0]

  urlPhoto.value = URL.createObjectURL(files[0])
}

function selectPhotoSecondary(event: any) {
  const files: ReadonlyArray<File> = [...(webpagePhotoSecondary.value.files ? webpagePhotoSecondary.value.files : [])]

  webpageStore.webpageForm.secondary_logo = files[0]

  urlPhotoSecondary.value = URL.createObjectURL(files[0])
}

function selectFile() {
  webpagePhoto.value.click()
}

function selectFileSecondary() {
  webpagePhotoSecondary.value.click()
}

onMounted(async () => {
  await webpageStore.fetchWebpage(route.params.id)

  webpageStore.webpageForm = webpage

  urlPhoto.value = webpageStore.webpage.profile_picture
  urlPhotoSecondary.value = webpageStore.webpage.secondary_logo
})
</script>

<template>
  <form class="p-4 space-y-8 divide-y divide-gray-200 md:p-10">
    <div class="space-y-8 divide-y divide-gray-200 sm:space-y-5">
      <div>
        <div>
          <h3 class="text-lg font-medium leading-6 text-gray-900 dark:text-gray-100">
            Let Leads Know Who You Are
          </h3>
          <p class="max-w-2xl mt-1 text-sm text-gray-500 dark:text-gray-400">
            Contact information is essential when trying to reach new Clients.
            Add your Name, Email, and Phone Number which will be displayed on
            your web page. For a more personal touch, add a profile picture that
            gives a good representation of you.
          </p>
        </div>

        <div class="mt-6 space-y-6 sm:mt-5 sm:space-y-5">
          <div
            class=" sm:grid sm:grid-cols-3 sm:gap-4 sm:items-center sm:border-t sm:border-gray-200 sm:pt-5"
          >
            <label
              for="photo"
              class="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Agent Picture (Required)
            </label>
            <div class="mt-1 sm:mt-0 sm:col-span-2">
              <div class="flex items-center">
                <span
                  v-if="webpageStore.webpageForm.profile_picture"
                  class="w-12 h-12 rounded-full"
                >
                  <img
                    :src="urlPhoto"
                    alt=""
                    class="w-full h-full rounded-full"
                    style="object-fit: cover;"
                  >

                  <span
                    v-if="!isEmpty(webpageStore.formErrors)"
                    class="text-xs text-red-500"
                  >
                    {{ getError(webpageStore.formErrors, 'profile_picture') }}
                  </span>
                </span>
                <span
                  v-else
                  class="w-12 h-12 overflow-hidden bg-gray-100 rounded-full"
                >
                  <svg
                    class="w-full h-full text-gray-300"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z"
                    />
                  </svg>
                </span>

                <input
                  ref="webpagePhoto"
                  type="file"
                  class="hidden"
                  @change="selectPhoto($event)"
                >
                <button
                  type="button"
                  class="ml-4 secondary-button"
                  @click="selectFile()"
                >
                  Change
                </button>
              </div>
            </div>
          </div>

          <div
            class=" sm:grid sm:grid-cols-3 sm:gap-4 sm:items-start sm:border-t sm:border-gray-200 sm:pt-5"
          >
            <label
              for="cover-photo"
              class="block text-sm font-medium text-gray-700 dark:text-gray-300 sm:mt-px sm:pt-2"
            >
              Secondary Logo (Optional)
            </label>
            <div class="mt-1 sm:mt-0 sm:col-span-2">
              <div class="flex items-center">
                <span
                  v-if="webpageStore.webpageForm.secondary_logo"
                  class="w-12 h-12 rounded-full"
                >
                  <img
                    :src="urlPhotoSecondary"
                    alt=""
                    class="w-full h-full rounded-full"
                    style="object-fit: cover;"
                  >
                </span>
                <span
                  v-else
                  class="w-12 h-12 overflow-hidden bg-gray-100 rounded-full"
                >
                  <svg
                    class="w-full h-full text-gray-300"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z"
                    />
                  </svg>
                </span>
                <button
                  type="button"
                  class="ml-4 secondary-button"
                  @click="selectFileSecondary()"
                >
                  Change
                </button>

                <input
                  ref="webpagePhotoSecondary"
                  type="file"
                  class="hidden"
                  @change="selectPhotoSecondary($event)"
                >

                <span
                  v-if="!isEmpty(webpageStore.formErrors)"
                  class="text-xs text-red-500"
                >
                  {{ getError(webpageStore.formErrors, 'secondary_logo') }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div>
        <div class="space-y-6 sm:space-y-5">
          <div class="sm:grid sm:grid-cols-3 sm:gap-4 sm:items-start sm:pt-5">
            <label
              for="first-name"
              class="block text-sm font-medium text-gray-700 dark:text-gray-300 sm:mt-px sm:pt-2"
            >
              First name
            </label>
            <div class="mt-1 sm:mt-0 sm:col-span-2">
              <input
                id="first-name"
                v-model="webpageStore.webpageForm.first_name"
                type="text"
                name="first-name"
                autocomplete="given-name"
                class="block w-full px-4 py-2 text-gray-900 border border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:text-gray-200 dark:text-gray-100 focus:border-teal-500 dark:border-gray-600 focus:outline-none focus:ring-2"
              >
            </div>
          </div>

          <div
            class=" sm:grid sm:grid-cols-3 sm:gap-4 sm:items-start sm:border-t sm:border-gray-200 sm:pt-5"
          >
            <label
              for="last-name"
              class="block text-sm font-medium text-gray-700 dark:text-gray-300 sm:mt-px sm:pt-2"
            >
              Last name
            </label>
            <div class="mt-1 sm:mt-0 sm:col-span-2">
              <input
                id="last-name"
                v-model="webpageStore.webpageForm.last_name"
                type="text"
                name="last-name"
                autocomplete="family-name"
                class="block w-full px-4 py-2 text-gray-900 border border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:text-gray-200 dark:text-gray-100 focus:border-teal-500 dark:border-gray-600 focus:outline-none focus:ring-2"
              >
            </div>
          </div>

          <div
            class=" sm:grid sm:grid-cols-3 sm:gap-4 sm:items-start sm:border-t sm:border-gray-200 sm:pt-5"
          >
            <label
              for="email"
              class="block text-sm font-medium text-gray-700 dark:text-gray-300 sm:mt-px sm:pt-2"
            >
              Email address
            </label>
            <div class="mt-1 sm:mt-0 sm:col-span-2">
              <input
                id="email"
                v-model="webpageStore.webpageForm.email_address"
                type="email"
                name="email"
                class="block w-full px-4 py-2 text-gray-900 border border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:text-gray-200 dark:text-gray-100 focus:border-teal-500 dark:border-gray-600 focus:outline-none focus:ring-2"
              >
            </div>
          </div>

          <div
            class=" sm:grid sm:grid-cols-3 sm:gap-4 sm:items-start sm:border-t sm:border-gray-200 sm:pt-5"
          >
            <label
              for="country"
              class="block text-sm font-medium text-gray-700 dark:text-gray-300 sm:mt-px sm:pt-2"
            >
              State
            </label>
            <div class="mt-1 sm:mt-0 sm:col-span-2">
              <select
                id="country"
                name="country"
                autocomplete="country"
                class="block w-full px-4 py-2 text-gray-900 border border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:text-gray-200 dark:text-gray-100 focus:border-teal-500 dark:border-gray-600 focus:outline-none focus:ring-2"
              >
                <option>United States</option>
                <option>Canada</option>
                <option>Mexico</option>
              </select>
            </div>
          </div>

          <div
            class=" sm:grid sm:grid-cols-3 sm:gap-4 sm:items-start sm:border-t sm:border-gray-200 sm:pt-5"
          >
            <label
              for="city"
              class="block text-sm font-medium text-gray-700 dark:text-gray-300 sm:mt-px sm:pt-2"
            >
              City
            </label>
            <div class="mt-1 sm:mt-0 sm:col-span-2">
              <input
                id="city"
                v-model="webpageStore.webpageForm.city"
                type="text"
                name="city"
                class="block w-full px-4 py-2 text-gray-900 border border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:text-gray-200 dark:text-gray-100 focus:border-teal-500 dark:border-gray-600 focus:outline-none focus:ring-2"
              >
            </div>
          </div>

          <div
            class=" sm:grid sm:grid-cols-3 sm:gap-4 sm:items-start sm:border-t sm:border-gray-200 sm:pt-5"
          >
            <label
              for="postal"
              class="block text-sm font-medium text-gray-700 dark:text-gray-300 sm:mt-px sm:pt-2"
            >
              Postal Code
            </label>
            <div class="mt-1 sm:mt-0 sm:col-span-2">
              <input
                id="postal"
                v-model="webpageStore.webpageForm.postal_code"
                type="text"
                name="postal"
                class="block w-full px-4 py-2 text-gray-900 border border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:text-gray-200 dark:text-gray-100 focus:border-teal-500 dark:border-gray-600 focus:outline-none focus:ring-2"
              >
            </div>
          </div>

          <div
            class=" sm:grid sm:grid-cols-3 sm:gap-4 sm:items-start sm:border-t sm:border-gray-200 sm:pt-5"
          >
            <label
              for="phone"
              class="block text-sm font-medium text-gray-700 dark:text-gray-300 sm:mt-px sm:pt-2"
            >
              Phone
            </label>
            <div class="mt-1 sm:mt-0 sm:col-span-2">
              <input
                id="phone"
                v-model="webpageStore.webpageForm.phone"
                type="text"
                autocomplete="postal-code"
                class="block w-full px-4 py-2 text-gray-900 border border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:text-gray-200 dark:text-gray-100 focus:border-teal-500 dark:border-gray-600 focus:outline-none focus:ring-2"
              >
            </div>
          </div>

          <div
            class=" sm:grid sm:grid-cols-3 sm:gap-4 sm:items-start sm:border-t sm:border-gray-200 sm:pt-5"
          >
            <label
              for="subdomain"
              class="block text-sm font-medium text-gray-700 dark:text-gray-300 sm:mt-px sm:pt-2"
            >
              Subdomain
            </label>
            <div class="mt-1 sm:mt-0 sm:col-span-2">
              <input
                id="subdomain"
                v-model="webpageStore.webpageForm.subdomain"
                type="text"
                class="block w-full px-4 py-2 text-gray-900 border border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:text-gray-200 dark:text-gray-100 focus:border-teal-500 dark:border-gray-600 focus:outline-none focus:ring-2"
              >
            </div>
          </div>

          <div
            class=" sm:grid sm:grid-cols-3 sm:gap-4 sm:items-start sm:border-t sm:border-gray-200 sm:pt-5"
          >
            <label
              for="purl"
              class="block text-sm font-medium text-gray-700 dark:text-gray-300 sm:mt-px sm:pt-2"
            >
              Carecompare PURL
            </label>
            <div class="mt-1 sm:mt-0 sm:col-span-2">
              <input
                id="purl"
                v-model="webpageStore.webpageForm.carecompare_purl"
                type="text"
                name="zip"
                class="block w-full px-4 py-2 text-gray-900 border border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:text-gray-200 dark:text-gray-100 focus:border-teal-500 dark:border-gray-600 focus:outline-none focus:ring-2"
              >
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="pt-5">
      <div>
        <h3 class="text-lg font-medium leading-6 text-gray-900 dark:text-gray-100">
          Please Note
        </h3>
        <p class="max-w-2xl mt-1 text-sm text-gray-500 dark:text-gray-400">
          Saving any edits made to your personal information will temporarily
          change the status of your website to Under Review until one of our
          team members is able to approve the edits. Once the edits are approved
          your website will return to Live status. Click the status above for
          more info.
        </p>
      </div>
    </div>
  </form>
</template>
