<script lang="ts" setup>
import { ref } from 'vue'
import { useCopyCode } from './composables/useCopyCode'

const code = `bun install @stacksjs/popover`

const showCheckIcon = ref(false)

async function handleCopyCode() {
  await useCopyCode({ code, checkIconRef: showCheckIcon })
}
</script>

<template>
  <div class="installation">
    <h1 class="my-3 text-lg font-semibold">
      Installation
    </h1>
    <div class="code-block relative">
      <Highlight
        language="javascript"
        class-name="rounded-md text-xs"
        :autodetect="false"
        :code="code"
      />
      <button
        aria-label="Copy code"
        title="Copy code"
        class="btn-border absolute right-2 top-2 p-1"
        @click="handleCopyCode"
      >
        <div v-if="showCheckIcon" class="i-hugeicons:checkmark-circle-01 text-gray-500" />
        <div v-else class="i-hugeicons:copy-01 text-gray-500" />
      </button>
    </div>
  </div>
</template>
