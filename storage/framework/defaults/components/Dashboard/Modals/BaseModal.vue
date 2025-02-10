<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

const emit = defineEmits(['closeModal'])
const status = ref(false as boolean)
const statusTransition = ref(false as boolean)

onMounted(() => {
  status.value = true
  document.body.style.overflowY = 'hidden'
})

onUnmounted(() => {
  status.value = false
  document.body.style.overflowY = 'visible'
})
</script>

<template>
  <div
    class="fixed inset-x-0 bottom-0 px-4 pb-6 sm:inset-0 sm:flex sm:items-center sm:justify-center sm:p-0"
    :style="statusTransition ? 'z-index: 20' : 'z-index: -1' "
  >
    <Transition
      enter-active-class="opacity-0 "
      enter-class="duration-300 ease-out"
      enter-to-class="opacity-100"
      leave-active-class="opacity-100"
      leave-class="duration-200 ease-in"
      leave-to-class="opacity-0"
      @before-enter="statusTransition = true"
      @after-leave="statusTransition = false"
    >
      <div
        v-show="status"
        class="fixed inset-0 transition-opacity"
      >
        <div class="absolute inset-0 bg-gray-500 opacity-75" />
      </div>
    </Transition>

    <span class="hidden sm:inline-block sm:h-screen sm:align-middle" />&#8203;

    <Transition
      enter-active-class="translate-y-4 opacity-0 sm:translate-y-0 sm:scale-95"
      enter-class="duration-300 ease-out"
      enter-to-class="translate-y-0 opacity-100 sm:scale-100"
      leave-active-class="translate-y-0 opacity-100 sm:scale-100 "
      leave-class="duration-200 ease-in"
      leave-to-class="translate-y-4 opacity-0 sm:translate-y-0 sm:scale-95"
    >
      <div
        v-show="status"
        class="max-h-[32rem] max-w-md transform overflow-hidden overflow-y-auto rounded-lg bg-white px-4 pb-4 pt-5 shadow-xl transition-all md:max-w-xl sm:w-full dark:bg-blue-gray-700 sm:p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-headline"
      >
        <div class="absolute right-0 top-0 pr-4 pt-4">
          <button
            type="button"
            class="text-gray-400 transition duration-150 ease-in-out focus:text-gray-500 hover:text-blue-gray-500 focus:outline-none"
            aria-label="Close"
            @click="emit('closeModal')"
          >
            <svg
              class="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        <div class="flex flex-col">
          <slot name="modal-body" />
        </div>

        <div class="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse space-y-4 md:space-y-0">
          <slot name="modal-actions" />
        </div>
      </div>
    </Transition>
  </div>
</template>
