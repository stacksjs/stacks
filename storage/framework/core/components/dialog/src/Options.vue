<script lang="ts" setup>
import { computed, ref } from 'vue'
import { useCopyCode } from './composables/useCopyCode'

const currentAction = ref('default')
const showCheckIcon = ref(false)
const visible = ref(false)

function handleClose() {
  visible.value = false
}

const renderedCode = computed(() => {
  let dialogContent = `
  <div>
    <p class="text-sm text-gray-500">
      Here is the content of the dialog
    </p>
  </div>
`

  if (currentAction.value === 'close') {
    dialogContent = `
  <!-- For default close button -->
  <template #closeButton />

  <!-- For custom close button in the same position-->
  <template #closeButton>
    <button>
      Close
    </button>
  </template>

  <div>
    <p class="text-sm text-gray-500">
      Here is the content of the dialog
    </p>
  </div
`
  }

  if (currentAction.value === 'header') {
    dialogContent = `
  <template #header>
    <h1 class="text-lg font-semibold">
      Greetings
    </h1>
  </template>

  <div>
    <p class="text-sm text-gray-500">
      Here is the content of the dialog.
    </p>
  </div>
`
  }

  return `<Dialog :visible="visible" overlay @close="handleClose">${dialogContent}</Dialog>`
})

function handleClick(action: string) {
  currentAction.value = action
  visible.value = true
}

async function handleCopyCode() {
  await useCopyCode({ code: renderedCode.value, checkIconRef: showCheckIcon })
}
</script>

<template>
  <div class="types">
    <h1 class="my-2 text-lg font-semibold">
      Options
    </h1>
    <p class="my-3 text-base">
      Here are the options you can use for the modal.
    </p>
    <div class="mb-4 flex gap-3 overflow-auto">
      <button
        class="btn-default"
        :class="{
          'bg-neutral-200/50 border-neutral-400/50': currentAction === 'default',
        }"
        @click="handleClick('default')"
      >
        Default
      </button>
      <button
        class="btn-default"
        :class="{
          'bg-neutral-200/50 border-neutral-400/50': currentAction === 'close',
        }"
        @click="handleClick('close')"
      >
        Modal with close button
      </button>
      <button
        class="btn-default"
        :class="{
          'bg-neutral-200/50 border-neutral-400/50':
            currentAction === 'header',
        }"
        @click="handleClick('header')"
      >
        Modal with header
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
        <div v-if="showCheckIcon" class="i-hugeicons:checkmark-circle-01 text-gray-500" />
        <div v-else class="i-hugeicons:copy-01 text-gray-500" />
      </button>
    </div>

    <Transition name="fade" appear>
      <Dialog :visible="visible" class="bg-gray-500 bg-opacity-70 transition-opacity" @close="handleClose">
        <template v-if="currentAction === 'close'" #closeButton />
        <template v-if="currentAction === 'header'" #header>
          <h1 class="text-lg font-semibold">
            Greetings
          </h1>
        </template>

        <div>
          <p class="text-sm text-gray-500">
            Here is the content of the modal
          </p>
        </div>
      </Dialog>
    </Transition>
  </div>
</template>

<style scoped>
button {
  border: 0px solid #000;
}

/* @unocss-placeholder */
</style>
