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
    class="fixed inset-x-0 bottom-0 px-4 pb-6 sm:inset-0 sm:p-0 sm:flex sm:items-center sm:justify-center"
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

    <span class="hidden sm:inline-block sm:align-middle sm:h-screen" />&#8203;

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
        class="max-w-md px-4 pt-5 pb-4 max-h-[32rem] overflow-y-auto overflow-hidden transition-all transform bg-white rounded-lg shadow-xl md:max-w-xl dark:bg-blue-gray-700 sm:w-full sm:p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-headline"
      >
        <div class="absolute top-0 right-0 pt-4 pr-4">
          <button
            type="button"
            class="text-gray-400 transition duration-150 ease-in-out hover:text-blue-gray-500 focus:outline-none focus:text-gray-500"
            aria-label="Close"
            @click="emit('closeModal')"
          >
            <svg
              class="w-6 h-6"
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

        <div class="mt-5 space-y-4 sm:mt-4 sm:flex md:space-y-0 sm:flex-row-reverse">
          <slot name="modal-actions" />
        </div>
      </div>
    </Transition>
  </div>
</template>
