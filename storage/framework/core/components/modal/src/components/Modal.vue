<script lang="ts" setup>
import { computed, defineCustomElement, onMounted, onUnmounted, Transition, useSlots } from 'vue'

const props = defineProps<{
  visible: boolean
  className?: string
  closeButton?: boolean
  transition?: 'fade' | 'slide-fade' | 'scale'
}>()

const emit = defineEmits<{
  (event: 'close', visible: boolean): void
}>()
const slots = useSlots()
const isVisible = computed(() => props.visible)
const isCloseButtonVisible = computed(() => props.closeButton)
const isHeaderVisible = computed(() => slots.header)
const modalTransition = computed(() => props.transition || 'fade')

function handleClose() {
  emit('close', false)
}

function handleEscape(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    handleClose()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleEscape)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleEscape)
})

defineCustomElement({
  shadow: true,
})
</script>

<template>
  <div>
    <Transition :name="modalTransition">
      <div v-if="isVisible" class="relative z-10" aria-labelledby="modal-title" role="dialog" aria-modal="true">
        <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" />

        <div class="fixed inset-0 z-10 w-screen overflow-y-auto">
          <div class="min-h-full flex items-end justify-center p-4 text-center sm:items-center sm:p-0" @click.self="handleClose">
              <div class="modal-content transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:max-w-lg sm:w-full sm:p-6" @click.stop>
                <slot v-if="isCloseButtonVisible" name="close-button">
                  <div class="absolute right-0 top-0 pr-4 pt-4 sm:block">
                    <button type="button" class="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500" @click="handleClose">
                      <span class="sr-only">Close</span>
                      <div class="i-ic:outline-close h-8 w-8" />
                    </button>
                  </div>
                </slot>

                <div class="w-full flex">
                  <slot v-if="isHeaderVisible" name="header">
                    <div class="flex items-center justify-between">
                      <div class="text-gray-900 font-medium">
                        <!-- Default header content -->
                        <span>Modal Header</span>
                      </div>
                    </div>
                  </slot>
                </div>

                <div class="w-full flex">
                  <slot>
                    <p>Default modal content goes here.</p>
                  </slot>
                </div>
              </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.4s;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}

/* Slide-fade transition */
.slide-fade-enter-active .modal-content, .slide-fade-leave-active .modal-content{
  transition: transform 1s, opacity 1s;
}

.slide-fade-enter-from .modal-content {
  transform: translateY(-100%);
  opacity: 0;
}

.slide-fade-leave-to .modal-content {
  transform: translateY(100%); /* Smooth exit downwards */
  opacity: 0;
}

/* Scale transition */
.scale-enter-active .modal-content, .scale-leave-active .modal-content {
  transition: transform 1s, opacity 1s;
}

.scale-enter-from .modal-content {
  transform: scale(0.9);
  opacity: 0;
}

.scale-leave-to .modal-content {
  transform: scale(0.9); /* Ensure the scale effect persists during exit */
  opacity: 0;
}

button {
  cursor: pointer;
}

/* @unocss-placeholder */
</style>
