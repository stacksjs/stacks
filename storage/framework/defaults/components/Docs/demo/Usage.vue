<script lang="ts" setup>
import { ref } from 'vue'
import { useCopyCode } from './composables/useCopyCode'
import { Highlight } from './plugins/highlight'

const props = defineProps({
  code: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
})

const showCheckIcon = ref(false)

async function handleCopyCode() {
  await useCopyCode({ code: props.code, checkIconRef: showCheckIcon })
}
</script>

<template>
  <div class="usage text-gray-900">
    <h2 class="my-2 text-lg font-semibold">
      Usage
    </h2>
    <p class="my-3 text-base" v-html="description" />
    <div class="code-block group relative">
      <Highlight
        class-name="rounded-md text-xs"
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
    <p class="my-3 text-base">
      To learn more, read this part of the documentation, as much of <a class="text-blue-500" href="https://headlessui.com/v1/vue/combobox" target="_blank">Headless UI</a> is proxied.
    </p>
  </div>
</template>

