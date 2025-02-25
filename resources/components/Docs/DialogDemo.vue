<script lang="ts" setup>
import { ref } from 'vue'
import { Dialog, DialogPanel } from '@stacksjs/dialog'

const visible = ref(false)

type Transition = 'fade' | 'slideInDown' | 'pop' | 'fadeInRightBig' | 'jackInTheBox' | 'slideInRight' | 'custom-transition'

const currentTransition = ref<Transition>('fade')
const transitionList = ref<Transition[]>(['fade', 'pop', 'fadeInRightBig', 'jackInTheBox', 'slideInDown', 'slideInRight', 'custom-transition'])

function handleOpen(name: Transition) {
  currentTransition.value = name
  visible.value = true
}

function handleClose() {
  visible.value = false
}

</script>

<template >
  <div>
    <div class="flex flex-col my-2" >
      <span class="text-xl font-medium text-gray-900">
        Basic
      </span>
    </div>

    <button
      class=" btn-default btn-primary"
      @click="handleOpen('fade')"
    >
      Show
    </button>

    <div class="flex flex-col mt-10" >
      <span class="text-xl font-medium text-gray-900">
        Transition Dialog
      </span>

      <div class="flex mt-4" >
        <button
        v-for="(trans, index) in transitionList"
        :key="index"
        class="btn-default mx-2"
        :class="{
          'bg-neutral-200/50 border-neutral-400/50': currentTransition === trans,
        }"
        @click="handleOpen(trans)"
      >
        {{ trans }}
      </button>
      </div>
    </div>

    <transition name="fade" appear>
      <Dialog v-if="visible" @close="handleClose">
        <transition :name="currentTransition" appear>
          <DialogPanel>
            <p class="text-sm text-gray-500">
              Here is the content of the dialog
            </p>
          </DialogPanel>
        </transition>
      </Dialog>
    </transition>

  </div>
</template>

<style>
button {
  border: 0px solid #000;
}

.modal-overlay-enter-active,
.modal-overlay-leave-active {
  transition: opacity 0.3s ease;
}

.modal-overlay-enter-from,
.modal-overlay-leave-to {
  opacity: 0;
}

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
</style>
