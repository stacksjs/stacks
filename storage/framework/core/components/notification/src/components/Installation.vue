<script lang="ts" setup>
import { ref } from 'vue'
import { notification } from '../../packages'
import { useCopyCode } from '../composables/useCopyCode'
import CheckIcon from './icons/CheckIcon.stx'
import CopyIcon from './icons/CopyIcon.stx'

const code = `bun install @stacksjs/notification`

const showCheckIcon = ref(false)

async function handleCopyCode() {
  await useCopyCode({ code, checkIconRef: showCheckIcon })
  notification('Copied to your clipboard!')
}
</script>

<template>
  <div class="installation">
    <h1 class="text-lg font-semibold my-3">
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
        class="absolute right-2 top-2 btn-border p-1"
        @click="handleCopyCode"
      >
        <CheckIcon v-if="showCheckIcon" />
        <CopyIcon v-else />
      </button>
    </div>
  </div>
</template>
