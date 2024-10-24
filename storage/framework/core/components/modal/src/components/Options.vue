<script lang="ts" setup>
import { computed, ref } from 'vue'
// import { notification } from '../'
import { useCopyCode } from '../composables/useCopyCode'

const currentAction = ref('default')
const showCheckIcon = ref(false)
const visible = ref(false)

function handleClose() {
  visible.value = false
}

const renderedCode = computed(() => {
  if (currentAction.value === 'default') {
    return `<Modal :visible="visible" @close="handleClose">
    <div>
      <p class="text-sm text-gray-500">
        Here is the content of the modal
      </p>
    </div>
</Modal>`
  }

  if (currentAction.value === 'close') {
    return `<Modal close-button :visible="visible" @close="handleClose">
    <div>
      <p class="text-sm text-gray-500">
        Here is the content of the modal
      </p>
    </div>
</Modal>`
  }

  if (currentAction.value === 'header') {
    return `<Modal :visible="visible" @close="handleClose">
    <template v-slot:header>
      <h1 class="text-lg font-semibold">
        Greetings
      </h1>
    </template>
    <div>
      <p class="text-sm text-gray-500">
        Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vivamus lacinia odio vitae vestibulum vestibulum.
      </p>
    </div>
</Modal>`
  }

  return ``
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
      Here are the options you can use for the Modal component.
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
        <div v-if="showCheckIcon" class="i-ic:baseline-check text-gray-500" />
        <div v-else class="i-ic:baseline-content-copy text-gray-500" />
      </button>
    </div>

    <Modal v-if="currentAction === 'default'" :visible="visible" @close="handleClose">
      <div>
        <p class="text-sm text-gray-500">
          Here is the content of the modal
        </p>
      </div>
    </Modal>

    <Modal v-if="currentAction === 'close'" close-button :visible="visible" @close="handleClose">
      <div>
        <p class="text-sm text-gray-500">
          Here is the content of the modal
        </p>
      </div>
    </Modal>

    <Modal v-if="currentAction === 'header'" :visible="visible" @close="handleClose">
      <template #header>
        <h1 class="text-lg font-semibold">
          Greetings
        </h1>
      </template>

      <div>
        <div class="sm:flex">
          <div class="mt-3 sm:mt-0">
            <div class="mt-2">
              <p class="text-sm text-gray-500">
                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vivamus lacinia odio vitae vestibulum vestibulum.
              </p>
            </div>
          </div>
        </div>
        <div class="mt-5 justify-center sm:mt-4 sm:flex sm:flex-row-reverse">
          <button type="button" class="w-full inline-flex justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm text-white font-semibold shadow-sm hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-indigo-600 focus-visible:outline-offset-2 focus-visible:outline" @click="handleClose">
            Close
          </button>
        </div>
      </div>
    </Modal>
  </div>
</template>

<style scoped>
/* @unocss-placeholder */
</style>
