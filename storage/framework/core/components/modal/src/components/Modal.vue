<script lang="ts" setup>
import { defineCustomElement, onMounted, onUnmounted, useSlots, computed } from 'vue'

type Transition = 'slide-down' | 'fade' | 'pop' | 'custom'

const props = defineProps<{
  visible: boolean
  transition?: Transition
  className?: string
}>()

const emit = defineEmits<{
  (event: 'close', visible: boolean): void
}>()

const slots = useSlots()
const currentTransition = computed(() => props.transition ?? 'fade')

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
  <div class="relative z-10" aria-labelledby="modal-title" role="dialog" aria-modal="true">
    <transition name="fade" appear>
      <div v-if="props.visible" class="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" aria-hidden="true" />
    </transition>

    <transition :name="currentTransition" appear>
      <div v-if="props.visible" class="fixed inset-0 z-10 w-screen overflow-y-auto">
        <div class="flex items-end justify-center min-h-full p-4 text-center sm:items-center sm:p-0" @click.self="handleClose">
          <div class="px-4 pt-5 pb-4 overflow-hidden text-left transition-all transform bg-white rounded-lg shadow-xl modal-content sm:my-8 sm:max-w-lg sm:w-full sm:p-6" @click.stop>

            <div  v-if="slots.closeButton" class="absolute top-0 right-0 pt-4 pr-4 sm:block">
              <div v-if="slots.closeButton().length === 0">
                <button type="button" class="text-gray-400 bg-transparent border-none rounded-md hover:text-gray-500 focus:outline-none" @click="handleClose">
                  <span class="sr-only">Close</span>
                  <div class="w-8 h-8 i-heroicons-x-mark" />
                </button>
              </div>

              <slot v-else name="closeButton" />
            </div>

            <div v-if="slots.header" class="flex w-full">
              <div class="flex items-center justify-between">

                <slot name="header" />
              </div>
            </div>

            <div class="flex w-full">
              <slot>
                <p>Default modal content goes here.</p>
              </slot>
            </div>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<style>
button {
  cursor: pointer;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity .4s linear;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Slide-down transition styles */
.slide-down-enter-active, .slide-down-leave-active {
  transition: transform 0.3s ease, opacity 0.3s ease;
}
.slide-down-enter-from, .slide-down-leave-to {
  transform: translateY(-100%);
  opacity: 0;
}
.slide-down-enter-to, .slide-down-leave-from {
  transform: translateY(0);
  opacity: 1;
}

.pop-enter-active,
.pop-leave-active {
  transition: transform 0.4s cubic-bezier(0.5, 0, 0.5, 1), opacity 0.4s linear;
}

.pop-enter-from,
.pop-leave-to {
  opacity: 0;
  transform: scale(0.3) translateY(-50%);
}

/* @unocss-placeholder */
</style>
