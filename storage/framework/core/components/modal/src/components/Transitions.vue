<script lang="ts" setup>
import type { Transition } from '../types'
import { computed, ref } from 'vue'
import { useCopyCode } from '../composables/useCopyCode'

const currentTransition = ref<Transition>('fade')
const transitionList = ref<Transition[]>(['fade', 'custom', 'pop', 'fadeInRightBig', 'lightSpeedInRight', 'jackInTheBox', 'slideInDown', 'slideInRight'])
const showCheckIcon = ref(false)
const visible = ref(false)

function handleClose() {
  visible.value = false
}

const renderedCode = computed(() => {
  if (currentTransition.value === 'custom') {
    return `<Modal :visible="visible" @close="handleClose" transition="custom">
  <template #closeButton />
  <template #header>
    <h1> Hello Detail</h1>
  </template>

  <p>Modal Content</p>
</Modal>

<style>
:root {
  --modal-transition-duration: 1s; /* Custom duration */
  --modal-transform-enter: translateY(0);  /* Custom transform */
  --modal-transform-leave: translateY(-50%); /* Custom transform */
}
</style>`
  }

  return `<Modal :visible="visible" @close="handleClose" transition="${currentTransition.value}">
  <template #closeButton />
  <template #header>
    <h1> Hello Detail</h1>
  </template>

  <p>Modal Content</p>
</Modal>`
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
      Here are the default transitions that come with the modal.
    </p>
    <div class="mb-4 flex gap-3 overflow-auto">
      <button
        v-for="trans in transitionList"
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
        <div v-if="showCheckIcon" class="i-heroicons-check text-gray-500" />
        <div v-else class="i-heroicons-document-duplicate text-gray-500" />
      </button>
    </div>

    <Modal :visible="visible" :transition="currentTransition" @close="handleClose">
      <div>
        <p class="text-sm text-gray-500">
          Here is the content of the modal
        </p>
      </div>
    </Modal>
  </div>
</template>

<style>
button {
  border: 0px solid #000;
}

:root {
  --modal-transition-duration: 1s; /* Custom duration */
  --modal-transform-enter: translateY(0);
  --modal-transform-leave: translateY(-50%);
}

/* @unocss-placeholder */
</style>
