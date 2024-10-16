<script lang="ts" setup>
import { ref } from 'vue'
// import { notification } from '../'
import { useCopyCode } from '../composables/useCopyCode'
import CheckIcon from './icons/CheckIcon.vue'
import CopyIcon from './icons/CopyIcon.vue'

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
  <Modal :visible="visible" @close="handleClose">
    <div>Hello</div>
  </Modal>
  <button @click="visible = true">
    Open Modal
  </button>
</template>
`

const showCheckIcon = ref(false)

async function handleCopyCode() {
  await useCopyCode({ code, checkIconRef: showCheckIcon })
  // notification('Copied to your clipboard!')
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
        <CheckIcon v-if="showCheckIcon" />
        <CopyIcon v-else />
      </button>
    </div>
  </div>
</template>

<style scoped>
/* @unocss-placeholder */
</style>
