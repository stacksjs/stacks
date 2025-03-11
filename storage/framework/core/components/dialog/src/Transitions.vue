<script lang="ts" setup>
import type { Transition } from './types'
import { computed, ref } from 'vue'
import Dialog from './components/Dialog.vue'
import DialogPanel from './components/DialogPanel.vue'
import { useCopyCode } from './composables/useCopyCode'

const currentTransition = ref<Transition>('fade')
const transitionList = ref<Transition[]>(['fade', 'pop', 'fadeInRightBig', 'jackInTheBox', 'slideInDown', 'slideInRight', 'custom-transition'])
const showCheckIcon = ref(false)
const visible = ref(false)

function handleClose() {
  visible.value = false
}

const styleCode = computed(() => {
  let style = `
.fade-enter-active,
.fade-leave-active {
  transition: opacity .4s linear;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}`

  if (currentTransition.value === 'custom-transition') {
    style = `
// Change 'custom-transition-*' into your transition name

.custom-transition-enter-active,
.custom-transition-leave-active {
  transition: transform 1s ease, opacity 1s ease;
}

.custom-transition-enter-from {
  opacity: 0;
  transform: translateY(-50%);
}`
  }

  if (currentTransition.value === 'slideInDown') {
    style = `
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
}`
  }

  if (currentTransition.value === 'slideInRight') {
    style = `
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
`
  }

  if (currentTransition.value === 'pop') {
    style = `
.pop-enter-active,
.pop-leave-active {
  transition: transform 0.4s cubic-bezier(0.5, 0, 0.5, 1), opacity 0.4s linear;
}

.pop-enter-from,
.pop-leave-to {
  opacity: 0;
  transform: scale(0.3) translateY(-50%);
}
`
  }

  if (currentTransition.value === 'fadeInRightBig') {
    style = `
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
`
  }

  if (currentTransition.value === 'jackInTheBox') {
    style = `
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
`
  }

  return style
})

const renderedCode = computed(() => {
  return `
<script lang="ts" setup>
import { Dialog, DialogOverlay, DialogPanel } from '@stacksjs/dialog'

const visible = ref(false)

const handleClose = () => {
  visible.value = false
}

<\/script>

<template>
  <transition name="fade" appear>
      <Dialog v-if="visible" @close="handleClose">
        <transition :name="${currentTransition.value}" appear>
          <DialogPanel>
            <p class="text-sm text-gray-500">
              Here is the content of the dialog
            </p>
          </DialogPanel>
        </transition>
      </Dialog>
    </transition>
</template>

<style scoped>${styleCode.value}
</style>`
})

function handleClick(action: Transition) {
  currentTransition.value = action
  visible.value = true
}

async function handleCopyCode() {
  await useCopyCode({ code: renderedCode.value, checkIconRef: showCheckIcon })
}
</script>

<template>
  <div class="types">
    <h1 class="my-2 text-lg font-semibold">
      Transition
    </h1>
    <p class="my-3 text-base">
      Here are the default transitions that come with the dialog.
    </p>

    <div class="mb-4 flex gap-3 overflow-auto">
      <button
        v-for="(trans, index) in transitionList"
        :key="index"
        class="btn-default"
        :class="{
          'bg-neutral-200/50 border-neutral-400/50': currentTransition === trans,
        }"
        @click="handleClick(trans)"
      >
        {{ trans }}
      </button>
    </div>
    <div class="group code-block relative">
      <Highlight
        language="javascript"
        class-name="rounded-md text-xs"
        :autodetect="false"
        :code="renderedCode"
      />
      <button
        aria-label="Copy code"
        title="Copy code"
        class="btn-border absolute right-2 top-2 hidden p-1 group-hover:block"
        @click="handleCopyCode"
      >
        <div v-if="showCheckIcon" class="i-hugeicons:checkmark-circle-01 text-gray-500" />
        <div v-else class="i-hugeicons:copy-01 text-gray-500" />
      </button>
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

    <p class="text-sm text-gray-500">
      For a better dialog overlay effect, we recommend on creating a separate dialog-overlay for it like the example above.
    </p>
  </div>
</template>

<style scoped>
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
/* @unocss-placeholder */
</style>
