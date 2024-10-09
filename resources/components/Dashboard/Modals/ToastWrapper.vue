<script setup lang="ts">
const { position } = defineProps<Props>()

const emit = defineEmits(['closeToast'])

interface Props {
  width: number // in rem
  position: string
}

function closeToast() {
  emit('closeToast')
}
</script>

<template>
  <div
    class="relative z-10"
    aria-labelledby="modal-title"
    role="dialog"
    aria-modal="true"
  >
    <!--
    Background backdrop, show/hide based on modal state.

    Entering: "ease-out duration-300"
      From: "opacity-0"
      To: "opacity-100"
    Leaving: "ease-in duration-200"
      From: "opacity-100"
      To: "opacity-0"
  -->
    <div class="fixed inset-0" />

    <div class="fixed inset-0 z-10 overflow-y-auto">
      <div
        :class="{
          'flex justify-center h-full': position === 'center',
          'flex justify-center': position === 'top',
          'flex justify-end mt-4': position === 'top-right',
          'flex justify-start': position === 'top-left',
        }"
        class="my-8 p-4 text-center sm:items-center sm:p-0"
      >
        <!-- Global notification live region, render this permanently at the end of the document -->
        <div
          aria-live="assertive"
          class="pointer-events-none fixed inset-0 flex items-end px-4 py-6 sm:items-start sm:p-6"
        >
          <div class="w-full flex flex-col items-center sm:items-end space-y-4">
            <div class="pointer-events-auto max-w-sm w-full overflow-hidden rounded-lg bg-white shadow-lg ring-1 ring-black ring-opacity-5 dark:bg-gray-700">
              <div class="p-4">
                <div class="flex items-center">
                  <slot name="modal-body" />
                  <div class="ml-4 flex flex-shrink-0">
                    <button
                      type="button"
                      class="inline-flex rounded-md text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      @click="closeToast()"
                    >
                      <span class="sr-only">Close</span>
                      <svg
                        class="h-5 w-5"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
