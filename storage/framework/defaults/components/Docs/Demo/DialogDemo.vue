<script lang="ts" setup>
import { ref } from 'vue'
import { Dialog, DialogPanel } from '@stacksjs/dialog'
import DocsPlayground from './DocsPlayground.vue'
import DialogCode from './DialogCode.md'

const visible = ref(false)

type Transition = 'fade' | 'slideInDown' | 'pop' | 'fadeInRightBig' | 'jackInTheBox' | 'slideInRight' | 'custom-transition'

const currentTransition = ref<Transition>('fade')

function handleOpen(name: Transition) {
  currentTransition.value = name
  visible.value = true
}

function handleClose() {
  visible.value = false
}

</script>

<template>
  <div class="max-w-4xl">
    <DocsPlayground>
      <div class="space-y-4 mb-12 flex flex-col items-center justify-center items-center h-[300px]">
      <button
        class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-200"
        @click="handleOpen('fade')"
      >

      <div class="mr-2 w-5 h-5" />
        <i class="hgi hgi-stroke hgi-check " /> Show Dialog
      </button>
    </div>

    <template #code>
      <DialogCode />
    </template>
    </DocsPlayground>

    <!-- Dialog Component -->
    <transition name="fade" appear>
      <Dialog v-if="visible" @close="handleClose" class="relative z-50">
        <div class="fixed inset-0 bg-black/30" aria-hidden="true" />

        <div class="fixed inset-0 flex items-center justify-center p-4">
          <transition :name="currentTransition" appear>
            <DialogPanel class="mx-auto max-w-sm rounded-xl bg-white p-6 shadow-xl">
              <div class="flex items-center justify-between mb-4">
                <h3 class="text-lg font-medium text-gray-900">Dialog Title</h3>
                <button
                  class="text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 rounded-full p-1"
                  @click="handleClose"
                >
                  <div class="i-hugeicons-cancel-01-20-solid w-5 h-5" />
                </button>
              </div>

              <p class="text-sm text-gray-500">
                Here is the content of the dialog. You can customize this content to show any information you need.
              </p>

              <div class="mt-6 flex justify-end gap-3">
                <button
                  class="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  @click="handleClose"
                >
                  Cancel
                </button>
                <button
                  class="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  @click="handleClose"
                >
                  Confirm
                </button>
              </div>
            </DialogPanel>
          </transition>
        </div>
      </Dialog>
    </transition>
  </div>
</template>

<style>
.fade-enter-active,
.fade-leave-active {
  transition: opacity .4s linear;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

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
</style>
