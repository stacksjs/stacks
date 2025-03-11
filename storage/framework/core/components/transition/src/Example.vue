<script setup lang="ts">
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  TransitionChild,
  TransitionRoot,
} from '@headlessui/vue'
import { computed, ref } from 'vue'

import { useCopyCode } from './composables/useCopyCode'

interface TransitionClass {
  enter: string
  enterFrom: string
  enterTo: string
  leave: string
  leaveFrom: string
  leaveTo: string
}

const transitionList = ref<string[]>([
  'fade',
  'slideInRight',
  'slideInDown',
  'pop',
])

const showCheckIcon = ref(false)
const currentTransition = ref(transitionList.value[0])
const isOpen = ref(false)

const transitionClass = computed<TransitionClass>(() => {
  if (currentTransition.value === 'slideInRight') {
    return {
      enter: 'transition-transform transition-opacity duration-500 ease-out',
      enterFrom: 'opacity-0 translate-x-full',
      enterTo: 'opacity-100 translate-x-0',
      leave: 'transition-transform transition-opacity duration-500 ease-out',
      leaveFrom: 'opacity-100 translate-x-0',
      leaveTo: 'opacity-0 translate-x-full',
    }
  }

  if (currentTransition.value === 'slideInDown') {
    return {
      enter: 'transition-transform transition-opacity duration-500 ease-out',
      enterFrom: 'opacity-0 -translate-y-full',
      enterTo: 'opacity-100 translate-y-0',
      leave: 'transition-transform transition-opacity duration-500 ease-out',
      leaveFrom: 'opacity-100 translate-y-0',
      leaveTo: 'opacity-0 -translate-y-full',
    }
  }

  if (currentTransition.value === 'pop') {
    return {
      enter: 'transition-transform duration-300',
      enterFrom: 'transform scale-0',
      enterTo: 'transform scale-100',
      leave: 'transition-transform duration-300',
      leaveFrom: 'transform scale-100',
      leaveTo: 'transform scale-0',
    }
  }

  return {
    enter: 'transition-opacity duration-300',
    enterFrom: 'opacity-0',
    enterTo: 'opacity-100',
    leave: 'transition-opacity duration-300',
    leaveFrom: 'opacity-100',
    leaveTo: 'opacity-0',
  }
})

const renderedCode = computed(() => {
  return `
<TransitionRoot appear :show="isOpen">
  <Dialog :open="isOpen" @close="setIsOpen" class="relative z-50">
    <div class="fixed inset-0 bg-black/30" aria-hidden="true" />
    <div class="fixed inset-0 flex w-screen items-center justify-center p-4">

      <TransitionChild
        :enter="${transitionClass.value.enter}"
        :enter-from="${transitionClass.value.enterFrom}"
        :enter-to="${transitionClass.value.enterTo}"
        :leave="${transitionClass.value.leave}"
        :leave-from="${transitionClass.value.leaveFrom}"
        :leave-to="${transitionClass.value.leaveTo}"
      >
        <DialogPanel class="w-full max-w-sm rounded bg-white p-5">
          <DialogTitle>Complete your order</DialogTitle>

          <div class="mt-4">
            <p>
              Lorem ipsum dolor sit amet consectetur adipisicing elit.
            </p>
          </div>
        </DialogPanel>
      </TransitionChild>
    </div>
  </Dialog>
</TransitionRoot>
    `
})

function setIsOpen(value: boolean) {
  isOpen.value = value
}

function handleClick(trans: string) {
  setIsOpen(true)
  currentTransition.value = trans
}

async function handleCopyCode() {
  await useCopyCode({ code: renderedCode.value, checkIconRef: showCheckIcon })
}
</script>

<template>
  <section id="example">
    <h1 class="my-2 text-lg font-semibold">
      Transition
    </h1>
    <p class="my-3 text-base">
      Here are the transitions that come with the dialog.
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

    <div class="flex flex-col gap-4">
      <TransitionRoot
        appear
        :show="isOpen"
      >
        <Dialog :open="isOpen" class="relative z-50" @close="setIsOpen">
          <div class="fixed inset-0 bg-black/30" aria-hidden="true" />

          <div class="fixed inset-0 w-screen flex items-center justify-center p-4">
            <TransitionChild
              :enter="transitionClass.enter"
              :enter-from="transitionClass.enterFrom"
              :enter-to="transitionClass.enterTo"
              :leave="transitionClass.leave"
              :leave-from="transitionClass.leaveFrom"
              :leave-to="transitionClass.leaveTo"
            >
              <DialogPanel class="max-w-sm w-full rounded bg-white p-5">
                <DialogTitle>Complete your order</DialogTitle>

                <div class="mt-4">
                  <p>
                    Lorem ipsum dolor sit amet consectetur adipisicing elit.
                  </p>
                </div>
              </DialogPanel>
            </TransitionChild>
          </div>
        </Dialog>
      </TransitionRoot>
    </div>
  </section>
</template>
