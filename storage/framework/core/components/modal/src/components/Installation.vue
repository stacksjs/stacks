<script lang="ts" setup>
import { ref } from 'vue'
import { useCopyCode } from '../composables/useCopyCode'

const code = `bun install @stacksjs/modal`

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
    <div class="relative code-block">
      <Highlight
        language="javascript"
        class-name="rounded-md text-xs"
        :autodetect="false"
        :code="code"
      />
      <button
        aria-label="Copy code"
        title="Copy code"
        class="absolute p-1 btn-border right-2 top-2"
        @click="handleCopyCode"
      >
        <div v-if="showCheckIcon" class="text-gray-500 i-heroicons-check" />
        <div v-else class="text-gray-500 i-heroicons-document-duplicate" />
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
