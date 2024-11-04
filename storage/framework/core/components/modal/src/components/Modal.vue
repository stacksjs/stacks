<script lang="ts" setup>
import type { Transition } from '../types'
import { computed, defineCustomElement, onMounted, onUnmounted, useSlots } from 'vue'

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
      <div v-if="props.visible" class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" />
    </transition>

    <transition :name="currentTransition" appear>
      <div v-if="props.visible" class="fixed inset-0 z-10 w-screen overflow-y-auto">
        <div class="min-h-full flex items-end justify-center p-4 text-center sm:items-center sm:p-0" @click.self="handleClose">
          <div class="modal-content transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:max-w-lg sm:w-full sm:p-6" @click.stop>
            <div v-if="slots.closeButton" class="absolute right-0 top-0 pr-4 pt-4 sm:block">
              <div v-if="slots.closeButton().length === 0">
                <button type="button" class="rounded-md border-none bg-transparent text-gray-400 hover:text-gray-500 focus:outline-none" @click="handleClose">
                  <span class="sr-only">Close</span>
                  <div class="i-heroicons-x-mark h-8 w-8" />
                </button>
              </div>

              <slot v-else name="closeButton" />
            </div>

            <div v-if="slots.header" class="w-full flex">
              <div class="flex items-center justify-between">
                <slot name="header" />
              </div>
            </div>

            <div class="w-full flex">
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

:host {
  --modal-transition-duration: 0.4s;
  --modal-transform-enter: translateY(0);
  --modal-transform-leave: translateY(-100%);
}

.custom-enter-active,
.custom-leave-active {
  transition: transform var(--modal-transition-duration) ease, opacity var(--modal-transition-duration) ease;
}

.custom-enter-from {
  opacity: 0;
  transform: var(--modal-transform-leave);
}

.custom-enter-to {
  opacity: 1;
  transform: var(--modal-transform-enter);
}

.custom-leave-from {
  opacity: 1;
  transform: var(--modal-transform-enter);
}

.custom-leave-to {
  opacity: 0;
  transform: var(--modal-transform-leave);
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
.slideInDown-enter-active,
.slideInDown-leave-active {
  transition: transform 0.3s ease, opacity 0.3s ease;
}

.slideInDown-enter-from {
  opacity: 0;
  transform: translateY(-100%);
}

.slideInDown-enter-to {
  opacity: 1;
  transform: translateY(0);
}

.slideInDown-leave-from {
  opacity: 1;
  transform: translateY(0);
}

.slideInDown-leave-to {
  opacity: 0;
  transform: translateY(-100%);
}

.slideInRight-enter-active,
.slideInRight-leave-active {
  transition: transform 0.5s ease-out, opacity 0.5s ease-out;
}

.slideInRight-enter-from {
  opacity: 0;
  transform: translateX(100%);
}

.slideInRight-enter-to {
  opacity: 1;
  transform: translateX(0);
}

.slideInRight-leave-from {
  opacity: 1;
  transform: translateX(0);
}

.slideInRight-leave-to {
  opacity: 0;
  transform: translateX(100%);
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

.fadeInRightBig-enter-active,
.fadeInRightBig-leave-active {
  transition: transform 0.4s ease-out, opacity 0.4s ease-out;
}

.fadeInRightBig-enter-from,
.fadeInRightBig-leave-to {
  opacity: 0;
  transform: translateX(100%);
}

.fadeInRightBig-enter-to,
.fadeInRightBig-leave-from {
  opacity: 1;
  transform: translateX(0);
}

.lightSpeedInRight-enter-active,
.lightSpeedInRight-leave-active {
  transition: transform 0.5s ease-out, opacity 0.5s ease-out;
}

.lightSpeedInRight-enter-from {
  opacity: 0;
  transform: translateX(100%) skewX(-30deg);
}

.lightSpeedInRight-enter-to {
  opacity: 1;
  transform: translateX(0) skewX(0);
}

.lightSpeedInRight-leave-from {
  opacity: 1;
  transform: translateX(0) skewX(0);
}

.lightSpeedInRight-leave-to {
  opacity: 0;
  transform: translateX(100%) skewX(30deg);
}

.jackInTheBox-enter-active,
.jackInTheBox-leave-active {
  transition: transform 0.7s ease-out, opacity 0.7s ease-out;
}

.jackInTheBox-enter-from {
  opacity: 0;
  transform: scale(0.1) rotate(30deg);
}

.jackInTheBox-enter-to {
  opacity: 1;
  transform: scale(1) rotate(0);
}

.jackInTheBox-leave-from {
  opacity: 1;
  transform: scale(1) rotate(0);
}

.jackInTheBox-leave-to {
  opacity: 0;
  transform: scale(0.1) rotate(-30deg);
}

/* @unocss-placeholder */
</style>
