<script setup lang="ts">
import { useWebpageStore } from '~/stores/webpage'

interface Props {
  webpage: any
}

const {
  webpage,
} = defineProps<Props>()

const baseUrl = import.meta.env.VITE_API_ROOT_BASE_URL

const headerImageModal = ref(false)
const webpageStore = useWebpageStore()

function openHeaderImageModal() {
  headerImageModal.value = true
}

function closeHeaderImageModal() {
  headerImageModal.value = false
}

onMounted(() => {
  webpageStore.webpageForm.headline_1_image = webpage.headline_1_image
  webpageStore.webpageForm.headline_1 = webpage.headline_1
})

const getUrl = computed(() => {
  const image = webpageStore.webpageForm.headline_1_image

  return `${baseUrl}${image}`
})
</script>

<template>
  <div class="p-10 space-y-8 divide-y divide-gray-200 dark:divide-gray-600">
    <div>
      <h3 class="text-lg font-medium leading-6 text-gray-900 dark:text-gray-100">
        Choose a Header Image You Resonate With
      </h3>
      <p class="max-w-2xl mt-1 text-sm text-gray-500 dark:text-gray-400">
        Your Header Image is the first thing anyone will see when visiting your
        website. Choose the perfect image and a complimenting tagline below. If
        you would like to have a Slide Show for your Header Image select more
        than one image and tagline below.
      </p>
    </div>

    <div class="border-none">
      <label
        for="cover-photo"
        class="block text-sm font-medium text-gray-700 dark:text-gray-300"
      >
        Select Header Image 1
      </label>
      <div
        class="flex justify-center w-3/4 px-6 pt-5 pb-6 mt-1 rounded-md "
      >
        <div class="space-y-1 text-center">
          <img
            :src="getUrl"
            alt=""
          >

          <svg

            class="w-12 h-12 mx-auto text-gray-400"
            stroke="currentColor"
            fill="none"
            viewBox="0 0 48 48"
            aria-hidden="true"
          >
            <path
              d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>

          <div class="flex text-sm text-gray-600">
            <label
              for="file-upload"
              class="relative font-medium text-gray-600 bg-white rounded-md cursor-pointer dark:bg-gray-600 dark:text-gray-100 hover:text-gray-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-teal-500"
            >
              <button
                class="px-2 py-1"
                @click="openHeaderImageModal"
              >Select an image</button>
            </label>
            <p class="pl-1">
              or drag and drop
            </p>
          </div>
          <p class="text-xs text-gray-500 dark:text-gray-400">
            PNG, JPG, GIF up to 10MB
          </p>
        </div>
      </div>
      <div class="w-3/4 mt-2">
        <select
          id="country"
          v-model="webpageStore.webpageForm.headline_1"
          name="country"
          autocomplete="country"
          class="block w-full p-2 text-gray-900 border border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:text-gray-200 dark:text-gray-100 focus:border-teal-500 dark:border-gray-600"
        >
          <option :value="6">
            Let me help find a Medicare plan that fits your needs.
          </option>
          <option :value="7">
            Simplifying the Medicare process to save you time and money.
          </option>
          <option :value="8">
            Medicare can be complicated, let me help simplify it for you!
          </option>
          <option :value="9">
            Your Medicare adviser from start to finish.
          </option>
          <option :value="10">
            Helping you find the right Medicare plan at the right price
          </option>
          <option :value="11">
            Your friendly guide to get through the Medicare process.
          </option>
          <option :value="12">
            Dedicated to finding the right Medicare plan for your needs.
          </option>
          <option :value="13">
            Overwhelmed with your Medicare options? I can help!
          </option>
          <option :value="14">
            Your reliable Medicare partner.
          </option>
          <option :value="15">
            Your trusted source for everything Medicare.
          </option>
          <option :value="16">
            Let me help find a Medicare plan that fits your needs.
          </option>
        </select>
      </div>
    </div>

    <HeaderImageModal
      v-if="headerImageModal"
      @close-modal="closeHeaderImageModal"
    />
  </div>
</template>
