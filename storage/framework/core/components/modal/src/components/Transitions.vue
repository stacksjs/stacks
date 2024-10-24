<script lang="ts" setup>
import { computed, ref } from 'vue'
import { useCopyCode } from '../composables/useCopyCode'

type Transition = 'fade' | 'slide-fade' | 'scale'

const currentTransition = ref<Transition>('slide-fade')
const showCheckIcon = ref(false)
const visible = ref(false)

function handleClose() {
  visible.value = false
}

const renderedCode = computed(() => {
  return `<Modal close-button :visible="visible" @close="handleClose" :transition="${currentTransition.value}">
    <div>
      <p class="text-sm text-gray-500">
        Here is the content of the modal
      </p>
    </div>
</Modal>`
})

function handleClick(action: Transition) {
  visible.value = true
  currentTransition.value = action
  // notification('Event has been created', {
  //   style: {
  //     background: currenTransition.value === 'all' ? '#fda4af' : '#6ee7b7',
  //   },
  //   class: 'my-toast',
  //   descriptionClass: 'my-toast-description',
  // })
}

async function handleCopyCode() {
  await useCopyCode({ code: renderedCode.value, checkIconRef: showCheckIcon })
  // notification('Copied to your clipboard!!!')
}
</script>

<template>
  <div class="types">
    <h1 class="my-2 text-lg font-semibold">
      Transition
    </h1>
    <p class="my-3 text-base">
      Here are the transition options you can use for the Modal component.
    </p>
    <div class="mb-4 flex gap-3 overflow-auto">
      <button
        class="btn-default"
        :class="{
          'bg-neutral-200/50 border-neutral-400/50': currentTransition === 'fade',
        }"
        @click="handleClick('fade')"
      >
        Fade (default)
      </button>
      <button
        class="btn-default"
        :class="{
          'bg-neutral-200/50 border-neutral-400/50': currentTransition === 'slide-fade',
        }"
        @click="handleClick('slide-fade')"
      >
        Slide Fade
      </button>
      <button
        class="btn-default"
        :class="{
          'bg-neutral-200/50 border-neutral-400/50': currentTransition === 'scale',
        }"
        @click="handleClick('scale')"
      >
        Scale
      </button>
    </div>
    <div class="code-block group relative">
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
        <div v-if="showCheckIcon" class="i-ic:baseline-check text-gray-500" />
        <div v-else class="i-ic:baseline-content-copy text-gray-500" />
      </button>
    </div>

    <Modal close-button :visible="visible" @close="handleClose" :transition="currentTransition">
      <div>
        <p class="text-sm text-gray-500">
          Here is the content of the modal
        </p>
      </div>
    </Modal>
  </div>
</template>

<style scoped>
/* @unocss-placeholder */
</style>
