<script lang="ts" setup>
import { ref } from 'vue'

import { useCopyCode } from '../composables/useCopyCode'

const code = `<!-- App.vue -->
<script lang="ts" setup>
import { Modal } from '@stacksjs/modal'

const visible = ref(false)

const handleClose = () => {
  visible.value = false
}
<\/script>

<template>
  <!-- ... -->
  <Modal :visible="visible" @close="handleClose" transition="fade">
    <template #closeButton />
    <template #header>
      <h1> Modal Title</h1>
    </template>

    <p>Here is the content of the modal</p>
  </Modal>

  <button @click="visible = true">
    Open Modal
  </button>
</template>
`

const showCheckIcon = ref(false)

async function handleCopyCode() {
  await useCopyCode({ code, checkIconRef: showCheckIcon })
}
</script>

<template>
  <div class="usage">
    <h1 class="my-2 text-lg font-semibold">
      Usage
    </h1>
    <p class="my-3 text-base">
      Render the modal in the root of your app.
    </p>
    <div class="group code-block relative">
      <Highlight
        class-name="hightlight-rounded-md text-xs"
        language="xml"
        :autodetect="false"
        :code="code"
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
  </div>
</template>

<style scoped>
button {
  border: 0px solid #000;
}

/* @unocss-placeholder */
</style>
