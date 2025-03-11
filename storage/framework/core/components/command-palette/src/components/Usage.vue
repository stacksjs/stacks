<script lang="ts" setup>
import { ref } from 'vue'
import { useCopyCode } from '../composables/useCopyCode'

const code = `
<!-- App.vue -->
<script lang="ts" setup>
import { ref } from 'vue'
import { Command } from '@stackjs/command-pallete'


const visible = ref(false)
<\/script>

<!-- <template> -->
<Command.Dialog :visible="visible" theme="custom">
  <template #header>
    <Command.Input placeholder="Type a command or search..." />
  </template>
  <template #body>
    <Command.List>
      <Command.Empty>No results found.</Command.Empty>

      <Command.Group heading="Letters">
        <Command.Item>a</Command.Item>
        <Command.Item>b</Command.Item>
        <Command.Separator />
        <Command.Item>c</Command.Item>
      </Command.Group>

      <Command.Item>Apple</Command.Item>
    </Command.List>
  </template>
</Command.Dialog>
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
        <div v-if="showCheckIcon" class="i-hugeicons:checkmark-circle-01 text-gray-500" />
        <div v-else class="i-hugeicons:copy-01 text-gray-500" />
      </button>
    </div>
  </div>
</template>
