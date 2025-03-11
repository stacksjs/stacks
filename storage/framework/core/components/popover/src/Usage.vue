<script lang="ts" setup>
import { ref } from 'vue'
import { useCopyCode } from './composables/useCopyCode'

const code = `<!-- App.vue -->
<script lang="ts" setup>
 import { Popover, PopoverButton, PopoverPanel } from '@stacksjs/popover'
<\/script>

<template>
 <!-- ... -->
  <Popover class="relative">
    <PopoverButton>Solutions</PopoverButton>

    <PopoverPanel class="absolute z-10">
      <div class="grid grid-cols-2">
        <a href="/analytics">Analytics</a>
        <a href="/engagement">Engagement</a>
        <a href="/security">Security</a>
        <a href="/integrations">Integrations</a>
      </div>

      <img src="/solutions.jpg" alt="" />
    </PopoverPanel>
  </Popover>
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
      Popovers are built using the <code>Popover</code>, <code>PopoverButton</code>, and <code>PopoverPanel</code> components.
      <br><br>
      Clicking the <code>PopoverButton</code> will automatically open/close the <code>PopoverPanel</code>. When the panel is open, clicking anywhere outside of its contents, pressing the Escape key, or tabbing away from it will close the Popover.
    </p>
    <div class="group code-block relative">
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
        <div v-if="showCheckIcon" class="i-hugeicons:checkmark-circle-01 text-gray-500" />
        <div v-else class="i-hugeicons:copy-01 text-gray-500" />
      </button>
    </div>
    <p class="my-3 text-base">
      To learn more, read this part of the documentation, as much of <a class="text-blue-500" href="https://headlessui.com/v1/vue/popover" target="_blank">Headless UI</a> is proxied.
    </p>
  </div>
</template>

<style scoped>
code {
  font-weight: 600;
}
</style>
