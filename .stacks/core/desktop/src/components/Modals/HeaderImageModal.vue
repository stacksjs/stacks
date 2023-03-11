<script setup lang="ts">
import { useWebpageStore } from '~/stores/webpage'

const emit = defineEmits(['closeModal'])

const webpageStore = useWebpageStore()

onMounted(() => {
  fetchWebpageImages()
})

const selectedImage = ref('')

const baseUrl = import.meta.env.VITE_API_ROOT_BASE_URL

function getImageUrl(image: string) {
  return `${baseUrl}${image}`
}

async function fetchWebpageImages() {
  await webpageStore.fetchWebpageHeaderImages()
}

function selectImage(image: string) {
  selectedImage.value = image

  webpageStore.webpageForm.headline_1_image = selectedImage.value

  emit('closeModal')
}

function close() {
  emit('closeModal')
}
</script>

<template>
  <div>
    <ModalWrapper
      title="Create User"
      @close-modal="close()"
    >
      <template #modal-body>
        <div>
          <h4 class="pt-6 pb-4 pl-6">
            Select a Header Photo
          </h4>
          <div class="flex flex-wrap">
            <div
              v-for="(image, index) in webpageStore.headerImages.images"
              :key="index"
              class="relative flex flex-col items-center p-6 space-y-4 cursor-pointer xs:w-full sm:w-1/2 md:w-1/3"
            >
              <img
                class="cursor-pointer"
                :src="getImageUrl(image)"
                @click="selectImage(image)"
              >

              <div class="">
                <button
                  type="button"
                  class="primary-button"
                  @click="selectImage(image)"
                >
                  Click to Select
                </button>
              </div>
            </div>
          </div>
        </div>
      </template>
      <template #modal-actions>
        <div class="flex items-center justify-end">
          <div>
            <button
              type="button"
              class="secondary-button"
              @click="close"
            >
              Close
            </button>
          </div>
        </div>
      </template>
    </ModalWrapper>
  </div>
</template>
