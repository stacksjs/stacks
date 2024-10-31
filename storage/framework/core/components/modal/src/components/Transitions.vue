<script lang="ts" setup>
import { computed, ref } from 'vue'
import { useCopyCode } from '../composables/useCopyCode'
import type { Transition } from '../types'

const currentTransition = ref<Transition>('fade')
const transitionList = ref<Transition[]>(['fade',  'pop', 'fadeInRightBig', 'lightSpeedInRight', 'jackInTheBox', 'slideInDown', 'slideInRight'])
const showCheckIcon = ref(false)
const visible = ref(false)

function handleClose() {
  visible.value = false
}

const renderedCode = computed(() => {
  return `
<!-- App.vue -->
<script setup lang="ts">
import { Transition } from 'vue'
<\/script>

<template>
  <Modal :visible="visible" @close="handleClose" transition="${currentTransition.value}">
    <template #closeButton />
    <template #header>
      <h1> Hello Detail</h1>
    </template>

    <p>Modal Content</p>
  </Modal>
</template>`
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
    <div class="flex gap-3 mb-4 overflow-auto">
      <button
        class="btn-default"
        v-for="trans in transitionList"
        :class="{
          'bg-neutral-200/50 border-neutral-400/50': currentTransition === trans,
        }"
        @click="handleClick(trans)"
      >
        {{ trans }}
      </button>
    </div>
    <div class="relative code-block group">
      <Highlight
        language="javascript"
        class-name="rounded-md text-xs"
        :autodetect="false"
        :code="renderedCode"
      />
      <button
        aria-label="Copy code"
        title="Copy code"
        class="absolute hidden p-1 btn-border right-2 top-2 group-hover:block"
        @click="handleCopyCode"
      >
        <div v-if="showCheckIcon" class="text-gray-500 i-heroicons-check" />
        <div v-else class="text-gray-500 i-heroicons-document-duplicate" />
      </button>
    </div>
    <div class="my-3 text-sm text-gray-500">
      For custom transition, you can use the custom class to apply the transition to the modal content.
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

<style scoped>
button {
  border: 0px solid #000;
}
/* @unocss-placeholder */
</style>
